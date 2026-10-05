import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import type { AuthError, PostgrestError, SupabaseClient } from '@supabase/supabase-js';

import { flagFor } from '@/data/catalog';
import { normalizeInviteCode, type RedeemResult } from '@/services/invites';
import type { Conversation, MediaMeta, Message, MessageKind } from '@/types/chat';
import type { Passport, VerificationStatus } from '@/types/extras';
import { supabase as client } from '@/lib/supabase';
import {
  DEFAULT_PREFS,
  type DiscoveryPrefs,
  type Gender,
  type Plan,
  type Profile,
  type ProfilePrompt,
  type ShowMe,
  type Usage,
  type UserProfile,
} from '@/types/user';

import { BackendError, type Account, type Backend, type ProfileDraft } from './types';

WebBrowser.maybeCompleteAuthSession();

const BUCKET = 'photos';
const PAGE_SIZE = 30;
const CHAT_BUCKET = 'chat-media';
const SIGNED_URL_SECONDS = 60 * 60;
/** Links temporários já gerados (fotos e áudios privados do chat). */
const signedUrls = new Map<string, { url: string; expires: number }>();

/** Id de quem está logado, para saber de quem é cada mensagem do Realtime. */
let currentUserId: string | null = null;
const PUBLIC_PREFIX = `/storage/v1/object/public/${BUCKET}/`;

// ------------------------------------------------------------- erros

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: 'E-mail ou senha incorretos.',
  user_already_exists: 'Já existe uma conta com este e-mail.',
  email_exists: 'Já existe uma conta com este e-mail.',
  email_not_confirmed: 'Confirme seu e-mail antes de entrar. Procure o link na sua caixa de entrada.',
  weak_password: 'Senha fraca. Use pelo menos 8 caracteres, com letras e números.',
  email_address_invalid: 'Digite um e-mail válido.',
  over_email_send_rate_limit: 'Muitos e-mails enviados. Aguarde alguns minutos e tente de novo.',
  over_request_rate_limit: 'Muitas tentativas. Aguarde um pouco e tente de novo.',
  same_password: 'A nova senha precisa ser diferente da atual.',
};

function fail(error: AuthError | PostgrestError | Error | { message: string; hint?: string; code?: string }): never {
  const code = 'code' in error ? error.code : undefined;
  const hint = 'hint' in error ? error.hint : undefined;
  if (hint === 'premium_required' || hint === 'limit_likes' || hint === 'limit_super' || hint === 'limit_boost') {
    throw new BackendError(error.message, hint);
  }
  if (code && AUTH_MESSAGES[code]) throw new BackendError(AUTH_MESSAGES[code], 'auth');
  if (/fetch|network/i.test(error.message)) {
    throw new BackendError('Sem conexão com o servidor. Verifique sua internet.', 'network');
  }
  throw new BackendError(error.message || 'Algo deu errado. Tente novamente.');
}

function db(): SupabaseClient {
  if (!client) throw new BackendError('Supabase não configurado', 'not_available');
  return client;
}

async function requireUserId(): Promise<string> {
  const { data } = await db().auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new BackendError('Sessão expirada. Entre novamente.', 'auth');
  return id;
}

// ---------------------------------------------------------- conversões

type ProfileRow = {
  id: string;
  name: string;
  birthdate: string;
  gender: Gender;
  show_me: ShowMe;
  bio: string;
  job: string;
  interests: string[];
  photos: string[];
  prompts: ProfilePrompt[] | null;
  city: string;
  state: string;
  country: string;
  lat: number | null;
  lng: number | null;
};

type CardRow = {
  id: string;
  name: string;
  age: number;
  gender: Gender;
  bio: string;
  job: string;
  interests: string[];
  photos: string[];
  city: string;
  state: string;
  country: string;
  verified: boolean;
  distance_km?: number | null;
  super_liked_you?: boolean;
  prompts?: ProfilePrompt[] | null;
};

const toUser = (row: ProfileRow, email: string): UserProfile => ({
  id: row.id,
  email,
  name: row.name,
  birthdate: row.birthdate,
  gender: row.gender,
  showMe: row.show_me,
  bio: row.bio,
  job: row.job,
  interests: row.interests,
  photos: row.photos,
  prompts: row.prompts ?? [],
  city: row.city,
  state: row.state,
  country: row.country,
  lat: row.lat,
  lng: row.lng,
});

const toCard = (row: CardRow): Profile => ({
  id: row.id,
  name: row.name,
  age: row.age,
  gender: row.gender,
  bio: row.bio,
  job: row.job || undefined,
  interests: row.interests,
  photos: row.photos,
  city: row.city,
  state: row.state,
  country: row.country,
  flag: flagFor(row.country),
  verified: row.verified,
  distanceKm: row.distance_km ?? null,
  superLikedYou: Boolean(row.super_liked_you),
  prompts: row.prompts ?? [],
});

type MessageRow = {
  id: string;
  match_id: string;
  sender_id: string;
  kind: MessageKind | null;
  body: string;
  media_url: string | null;
  media_meta: MediaMeta | null;
  created_at: string;
  read_at: string | null;
};

const toMessage = (row: MessageRow): Message => ({
  id: row.id,
  matchId: row.match_id,
  senderId: row.sender_id,
  kind: row.kind ?? 'text',
  body: row.body,
  mediaUrl: row.media_url ?? null,
  mediaMeta: row.media_meta ?? null,
  createdAt: row.created_at,
  readAt: row.read_at,
});

type ConversationRow = CardRow & {
  match_id: string;
  matched_at: string;
  last_message: string | null;
  last_message_at: string | null;
  last_from_me: boolean | null;
  unread: number;
};

const toConversation = (row: ConversationRow): Conversation => ({
  matchId: row.match_id,
  matchedAt: row.matched_at,
  profile: toCard(row),
  lastMessage: row.last_message,
  lastMessageAt: row.last_message_at,
  lastFromMe: Boolean(row.last_from_me),
  unread: row.unread,
});

function toRow(draft: Partial<ProfileDraft>) {
  const row: Record<string, unknown> = {};
  if (draft.name !== undefined) row.name = draft.name;
  if (draft.birthdate !== undefined) row.birthdate = draft.birthdate;
  if (draft.gender !== undefined) row.gender = draft.gender;
  if (draft.showMe !== undefined) row.show_me = draft.showMe;
  if (draft.bio !== undefined) row.bio = draft.bio;
  if (draft.job !== undefined) row.job = draft.job;
  if (draft.interests !== undefined) row.interests = draft.interests;
  if (draft.prompts !== undefined) row.prompts = draft.prompts;
  if (draft.photos !== undefined) row.photos = draft.photos;
  if (draft.city !== undefined) row.city = draft.city;
  if (draft.state !== undefined) row.state = draft.state;
  if (draft.country !== undefined) row.country = draft.country;
  if (draft.lat !== undefined) row.lat = draft.lat;
  if (draft.lng !== undefined) row.lng = draft.lng;
  return row;
}

// --------------------------------------------------------------- fotos

const isRemote = (uri: string) => /^https?:\/\//.test(uri);

async function readBytes(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') return (await fetch(uri)).arrayBuffer();
  return new File(uri).arrayBuffer();
}

/** Pede à moderação automática para analisar a foto. A recusada já volta apagada. */
async function moderate(path: string): Promise<boolean> {
  const { data, error } = await db().functions.invoke('moderate-photo', { body: { path } });
  // Função não publicada ou fora do ar: não trava o cadastro (a reserva do servidor cobre).
  if (error) return true;
  return (data as { ok?: boolean } | null)?.ok !== false;
}

/**
 * Envia as fotos novas (locais) para o Storage, passa cada uma pela moderação e devolve
 * todas como URLs públicas, na mesma ordem. Se alguma for recusada, nada é salvo e o erro
 * diz quais fotos tirar.
 */
async function uploadPhotos(userId: string, photos: string[]): Promise<string[]> {
  const uploaded: string[] = [];
  const rejected: string[] = [];
  const result: string[] = [];
  for (const uri of photos) {
    if (isRemote(uri)) {
      result.push(uri);
      continue;
    }
    const path = `${userId}/${Crypto.randomUUID()}.jpg`;
    const { error } = await db()
      .storage.from(BUCKET)
      .upload(path, await readBytes(uri), { contentType: 'image/jpeg' });
    if (error) {
      await removePhotos(uploaded).catch(() => {});
      fail(error);
    }
    const url = db().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    if (await moderate(path)) {
      uploaded.push(url);
      result.push(url);
    } else {
      rejected.push(uri);
    }
  }
  if (rejected.length) {
    await removePhotos(uploaded).catch(() => {});
    throw new BackendError(
      rejected.length === 1
        ? 'Uma foto foi recusada pela moderação (nudez, violência ou símbolo de ódio) e foi removida. Escolha outra.'
        : `${rejected.length} fotos foram recusadas pela moderação e foram removidas. Escolha outras.`,
      'photo_rejected',
      rejected,
    );
  }
  return result;
}

const storagePath = (url: string) => (url.includes(PUBLIC_PREFIX) ? url.split(PUBLIC_PREFIX)[1] : null);

async function removePhotos(urls: string[]) {
  const paths = urls.map(storagePath).filter((p): p is string => !!p);
  if (paths.length) await db().storage.from(BUCKET).remove(paths);
}

// -------------------------------------------------------- login social

const redirectUrl = () => Linking.createURL('/auth-callback');

async function sessionFromUrl(url: string): Promise<boolean> {
  const parsed = new URL(url);
  const fragment = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  const errorDescription = parsed.searchParams.get('error_description') ?? fragment.get('error_description');
  if (errorDescription) throw new BackendError(errorDescription.replace(/\+/g, ' '), 'auth');

  const code = parsed.searchParams.get('code');
  if (code) {
    const { error } = await db().auth.exchangeCodeForSession(code);
    if (error) fail(error);
    return true;
  }
  const access_token = fragment.get('access_token');
  const refresh_token = fragment.get('refresh_token');
  if (access_token && refresh_token) {
    const { error } = await db().auth.setSession({ access_token, refresh_token });
    if (error) fail(error);
    return true;
  }
  return false;
}

// ------------------------------------------------------------- backend

export const supabaseBackend: Backend = {
  mode: 'supabase',

  onAuthChange(callback) {
    const { data } = db().auth.onAuthStateChange((_event, session) => {
      const account = session ? { id: session.user.id, email: session.user.email ?? '' } : null;
      currentUserId = account?.id ?? null;
      // O Supabase pede para não chamar outras funções dele dentro deste callback.
      setTimeout(() => callback(account), 0);
    });
    return () => data.subscription.unsubscribe();
  },

  async signUp(email, password) {
    const { data, error } = await db().auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: redirectUrl() },
    });
    if (error) fail(error);
    return data.session ? { status: 'signedIn' } : { status: 'confirmEmail' };
  },

  async signIn(email, password) {
    const { data, error } = await db().auth.signInWithPassword({ email: email.trim(), password });
    if (error) fail(error);
    currentUserId = data.user.id;
    return { id: data.user.id, email: data.user.email ?? email };
  },

  async signInWithProvider(provider) {
    if (Platform.OS === 'web') {
      // No navegador a página é redirecionada e volta já logada.
      const { error } = await db().auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } });
      if (error) fail(error);
      return true;
    }
    const redirectTo = redirectUrl();
    const { data, error } = await db().auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) fail(error);
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') return false;
    return sessionFromUrl(result.url);
  },

  completeAuthRedirect: sessionFromUrl,

  async sendPasswordReset(email) {
    const { error } = await db().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: Linking.createURL('/reset-password'),
    });
    if (error) fail(error);
  },

  async updatePassword(password) {
    const { error } = await db().auth.updateUser({ password });
    if (error) fail(error);
  },

  async signOut() {
    const { error } = await db().auth.signOut();
    if (error) fail(error);
  },

  async deleteAccount() {
    const userId = await requireUserId();
    const { data: files } = await db().storage.from(BUCKET).list(userId);
    if (files?.length) await db().storage.from(BUCKET).remove(files.map((f) => `${userId}/${f.name}`));
    const { error } = await db().rpc('delete_account');
    if (error) fail(error);
    await db().auth.signOut({ scope: 'local' });
  },

  async loadProfile(account) {
    const { data, error } = await db().from('profiles').select('*').eq('id', account.id).maybeSingle<ProfileRow>();
    if (error) fail(error);
    return data ? toUser(data, account.email) : null;
  },

  async createProfile(account, draft, prefs) {
    const photos = await uploadPhotos(account.id, draft.photos);
    const { data, error } = await db()
      .from('profiles')
      .insert({ id: account.id, ...toRow({ ...draft, photos }) })
      .select('*')
      .single<ProfileRow>();
    if (error) {
      await removePhotos(photos).catch(() => {});
      fail(error);
    }
    await supabaseBackend.savePrefs(account, prefs);
    return toUser(data, account.email);
  },

  async updateProfile(current, changes) {
    const next = { ...changes };
    // A data de nascimento não pode mudar depois do cadastro.
    delete next.birthdate;
    if (changes.photos) next.photos = await uploadPhotos(current.id, changes.photos);

    const { data, error } = await db()
      .from('profiles')
      .update(toRow(next))
      .eq('id', current.id)
      .select('*')
      .single<ProfileRow>();
    if (error) fail(error);

    if (next.photos) {
      const removed = current.photos.filter((url) => !next.photos!.includes(url));
      await removePhotos(removed).catch(() => {});
    }
    return toUser(data, current.email);
  },

  async loadPrefs(account) {
    const { data, error } = await db()
      .from('preferences')
      .select('age_min, age_max, max_distance_km')
      .eq('user_id', account.id)
      .maybeSingle();
    if (error) fail(error);
    return data ? { ageMin: data.age_min, ageMax: data.age_max, maxDistanceKm: data.max_distance_km } : DEFAULT_PREFS;
  },

  async savePrefs(account, prefs: DiscoveryPrefs) {
    const { error } = await db().from('preferences').upsert({
      user_id: account.id,
      age_min: prefs.ageMin,
      age_max: prefs.ageMax,
      max_distance_km: prefs.maxDistanceKm,
    });
    if (error) fail(error);
  },

  async loadPlan() {
    // my_plan() considera a assinatura da loja e os prêmios (ex.: Gold ganho por convite).
    const { data, error } = await db().rpc('my_plan');
    if (error) fail(error);
    return ((data as { plan: Plan }[])[0]?.plan ?? 'free') as Plan;
  },

  async loadUsage(): Promise<Usage> {
    const { data, error } = await db().rpc('my_usage');
    if (error) fail(error);
    const row = (data as { plan: Plan; likes_left: number | null; supers_left: number; resets_at: string; can_rewind: boolean }[])[0];
    return {
      plan: row.plan,
      likesLeft: row.likes_left,
      supersLeft: row.supers_left,
      resetsAt: row.resets_at,
      canRewind: row.can_rewind,
    };
  },

  async rewind() {
    const { data, error } = await db().rpc('rewind');
    if (error) fail(error);
    const row = (data as CardRow[])[0];
    if (!row) throw new BackendError('Não há nenhum perfil para voltar');
    return toCard(row);
  },

  async fetchDeck(scope) {
    const { data, error } = await db().rpc('get_deck', { p_scope: scope, p_limit: 20 });
    if (error) fail(error);
    return (data as CardRow[]).map(toCard);
  },

  async swipe(target, direction) {
    const { data, error } = await db().rpc('swipe', { p_target: target.id, p_direction: direction });
    if (error) fail(error);
    const row = (data as { matched: boolean; match_id: string | null }[])[0];
    return { matched: Boolean(row?.matched), matchId: row?.match_id ?? null };
  },

  async fetchConversations() {
    const { data, error } = await db().rpc('get_matches');
    if (error) fail(error);
    return (data as ConversationRow[]).map(toConversation);
  },

  async likesYouCount() {
    const { data, error } = await db().rpc('likes_you_count');
    if (error) fail(error);
    return data as number;
  },

  async fetchLikesYou() {
    const { data, error } = await db().rpc('get_likes_you');
    if (error) fail(error);
    return (data as CardRow[]).map(toCard);
  },

  // ------------------------------------------------------------- chat

  async fetchMessages(matchId, before) {
    let query = db()
      .from('messages')
      .select('*')
      .eq('match_id', matchId)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);
    if (before) query = query.lt('created_at', before);
    const { data, error } = await query;
    if (error) fail(error);
    return (data as MessageRow[]).map(toMessage);
  },

  async sendMessage({ id, matchId, kind, body, mediaUrl, mediaMeta }) {
    const { data, error } = await db()
      .from('messages')
      .insert({ id, match_id: matchId, kind, body, media_url: mediaUrl, media_meta: mediaMeta })
      .select('*')
      .single<MessageRow>();
    if (error) fail(error);
    return toMessage(data);
  },

  async uploadChatMedia(matchId, localUri, kind, mimeType) {
    const ext = kind === 'image' ? 'jpg' : mimeType.includes('webm') ? 'webm' : mimeType.includes('ogg') ? 'ogg' : 'm4a';
    const path = `${matchId}/${Crypto.randomUUID()}.${ext}`;
    const { error } = await db()
      .storage.from(CHAT_BUCKET)
      .upload(path, await readBytes(localUri), { contentType: mimeType });
    if (error) fail(error);
    return path;
  },

  async mediaUrl(pathOrUrl) {
    if (isRemote(pathOrUrl) || !pathOrUrl.includes('/') || /^(blob|file|data):/.test(pathOrUrl)) return pathOrUrl;
    const cached = signedUrls.get(pathOrUrl);
    if (cached && cached.expires > Date.now()) return cached.url;
    const { data, error } = await db().storage.from(CHAT_BUCKET).createSignedUrl(pathOrUrl, SIGNED_URL_SECONDS);
    if (error) fail(error);
    signedUrls.set(pathOrUrl, { url: data.signedUrl, expires: Date.now() + (SIGNED_URL_SECONDS - 60) * 1000 });
    return data.signedUrl;
  },

  async markRead(matchId) {
    const { error } = await db().rpc('mark_read', { p_match: matchId });
    if (error) fail(error);
  },

  openChat(matchId, events) {
    const filter = `match_id=eq.${matchId}`;
    const channel = db()
      .channel(`chat:${matchId}`, { config: { broadcast: { self: false } } })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter }, (payload) =>
        events.onMessage(toMessage(payload.new as MessageRow)),
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter }, (payload) => {
        const row = payload.new as MessageRow;
        if (row.read_at) events.onRead([row.id], row.read_at);
      })
      .on('broadcast', { event: 'typing' }, () => events.onTyping())
      .subscribe();

    let lastTyping = 0;
    return {
      sendTyping: () => {
        // No máximo um aviso a cada 2 s, para não sobrecarregar o canal.
        if (Date.now() - lastTyping < 2000) return;
        lastTyping = Date.now();
        channel.send({ type: 'broadcast', event: 'typing', payload: {} });
      },
      close: () => {
        db().removeChannel(channel);
      },
    };
  },

  subscribeInbox(onChange) {
    // O RLS garante que só chegam eventos das conversas desta pessoa.
    const channel = db()
      .channel(`inbox:${Crypto.randomUUID()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const row = payload.new as MessageRow;
        onChange({ type: 'message', matchId: row.match_id, fromMe: row.sender_id === currentUserId });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'matches' }, (payload) =>
        onChange({ type: 'match', matchId: (payload.new as { id: string }).id, fromMe: false }),
      )
      .subscribe();
    return () => {
      db().removeChannel(channel);
    };
  },

  async unmatch(matchId) {
    const { error } = await db().rpc('unmatch', { p_match: matchId });
    if (error) fail(error);
  },

  async report(profileId, reason, details) {
    const { error } = await db().from('reports').insert({ reported_id: profileId, reason, details: details.trim() });
    if (error) fail(error);
  },

  async blockUser(profileId) {
    const { error } = await db().rpc('block_user', { p_target: profileId });
    if (error) fail(error);
  },

  // ------------------------------------------------- passaporte e boost

  async getPassport() {
    const { data, error } = await db().from('passports').select('city, state, country, lat, lng').maybeSingle<Passport>();
    if (error) fail(error);
    return data;
  },

  async setPassport(passport) {
    const userId = await requireUserId();
    const { error } = passport
      ? await db().from('passports').upsert({ user_id: userId, ...passport, updated_at: new Date().toISOString() })
      : await db().from('passports').delete().eq('user_id', userId);
    if (error) fail(error);
  },

  async boostStatus() {
    const { data, error } = await db().rpc('boost_status');
    if (error) fail(error);
    const row = (data as { active_until: string | null; left_this_month: number }[])[0];
    return { activeUntil: row?.active_until ?? null, leftThisMonth: row?.left_this_month ?? 0 };
  },

  async activateBoost() {
    const { data, error } = await db().rpc('activate_boost');
    if (error) fail(error);
    return data as string;
  },

  // ---------------------------------------------------- notificações

  async registerPushToken(token, platform) {
    const { error } = await db().rpc('register_push_token', { p_token: token, p_platform: platform });
    if (error) fail(error);
  },

  async unregisterPushToken(token) {
    const { error } = await db().rpc('unregister_push_token', { p_token: token });
    if (error) fail(error);
  },

  async loadNotificationSettings() {
    const { data, error } = await db().from('notification_settings').select('new_matches, messages').maybeSingle();
    if (error) fail(error);
    return { newMatches: data?.new_matches ?? true, messages: data?.messages ?? true };
  },

  async saveNotificationSettings(settings) {
    const userId = await requireUserId();
    const { error } = await db().from('notification_settings').upsert({
      user_id: userId,
      new_matches: settings.newMatches,
      messages: settings.messages,
      updated_at: new Date().toISOString(),
    });
    if (error) fail(error);
  },

  // ------------------------------------------------------------ convites

  async getInvite() {
    const { data, error } = await db().rpc('my_invite');
    if (error) fail(error);
    const row = (data as { code: string; invited: number; rewards_earned: number; next_reward_in: number }[])[0];
    return { code: row.code, invited: row.invited, rewardsEarned: row.rewards_earned, nextRewardIn: row.next_reward_in };
  },

  async redeemInvite(code) {
    const { data, error } = await db().rpc('redeem_invite', { p_code: normalizeInviteCode(code) });
    if (error) fail(error);
    return data as RedeemResult;
  },

  // -------------------------------------------------------- verificação

  async verificationStatus() {
    const { data, error } = await db()
      .from('verification_requests')
      .select('status')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) fail(error);
    return (data?.status as VerificationStatus | undefined) ?? 'none';
  },

  async submitVerification(selfieUri, pose) {
    const userId = await requireUserId();
    const path = `${userId}/${Crypto.randomUUID()}.jpg`;
    const upload = await db()
      .storage.from('verifications')
      .upload(path, await readBytes(selfieUri), { contentType: 'image/jpeg' });
    if (upload.error) fail(upload.error);
    const { error } = await db().from('verification_requests').insert({ user_id: userId, pose, photo_path: path });
    if (error) {
      if (error.code === '23505') throw new BackendError('Você já tem uma verificação em análise.');
      fail(error);
    }
  },
};

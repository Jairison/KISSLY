import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import type { AuthError, PostgrestError, SupabaseClient } from '@supabase/supabase-js';

import { flagFor } from '@/data/catalog';
import { supabase as client } from '@/lib/supabase';
import {
  DEFAULT_PREFS,
  type DiscoveryPrefs,
  type Gender,
  type Plan,
  type Profile,
  type ShowMe,
  type UserProfile,
} from '@/types/user';

import { BackendError, type Account, type Backend, type ProfileDraft } from './types';

WebBrowser.maybeCompleteAuthSession();

const BUCKET = 'photos';
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
  if (hint === 'premium_required') throw new BackendError(error.message, 'premium_required');
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

/** Envia as fotos novas (locais) para o Storage e devolve todas como URLs públicas, na mesma ordem. */
async function uploadPhotos(userId: string, photos: string[]): Promise<string[]> {
  return Promise.all(
    photos.map(async (uri) => {
      if (isRemote(uri)) return uri;
      const path = `${userId}/${Crypto.randomUUID()}.jpg`;
      const { error } = await db()
        .storage.from(BUCKET)
        .upload(path, await readBytes(uri), { contentType: 'image/jpeg' });
      if (error) fail(error);
      return db().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    }),
  );
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

  async loadPlan(account) {
    const { data, error } = await db()
      .from('subscriptions')
      .select('plan, expires_at')
      .eq('user_id', account.id)
      .maybeSingle();
    if (error) fail(error);
    if (!data || (data.expires_at && new Date(data.expires_at) < new Date())) return 'free';
    return data.plan as Plan;
  },

  async fetchDeck(scope) {
    const { data, error } = await db().rpc('get_deck', { p_scope: scope, p_limit: 20 });
    if (error) fail(error);
    return (data as CardRow[]).map(toCard);
  },

  async swipe(target, direction) {
    const { data, error } = await db().rpc('swipe', { p_target: target.id, p_direction: direction });
    if (error) fail(error);
    return { matched: Boolean((data as { matched: boolean }[])[0]?.matched) };
  },

  async fetchMatches() {
    const { data, error } = await db().rpc('get_matches');
    if (error) fail(error);
    return (data as CardRow[]).map(toCard);
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
};

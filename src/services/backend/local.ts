// Backend de demonstração: tudo salvo no aparelho e perfis fictícios.
// Usado automaticamente enquanto o Supabase não estiver configurado no .env.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import { LIMITS } from '@/data/plans';
import { buildDeck, profiles as demoProfiles } from '@/data/profiles';
import { readDemoPlan } from '@/services/payments/demo';
import type { ChatEvents, Conversation, Message } from '@/types/chat';
import { DEFAULT_PREFS, isPremium, type DiscoveryPrefs, type Plan, type Profile, type UserProfile } from '@/types/user';

import { BackendError, type Account, type Backend } from './types';

type StoredAccount = Account & { salt: string; passwordHash: string };

const KEYS = {
  accounts: 'kissly.accounts',
  session: 'kissly.session',
  profile: (id: string) => `kissly.profile.${id}`,
  prefs: (id: string) => `kissly.prefs.${id}`,
};

const normalize = (email: string) => email.trim().toLowerCase();
const hashPassword = (password: string, salt: string) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${password}`);

async function readJSON<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : null;
}
const writeJSON = (key: string, value: unknown) => AsyncStorage.setItem(key, JSON.stringify(value));
const readAccounts = async () => (await readJSON<Record<string, StoredAccount>>(KEYS.accounts)) ?? {};

const listeners = new Set<(account: Account | null) => void>();
let current: Account | null = null;
/** Swipes da sessão atual (os perfis voltam ao reabrir o app, de propósito, para a demonstração). */
const swiped = new Set<string>();
/** Histórico do dia (para os limites do plano e para voltar perfil). */
let history: { profile: Profile; direction: 'like' | 'nope' | 'super'; at: number }[] = [];

function dayStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
const countToday = (direction: 'like' | 'super') =>
  history.filter((h) => h.direction === direction && h.at >= dayStart()).length;

const currentPlan = (): Promise<Plan> => (current ? readDemoPlan(current.id) : Promise.resolve('free'));

// ---- chat de demonstração (em memória)
type LocalMatch = { matchId: string; matchedAt: string; profile: Profile; replies: number };
const matches: LocalMatch[] = [];
const messages = new Map<string, Message[]>();
const chatListeners = new Map<string, Set<ChatEvents>>();
const inboxListeners = new Set<(e: { type: 'message' | 'match'; matchId: string; fromMe: boolean }) => void>();

const DEMO_REPLIES = [
  'Oii! Que bom que você puxou assunto 😊',
  'Haha adorei! E o que você gosta de fazer no fim de semana?',
  'Sério? Me conta mais, fiquei curiosa(o)!',
  'A gente tem bastante coisa em comum, né?',
  'Topa um café essa semana? ☕',
];

function emitMessage(message: Message, fromMe: boolean) {
  const list = messages.get(message.matchId) ?? [];
  messages.set(message.matchId, [message, ...list]);
  chatListeners.get(message.matchId)?.forEach((l) => l.onMessage(message));
  inboxListeners.forEach((l) => l({ type: 'message', matchId: message.matchId, fromMe }));
}

/** O perfil fictício “lê”, mostra digitando e responde, para dar vida à demonstração. */
function scheduleDemoReply(match: LocalMatch) {
  if (match.replies >= DEMO_REPLIES.length) return;
  const reply = DEMO_REPLIES[match.replies++];
  setTimeout(() => {
    const readAt = new Date().toISOString();
    const mine = (messages.get(match.matchId) ?? []).filter((m) => m.senderId !== match.profile.id && !m.readAt);
    mine.forEach((m) => (m.readAt = readAt));
    chatListeners.get(match.matchId)?.forEach((l) => l.onRead(mine.map((m) => m.id), readAt));
  }, 900);
  setTimeout(() => chatListeners.get(match.matchId)?.forEach((l) => l.onTyping()), 1400);
  setTimeout(() => {
    emitMessage(
      {
        id: Crypto.randomUUID(),
        matchId: match.matchId,
        senderId: match.profile.id,
        body: reply,
        createdAt: new Date().toISOString(),
        readAt: null,
      },
      false,
    );
  }, 3200);
}

function setCurrent(account: Account | null) {
  current = account;
  swiped.clear();
  history = [];
  matches.length = 0;
  messages.clear();
  listeners.forEach((cb) => cb(account));
}

function requireAccount(): Account {
  if (!current) throw new BackendError('Sessão expirada. Entre novamente.', 'auth');
  return current;
}

async function loadOwn() {
  const account = requireAccount();
  const [profile, prefs] = await Promise.all([
    readJSON<UserProfile>(KEYS.profile(account.id)),
    readJSON<DiscoveryPrefs>(KEYS.prefs(account.id)),
  ]);
  if (!profile) throw new BackendError('Perfil não encontrado', 'unknown');
  return { profile, prefs: prefs ?? DEFAULT_PREFS };
}

const notAvailable = (what: string) =>
  new BackendError(`${what} fica disponível depois de conectar o Supabase.`, 'not_available');

export const localBackend: Backend = {
  mode: 'local',

  onAuthChange(callback) {
    listeners.add(callback);
    readJSON<Account>(KEYS.session).then((account) => {
      current = account;
      callback(account);
    });
    return () => listeners.delete(callback);
  },

  async signUp(email, password) {
    const accounts = await readAccounts();
    const key = normalize(email);
    if (accounts[key]) throw new BackendError('Já existe uma conta com este e-mail.', 'auth');
    const salt = Crypto.randomUUID();
    const stored: StoredAccount = {
      id: Crypto.randomUUID(),
      email: key,
      salt,
      passwordHash: await hashPassword(password, salt),
    };
    await writeJSON(KEYS.accounts, { ...accounts, [key]: stored });
    const account = { id: stored.id, email: stored.email };
    await writeJSON(KEYS.session, account);
    setCurrent(account);
    return { status: 'signedIn' };
  },

  async signIn(email, password) {
    const stored = (await readAccounts())[normalize(email)];
    if (!stored || (await hashPassword(password, stored.salt)) !== stored.passwordHash) {
      throw new BackendError('E-mail ou senha incorretos.', 'auth');
    }
    const account = { id: stored.id, email: stored.email };
    await writeJSON(KEYS.session, account);
    setCurrent(account);
    return account;
  },

  async signInWithProvider(provider) {
    throw notAvailable(provider === 'apple' ? 'O login com Apple' : 'O login com Google');
  },
  async completeAuthRedirect() {
    return false;
  },
  async sendPasswordReset() {
    throw notAvailable('A recuperação de senha');
  },
  async updatePassword() {
    throw notAvailable('A troca de senha');
  },

  async signOut() {
    await AsyncStorage.removeItem(KEYS.session);
    setCurrent(null);
  },

  async deleteAccount() {
    const account = requireAccount();
    const accounts = await readAccounts();
    delete accounts[account.email];
    await writeJSON(KEYS.accounts, accounts);
    await AsyncStorage.multiRemove([KEYS.session, KEYS.profile(account.id), KEYS.prefs(account.id)]);
    setCurrent(null);
  },

  loadProfile: (account) => readJSON<UserProfile>(KEYS.profile(account.id)),

  async createProfile(account, draft, prefs) {
    const profile: UserProfile = { ...draft, id: account.id, email: account.email };
    await Promise.all([writeJSON(KEYS.profile(account.id), profile), writeJSON(KEYS.prefs(account.id), prefs)]);
    return profile;
  },

  async updateProfile(currentProfile, changes) {
    const next = { ...currentProfile, ...changes };
    await writeJSON(KEYS.profile(next.id), next);
    return next;
  },

  loadPrefs: async (account) => (await readJSON<DiscoveryPrefs>(KEYS.prefs(account.id))) ?? DEFAULT_PREFS,
  savePrefs: (account, prefs) => writeJSON(KEYS.prefs(account.id), prefs),
  loadPlan: (account) => readDemoPlan(account.id),

  async loadUsage() {
    const plan = await currentPlan();
    const limits = LIMITS[plan];
    return {
      plan,
      likesLeft: limits.dailyLikes === null ? null : Math.max(0, limits.dailyLikes - countToday('like')),
      supersLeft: Math.max(0, limits.dailySupers - countToday('super')),
      resetsAt: new Date(dayStart() + 86_400_000).toISOString(),
      canRewind: limits.canRewind,
    };
  },

  async rewind() {
    if (!LIMITS[await currentPlan()].canRewind) {
      throw new BackendError('Voltar perfis é um recurso do Kissly Plus', 'premium_required');
    }
    const last = history[history.length - 1];
    if (!last) throw new BackendError('Não há nenhum perfil para voltar');
    if (last.direction !== 'nope') throw new BackendError('Só dá para voltar perfis que você passou');
    history.pop();
    swiped.delete(last.profile.id);
    return last.profile;
  },

  async fetchDeck(scope) {
    if (scope === 'international' && !isPremium(await currentPlan())) {
      throw new BackendError('O modo Internacional é exclusivo do Kissly Gold', 'premium_required');
    }
    const { profile, prefs } = await loadOwn();
    return buildDeck(demoProfiles, profile, prefs, scope).filter((p) => !swiped.has(p.id));
  },

  async swipe(target, direction) {
    const limits = LIMITS[await currentPlan()];
    if (direction === 'like' && limits.dailyLikes !== null && countToday('like') >= limits.dailyLikes) {
      throw new BackendError('Você usou todos os seus Kiss de hoje', 'limit_likes');
    }
    if (direction === 'super' && countToday('super') >= limits.dailySupers) {
      throw new BackendError('Você usou todos os seus Super Likes de hoje', 'limit_super');
    }
    swiped.add(target.id);
    history.push({ profile: target, direction, at: Date.now() });
    const matched = direction !== 'nope' && !!target.likesYou;
    if (!matched) return { matched, matchId: null };
    const matchId = `local-${target.id}`;
    matches.unshift({ matchId, matchedAt: new Date().toISOString(), profile: target, replies: 0 });
    return { matched, matchId };
  },

  async fetchConversations() {
    const list: Conversation[] = matches.map((m) => {
      const msgs = messages.get(m.matchId) ?? [];
      const last = msgs[0];
      return {
        matchId: m.matchId,
        matchedAt: m.matchedAt,
        profile: m.profile,
        lastMessage: last?.body ?? null,
        lastMessageAt: last?.createdAt ?? null,
        lastFromMe: last ? last.senderId !== m.profile.id : false,
        unread: msgs.filter((msg) => msg.senderId === m.profile.id && !msg.readAt).length,
      };
    });
    return list.sort((a, b) => (b.lastMessageAt ?? b.matchedAt).localeCompare(a.lastMessageAt ?? a.matchedAt));
  },

  async likesYouCount() {
    return demoProfiles.filter((p) => p.likesYou && !swiped.has(p.id)).length;
  },

  async fetchLikesYou() {
    if (!isPremium(await currentPlan())) {
      throw new BackendError('Ver quem curtiu você é exclusivo do Kissly Gold', 'premium_required');
    }
    return demoProfiles.filter((p) => p.likesYou && !swiped.has(p.id));
  },

  async fetchMessages(matchId, before) {
    const all = messages.get(matchId) ?? [];
    return (before ? all.filter((m) => m.createdAt < before) : all).slice(0, 30);
  },

  async sendMessage({ id, matchId, body }) {
    const account = requireAccount();
    const match = matches.find((m) => m.matchId === matchId);
    if (!match) throw new BackendError('Essa conversa não existe mais.');
    const message: Message = { id, matchId, senderId: account.id, body, createdAt: new Date().toISOString(), readAt: null };
    emitMessage(message, true);
    scheduleDemoReply(match);
    return message;
  },

  async markRead(matchId) {
    const now = new Date().toISOString();
    const match = matches.find((m) => m.matchId === matchId);
    (messages.get(matchId) ?? []).forEach((m) => {
      if (m.senderId === match?.profile.id && !m.readAt) m.readAt = now;
    });
  },

  openChat(matchId, events) {
    const set = chatListeners.get(matchId) ?? new Set();
    set.add(events);
    chatListeners.set(matchId, set);
    return { sendTyping: () => {}, close: () => set.delete(events) };
  },

  subscribeInbox(onChange) {
    inboxListeners.add(onChange);
    return () => inboxListeners.delete(onChange);
  },

  async unmatch(matchId) {
    const index = matches.findIndex((m) => m.matchId === matchId);
    if (index >= 0) matches.splice(index, 1);
    messages.delete(matchId);
  },

  async report() {
    // No modo demonstração não há moderação; a denúncia é apenas aceita.
  },
};

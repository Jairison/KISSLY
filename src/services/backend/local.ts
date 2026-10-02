// Backend de demonstração: tudo salvo no aparelho e perfis fictícios.
// Usado automaticamente enquanto o Supabase não estiver configurado no .env.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import { buildDeck, profiles as demoProfiles } from '@/data/profiles';
import { DEFAULT_PREFS, type DiscoveryPrefs, type Profile, type UserProfile } from '@/types/user';

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
const matches: Profile[] = [];

function setCurrent(account: Account | null) {
  current = account;
  swiped.clear();
  matches.length = 0;
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
  loadPlan: async () => 'free',

  async fetchDeck(scope) {
    if (scope === 'international') {
      throw new BackendError('O modo Internacional é exclusivo do Kissly Gold', 'premium_required');
    }
    const { profile, prefs } = await loadOwn();
    return buildDeck(demoProfiles, profile, prefs, scope).filter((p) => !swiped.has(p.id));
  },

  async swipe(target, direction) {
    swiped.add(target.id);
    const matched = direction !== 'nope' && !!target.likesYou;
    if (matched) matches.unshift(target);
    return { matched };
  },

  async fetchMatches() {
    return [...matches];
  },

  async likesYouCount() {
    return demoProfiles.filter((p) => p.likesYou && !swiped.has(p.id)).length;
  },

  async fetchLikesYou() {
    throw new BackendError('Ver quem curtiu você é exclusivo do Kissly Gold', 'premium_required');
  },
};

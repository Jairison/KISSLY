// Autenticação e perfil salvos localmente no aparelho.
// Na Parte 3 este arquivo passa a chamar o Supabase, mantendo as mesmas funções.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import { DEFAULT_PREFS, type DiscoveryPrefs, type UserProfile } from '@/types/user';

export type Account = { id: string; email: string };

type StoredAccount = Account & { salt: string; passwordHash: string };

const KEYS = {
  accounts: 'kissly.accounts',
  session: 'kissly.session',
  profile: (id: string) => `kissly.profile.${id}`,
  prefs: (id: string) => `kissly.prefs.${id}`,
};

export class AuthError extends Error {}

export const PASSWORD_MIN = 8;

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

const normalize = (email: string) => email.trim().toLowerCase();

function hashPassword(password: string, salt: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${password}`);
}

async function readJSON<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

async function writeJSON(key: string, value: unknown) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

async function readAccounts() {
  return (await readJSON<Record<string, StoredAccount>>(KEYS.accounts)) ?? {};
}

export async function signUp(email: string, password: string): Promise<Account> {
  if (!isValidEmail(email)) throw new AuthError('Digite um e-mail válido.');
  if (password.length < PASSWORD_MIN) throw new AuthError(`A senha precisa ter pelo menos ${PASSWORD_MIN} caracteres.`);

  const accounts = await readAccounts();
  const key = normalize(email);
  if (accounts[key]) throw new AuthError('Já existe uma conta com este e-mail.');

  const salt = Crypto.randomUUID();
  const stored: StoredAccount = {
    id: Crypto.randomUUID(),
    email: key,
    salt,
    passwordHash: await hashPassword(password, salt),
  };
  await writeJSON(KEYS.accounts, { ...accounts, [key]: stored });
  await writeJSON(KEYS.session, { id: stored.id, email: stored.email });
  return { id: stored.id, email: stored.email };
}

export async function signIn(email: string, password: string): Promise<Account> {
  const stored = (await readAccounts())[normalize(email)];
  if (!stored || (await hashPassword(password, stored.salt)) !== stored.passwordHash) {
    throw new AuthError('E-mail ou senha incorretos.');
  }
  const account = { id: stored.id, email: stored.email };
  await writeJSON(KEYS.session, account);
  return account;
}

export async function signOut() {
  await AsyncStorage.removeItem(KEYS.session);
}

export function getSession() {
  return readJSON<Account>(KEYS.session);
}

export function loadProfile(id: string) {
  return readJSON<UserProfile>(KEYS.profile(id));
}

export function saveProfile(profile: UserProfile) {
  return writeJSON(KEYS.profile(profile.id), profile);
}

export async function loadPrefs(id: string): Promise<DiscoveryPrefs> {
  return (await readJSON<DiscoveryPrefs>(KEYS.prefs(id))) ?? DEFAULT_PREFS;
}

export function savePrefs(id: string, prefs: DiscoveryPrefs) {
  return writeJSON(KEYS.prefs(id), prefs);
}

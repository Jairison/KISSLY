import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import * as auth from '@/services/auth';
import { DEFAULT_PREFS, type DiscoveryPrefs, type UserProfile } from '@/types/user';

/**
 * loading    → lendo a sessão salva
 * signedOut  → mostra boas-vindas / login / cadastro
 * onboarding → conta criada, perfil ainda incompleto
 * ready      → app liberado
 */
export type SessionStatus = 'loading' | 'signedOut' | 'onboarding' | 'ready';

export type ProfileDraft = Omit<UserProfile, 'id' | 'email'>;

type SessionState = {
  status: SessionStatus;
  account: auth.Account | null;
  profile: UserProfile | null;
  prefs: DiscoveryPrefs;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  completeOnboarding: (draft: ProfileDraft, prefs: DiscoveryPrefs) => Promise<void>;
  updateProfile: (changes: Partial<ProfileDraft>) => Promise<void>;
  updatePrefs: (prefs: DiscoveryPrefs) => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [account, setAccount] = useState<auth.Account | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [prefs, setPrefs] = useState<DiscoveryPrefs>(DEFAULT_PREFS);

  const enter = useCallback(async (acc: auth.Account) => {
    const [savedProfile, savedPrefs] = await Promise.all([auth.loadProfile(acc.id), auth.loadPrefs(acc.id)]);
    setAccount(acc);
    setProfile(savedProfile);
    setPrefs(savedPrefs);
    setStatus(savedProfile ? 'ready' : 'onboarding');
  }, []);

  useEffect(() => {
    auth
      .getSession()
      .then((acc) => (acc ? enter(acc) : setStatus('signedOut')))
      .catch(() => setStatus('signedOut'));
  }, [enter]);

  const value = useMemo<SessionState>(
    () => ({
      status,
      account,
      profile,
      prefs,
      signUp: async (email, password) => enter(await auth.signUp(email, password)),
      signIn: async (email, password) => enter(await auth.signIn(email, password)),
      signOut: async () => {
        await auth.signOut();
        setAccount(null);
        setProfile(null);
        setPrefs(DEFAULT_PREFS);
        setStatus('signedOut');
      },
      completeOnboarding: async (draft, newPrefs) => {
        if (!account) throw new Error('Sem conta ativa');
        const full: UserProfile = { ...draft, id: account.id, email: account.email };
        await Promise.all([auth.saveProfile(full), auth.savePrefs(account.id, newPrefs)]);
        setProfile(full);
        setPrefs(newPrefs);
        setStatus('ready');
      },
      updateProfile: async (changes) => {
        if (!profile) return;
        const next = { ...profile, ...changes };
        await auth.saveProfile(next);
        setProfile(next);
      },
      updatePrefs: async (newPrefs) => {
        if (!account) return;
        await auth.savePrefs(account.id, newPrefs);
        setPrefs(newPrefs);
      },
    }),
    [status, account, profile, prefs, enter],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession deve ser usado dentro de SessionProvider');
  return ctx;
}

/** Para telas que só existem com o perfil pronto (status "ready"). */
export function useCurrentUser() {
  const { profile } = useSession();
  if (!profile) throw new Error('Perfil não carregado');
  return profile;
}

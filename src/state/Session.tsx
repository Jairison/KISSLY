import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { backend, type Account, type ProfileDraft, type SignUpResult } from '@/services/backend';
import { DEFAULT_PREFS, type DiscoveryPrefs, type UserProfile } from '@/types/user';

/**
 * loading    → lendo a sessão salva
 * error      → não foi possível carregar o perfil (ex.: sem internet)
 * signedOut  → mostra boas-vindas / login / cadastro
 * onboarding → conta criada, perfil ainda incompleto
 * ready      → app liberado
 */
export type SessionStatus = 'loading' | 'error' | 'signedOut' | 'onboarding' | 'ready';

export type { ProfileDraft };

type State = {
  status: SessionStatus;
  account: Account | null;
  profile: UserProfile | null;
  prefs: DiscoveryPrefs;
};

type SessionValue = State & {
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  retry: () => void;
  completeOnboarding: (draft: ProfileDraft, prefs: DiscoveryPrefs) => Promise<void>;
  updateProfile: (changes: Partial<ProfileDraft>) => Promise<void>;
  updatePrefs: (prefs: DiscoveryPrefs) => Promise<void>;
};

const SIGNED_OUT: State = { status: 'signedOut', account: null, profile: null, prefs: DEFAULT_PREFS };

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ ...SIGNED_OUT, status: 'loading' });

  // Evita carregar o mesmo usuário duas vezes (ex.: login + evento de renovação do token).
  const currentId = useRef<string | null | undefined>(undefined);
  const pending = useRef<Promise<void>>(Promise.resolve());

  const load = useCallback(async (account: Account) => {
    try {
      const [profile, prefs] = await Promise.all([backend.loadProfile(account), backend.loadPrefs(account)]);
      setState({ status: profile ? 'ready' : 'onboarding', account, profile, prefs });
    } catch {
      setState({ ...SIGNED_OUT, status: 'error', account });
    }
  }, []);

  const handleAccount = useCallback(
    (account: Account | null) => {
      if ((account?.id ?? null) === currentId.current) return pending.current;
      currentId.current = account?.id ?? null;
      pending.current = account ? load(account) : Promise.resolve(setState(SIGNED_OUT));
      return pending.current;
    },
    [load],
  );

  useEffect(() => backend.onAuthChange(handleAccount), [handleAccount]);

  const value = useMemo<SessionValue>(() => {
    const { account, profile } = state;
    return {
      ...state,
      signUp: async (email, password) => {
        const result = await backend.signUp(email, password);
        await pending.current;
        return result;
      },
      signIn: async (email, password) => {
        await handleAccount(await backend.signIn(email, password));
      },
      signOut: async () => {
        await backend.signOut();
        await handleAccount(null);
      },
      deleteAccount: async () => {
        await backend.deleteAccount();
        await handleAccount(null);
      },
      retry: () => {
        if (!account) return;
        setState((s) => ({ ...s, status: 'loading' }));
        currentId.current = account.id;
        pending.current = load(account);
      },
      completeOnboarding: async (draft, prefs) => {
        if (!account) throw new Error('Sem conta ativa');
        const created = await backend.createProfile(account, draft, prefs);
        setState({ status: 'ready', account, profile: created, prefs });
      },
      updateProfile: async (changes) => {
        if (!profile) return;
        const next = await backend.updateProfile(profile, changes);
        setState((s) => ({ ...s, profile: next }));
      },
      updatePrefs: async (prefs) => {
        if (!account) return;
        await backend.savePrefs(account, prefs);
        setState((s) => ({ ...s, prefs }));
      },
    };
  }, [state, handleAccount, load]);

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

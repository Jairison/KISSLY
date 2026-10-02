import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { backend } from '@/services/backend';
import { useSession } from '@/state/Session';
import type { Plan, Profile } from '@/types/user';

type AppState = {
  plan: Plan;
  matches: Profile[];
  likesCount: number;
  addMatch: (profile: Profile) => void;
  /** Recarrega plano, matches e curtidas do servidor. */
  refresh: () => Promise<void>;
};

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const { status, account } = useSession();
  const [plan, setPlan] = useState<Plan>('free');
  const [matches, setMatches] = useState<Profile[]>([]);
  const [likesCount, setLikesCount] = useState(0);

  const refresh = useCallback(async () => {
    if (status !== 'ready' || !account) return;
    const [p, m, l] = await Promise.allSettled([
      backend.loadPlan(account),
      backend.fetchMatches(),
      backend.likesYouCount(),
    ]);
    if (p.status === 'fulfilled') setPlan(p.value);
    if (m.status === 'fulfilled') setMatches(m.value);
    if (l.status === 'fulfilled') setLikesCount(l.value);
  }, [status, account]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo<AppState>(
    () => ({
      plan,
      matches,
      likesCount,
      refresh,
      addMatch: (profile) => {
        setMatches((list) => (list.some((p) => p.id === profile.id) ? list : [profile, ...list]));
        setLikesCount((n) => Math.max(0, n - 1));
      },
    }),
    [plan, matches, likesCount, refresh],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState deve ser usado dentro de AppStateProvider');
  return ctx;
}

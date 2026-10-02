import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type { Profile } from '@/data/profiles';

export type Plan = 'free' | 'plus' | 'gold' | 'platinum';

type AppState = {
  plan: Plan;
  matches: Profile[];
  addMatch: (profile: Profile) => void;
};

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  // Na Parte 5 o plano virá da assinatura real (RevenueCat).
  const [plan] = useState<Plan>('free');
  const [matches, setMatches] = useState<Profile[]>([]);

  const value = useMemo<AppState>(
    () => ({
      plan,
      matches,
      addMatch: (profile) =>
        setMatches((list) => (list.some((p) => p.id === profile.id) ? list : [profile, ...list])),
    }),
    [plan, matches],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState deve ser usado dentro de AppStateProvider');
  return ctx;
}

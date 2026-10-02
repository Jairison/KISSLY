import { useCallback, useEffect, useRef, useState } from 'react';

import { BackendError, backend } from '@/services/backend';
import { useSession } from '@/state/Session';
import type { DiscoveryScope, Profile } from '@/types/user';

const REFILL_AT = 3;

/**
 * Fila de perfis da tela Descobrir. Recarrega quando o alcance, os filtros ou o
 * perfil mudam, e busca mais perfis quando restam poucos cards.
 */
export function useDeck(scope: DiscoveryScope) {
  const { prefs, profile } = useSession();
  const [queue, setQueue] = useState<Profile[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  const seen = useRef(new Set<string>());
  const fetching = useRef(false);
  const exhausted = useRef(false);
  // Respostas de buscas antigas (ex.: antes de trocar o alcance) são descartadas.
  const generation = useRef(0);

  const load = useCallback(
    async (reset: boolean) => {
      if (fetching.current && !reset) return;
      if (reset) {
        generation.current++;
        seen.current.clear();
        exhausted.current = false;
        setQueue([]);
        setStatus('loading');
      }
      const gen = generation.current;
      fetching.current = true;
      try {
        const batch = await backend.fetchDeck(scope);
        if (gen !== generation.current) return;
        const fresh = batch.filter((p) => !seen.current.has(p.id));
        fresh.forEach((p) => seen.current.add(p.id));
        if (fresh.length === 0) exhausted.current = true;
        setQueue((q) => (reset ? fresh : [...q, ...fresh]));
        setStatus('ready');
      } catch (e) {
        if (gen !== generation.current) return;
        setError(e instanceof BackendError ? e.message : 'Não foi possível carregar os perfis.');
        setStatus('error');
      } finally {
        if (gen === generation.current) fetching.current = false;
      }
    },
    [scope],
  );

  useEffect(() => {
    load(true);
  }, [load, prefs, profile?.showMe, profile?.state, profile?.country, profile?.lat, profile?.lng]);

  useEffect(() => {
    if (status === 'ready' && queue.length <= REFILL_AT && !exhausted.current) load(false);
  }, [queue.length, status, load]);

  return {
    queue,
    status,
    error,
    /** Remove o card do topo (depois de um swipe). */
    pop: () => setQueue((q) => q.slice(1)),
    /** Devolve um card ao topo (ex.: limite atingido ou voltar perfil). */
    unshift: (profile: Profile) => setQueue((q) => [profile, ...q.filter((p) => p.id !== profile.id)]),
    reload: () => load(true),
  };
}

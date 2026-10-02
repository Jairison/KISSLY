import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { useToast } from '@/components/Toast';
import { backend } from '@/services/backend';
import { payments } from '@/services/payments';
import { useSession } from '@/state/Session';
import { colors } from '@/theme';
import type { Conversation } from '@/types/chat';
import type { BoostStatus, Passport } from '@/types/extras';
import type { Plan, Profile, Usage } from '@/types/user';

type AppState = {
  plan: Plan;
  passport: Passport | null;
  setPassport: (passport: Passport | null) => Promise<void>;
  boost: BoostStatus | null;
  activateBoost: () => Promise<void>;
  /** Kiss e Super Likes restantes hoje (null até carregar). */
  usage: Usage | null;
  refreshUsage: () => Promise<void>;
  /** Depois de uma compra: aplica o plano novo na hora e recarrega o resto. */
  applyPlan: (plan: Plan) => void;
  /** Desconta um Kiss/Super Like do uso do dia, sem ir ao servidor. */
  consume: (kind: 'like' | 'super') => void;
  conversations: Conversation[];
  likesCount: number;
  /** Conversas com mensagens não lidas + matches que ainda não conversaram. */
  inboxBadge: number;
  addMatch: (profile: Profile, matchId: string) => void;
  removeConversation: (matchId: string) => void;
  /** Chamado pela tela de chat aberta, para não mostrar aviso de mensagem nova dela mesma. */
  setActiveChat: (matchId: string | null) => void;
  /** Zera as não lidas de uma conversa na lista (a tela de chat já avisou o servidor). */
  clearUnread: (matchId: string) => void;
  refresh: () => Promise<void>;
};

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const { status, account } = useSession();
  const { show } = useToast();
  const [plan, setPlan] = useState<Plan>('free');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [likesCount, setLikesCount] = useState(0);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [passport, setPassportState] = useState<Passport | null>(null);
  const [boost, setBoost] = useState<BoostStatus | null>(null);
  const activeChat = useRef<string | null>(null);
  const known = useRef(new Set<string>());
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;

  const refresh = useCallback(async () => {
    if (status !== 'ready' || !account) return;
    const [p, c, l, u, pp, b] = await Promise.allSettled([
      backend.loadPlan(account),
      backend.fetchConversations(),
      backend.likesYouCount(),
      backend.loadUsage(),
      backend.getPassport(),
      backend.boostStatus(),
    ]);
    if (p.status === 'fulfilled') setPlan(p.value);
    if (u.status === 'fulfilled') setUsage(u.value);
    if (pp.status === 'fulfilled') setPassportState(pp.value);
    if (b.status === 'fulfilled') setBoost(b.value);
    if (c.status === 'fulfilled') {
      c.value.forEach((conv) => known.current.add(conv.matchId));
      setConversations(c.value);
    }
    if (l.status === 'fulfilled') setLikesCount(l.value);
  }, [status, account]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const refreshUsage = useCallback(async () => {
    if (status !== 'ready') return;
    setUsage(await backend.loadUsage().catch(() => null));
  }, [status]);

  // Compras ficam associadas à conta do Kissly (e se separam ao sair).
  useEffect(() => {
    if (status !== 'ready' || !account) return;
    payments.identify(account.id).catch(() => {});
    return () => {
      payments.reset().catch(() => {});
    };
  }, [status, account]);

  // Mensagens e matches novos chegando em tempo real.
  useEffect(() => {
    if (status !== 'ready') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = backend.subscribeInbox((event) => {
      if (event.type === 'match' && !known.current.has(event.matchId)) {
        show('Você tem um novo match! 💘', 'heart', colors.rose);
      }
      if (event.type === 'message' && !event.fromMe && activeChat.current !== event.matchId) {
        const from = conversationsRef.current.find((c) => c.matchId === event.matchId);
        show(from ? `Nova mensagem de ${from.profile.name}` : 'Nova mensagem', 'chatbubble-ellipses', colors.rose);
      }
      // Vários eventos seguidos geram uma única atualização.
      clearTimeout(timer);
      timer = setTimeout(refresh, 300);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [status, refresh, show]);

  const value = useMemo<AppState>(
    () => ({
      plan,
      passport,
      setPassport: async (next) => {
        await backend.setPassport(next);
        setPassportState(next);
      },
      boost,
      activateBoost: async () => {
        const activeUntil = await backend.activateBoost();
        setBoost((b) => ({ activeUntil, leftThisMonth: Math.max(0, (b?.leftThisMonth ?? 1) - 1) }));
      },
      usage,
      refreshUsage,
      applyPlan: (next) => {
        setPlan(next);
        refresh();
      },
      consume: (kind) =>
        setUsage((u) =>
          !u
            ? u
            : kind === 'like'
              ? { ...u, likesLeft: u.likesLeft === null ? null : Math.max(0, u.likesLeft - 1) }
              : { ...u, supersLeft: Math.max(0, u.supersLeft - 1) },
        ),
      conversations,
      likesCount,
      inboxBadge: conversations.filter((c) => c.unread > 0 || !c.lastMessageAt).length,
      refresh,
      addMatch: (profile, matchId) => {
        known.current.add(matchId);
        setConversations((list) =>
          list.some((c) => c.matchId === matchId)
            ? list
            : [
                {
                  matchId,
                  matchedAt: new Date().toISOString(),
                  profile,
                  lastMessage: null,
                  lastMessageAt: null,
                  lastFromMe: false,
                  unread: 0,
                },
                ...list,
              ],
        );
        setLikesCount((n) => Math.max(0, n - 1));
      },
      removeConversation: (matchId) => setConversations((list) => list.filter((c) => c.matchId !== matchId)),
      setActiveChat: (matchId) => {
        activeChat.current = matchId;
      },
      clearUnread: (matchId) =>
        setConversations((list) => list.map((c) => (c.matchId === matchId ? { ...c, unread: 0 } : c))),
    }),
    [plan, passport, boost, usage, refreshUsage, conversations, likesCount, refresh],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState deve ser usado dentro de AppStateProvider');
  return ctx;
}

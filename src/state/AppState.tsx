import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { useToast } from '@/components/Toast';
import { backend } from '@/services/backend';
import { useSession } from '@/state/Session';
import { colors } from '@/theme';
import type { Conversation } from '@/types/chat';
import type { Plan, Profile } from '@/types/user';

type AppState = {
  plan: Plan;
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
  const activeChat = useRef<string | null>(null);
  const known = useRef(new Set<string>());
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;

  const refresh = useCallback(async () => {
    if (status !== 'ready' || !account) return;
    const [p, c, l] = await Promise.allSettled([
      backend.loadPlan(account),
      backend.fetchConversations(),
      backend.likesYouCount(),
    ]);
    if (p.status === 'fulfilled') setPlan(p.value);
    if (c.status === 'fulfilled') {
      c.value.forEach((conv) => known.current.add(conv.matchId));
      setConversations(c.value);
    }
    if (l.status === 'fulfilled') setLikesCount(l.value);
  }, [status, account]);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
    [plan, conversations, likesCount, refresh],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState deve ser usado dentro de AppStateProvider');
  return ctx;
}

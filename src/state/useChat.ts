import { useCallback, useEffect, useRef, useState } from 'react';
import * as Crypto from 'expo-crypto';

import { BackendError, backend } from '@/services/backend';
import type { ChatChannel, Message } from '@/types/chat';

const PAGE_SIZE = 30;
const TYPING_TIMEOUT = 3500;

const newestFirst = (a: Message, b: Message) => b.createdAt.localeCompare(a.createdAt);

/** Estado de uma conversa: mensagens (mais recentes primeiro), envio otimista e tempo real. */
export function useChat(matchId: string, myId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [typing, setTyping] = useState(false);
  const channel = useRef<ChatChannel | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  /** Insere ou substitui pelo id — o eco do Realtime casa com a mensagem otimista. */
  const upsert = useCallback((incoming: Message) => {
    setMessages((list) => {
      const index = list.findIndex((m) => m.id === incoming.id);
      if (index < 0) return [incoming, ...list].sort(newestFirst);
      const copy = [...list];
      copy[index] = { ...incoming, readAt: incoming.readAt ?? list[index].readAt };
      return copy;
    });
  }, []);

  const markRead = useCallback(() => {
    backend.markRead(matchId).catch(() => {});
  }, [matchId]);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    backend
      .fetchMessages(matchId)
      .then((list) => {
        if (!alive) return;
        setMessages((current) => {
          // Mantém o que chegou pelo Realtime enquanto a primeira página carregava.
          const ids = new Set(list.map((m) => m.id));
          return [...list, ...current.filter((m) => !ids.has(m.id))].sort(newestFirst);
        });
        setHasMore(list.length >= PAGE_SIZE);
        setError(null);
      })
      .catch((e) => alive && setError(e instanceof BackendError ? e.message : 'Não foi possível carregar a conversa.'))
      .finally(() => alive && setLoading(false));

    channel.current = backend.openChat(matchId, {
      onMessage: (message) => {
        upsert(message);
        if (message.senderId !== myId) {
          setTyping(false);
          markRead();
        }
      },
      onRead: (ids, readAt) => setMessages((list) => list.map((m) => (ids.includes(m.id) ? { ...m, readAt } : m))),
      onTyping: () => {
        setTyping(true);
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTyping(false), TYPING_TIMEOUT);
      },
    });
    markRead();

    return () => {
      alive = false;
      clearTimeout(typingTimer.current);
      channel.current?.close();
      channel.current = null;
    };
  }, [matchId, myId, upsert, markRead]);

  const send = useCallback(
    async (body: string, retryId?: string) => {
      const text = body.trim();
      if (!text) return;
      const id = retryId ?? Crypto.randomUUID();
      upsert({
        id,
        matchId,
        senderId: myId,
        body: text,
        createdAt: new Date().toISOString(),
        readAt: null,
        status: 'sending',
      });
      try {
        upsert(await backend.sendMessage({ id, matchId, body: text }));
      } catch (e) {
        setMessages((list) => list.map((m) => (m.id === id ? { ...m, status: 'failed' } : m)));
        throw e;
      }
    },
    [matchId, myId, upsert],
  );

  const loadOlder = useCallback(async () => {
    const oldest = messages[messages.length - 1];
    if (!hasMore || loadingMore || !oldest) return;
    setLoadingMore(true);
    try {
      const older = await backend.fetchMessages(matchId, oldest.createdAt);
      setMessages((list) => {
        const ids = new Set(list.map((m) => m.id));
        return [...list, ...older.filter((m) => !ids.has(m.id))];
      });
      setHasMore(older.length >= PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  }, [messages, hasMore, loadingMore, matchId]);

  return {
    messages,
    loading,
    error,
    typing,
    hasMore,
    loadingMore,
    send,
    loadOlder,
    sendTyping: () => channel.current?.sendTyping(),
  };
}

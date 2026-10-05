import { useCallback, useEffect, useRef, useState } from 'react';
import * as Crypto from 'expo-crypto';

import { BackendError, backend } from '@/services/backend';
import { rememberLocalMedia } from '@/services/mediaCache';
import type { ChatChannel, Message } from '@/types/chat';

/** O que a pessoa está enviando (antes de virar mensagem). */
export type ChatDraft =
  | { kind: 'text'; body: string }
  | { kind: 'gif'; url: string; width: number; height: number }
  | { kind: 'image'; localUri: string; width: number; height: number }
  | { kind: 'audio'; localUri: string; durationMs: number; mimeType: string };

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

  // Conteúdo original de cada envio, para "tentar de novo" quando falha.
  const drafts = useRef(new Map<string, ChatDraft>());

  const send = useCallback(
    async (draft: ChatDraft, retryId?: string) => {
      if (draft.kind === 'text' && !draft.body.trim()) return;
      const id = retryId ?? Crypto.randomUUID();
      drafts.current.set(id, draft);

      const body = draft.kind === 'text' ? draft.body.trim() : '';
      const mediaMeta =
        draft.kind === 'audio'
          ? { durationMs: draft.durationMs }
          : draft.kind === 'text'
            ? null
            : { width: draft.width, height: draft.height };
      const localMedia = draft.kind === 'gif' ? draft.url : draft.kind === 'text' ? null : draft.localUri;

      upsert({
        id,
        matchId,
        senderId: myId,
        kind: draft.kind,
        body,
        mediaUrl: localMedia,
        mediaMeta,
        createdAt: new Date().toISOString(),
        readAt: null,
        status: 'sending',
      });
      try {
        let mediaUrl = draft.kind === 'gif' ? draft.url : null;
        if (draft.kind === 'image' || draft.kind === 'audio') {
          const mime = draft.kind === 'image' ? 'image/jpeg' : draft.mimeType;
          mediaUrl = await backend.uploadChatMedia(matchId, draft.localUri, draft.kind, mime);
          rememberLocalMedia(mediaUrl, draft.localUri);
        }
        upsert(await backend.sendMessage({ id, matchId, kind: draft.kind, body, mediaUrl, mediaMeta }));
        drafts.current.delete(id);
      } catch (e) {
        setMessages((list) => list.map((m) => (m.id === id ? { ...m, status: 'failed' } : m)));
        throw e;
      }
    },
    [matchId, myId, upsert],
  );

  const retry = useCallback(
    async (id: string) => {
      const draft = drafts.current.get(id);
      if (draft) await send(draft, id);
    },
    [send],
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
    retry,
    loadOlder,
    sendTyping: () => channel.current?.sendTyping(),
  };
}

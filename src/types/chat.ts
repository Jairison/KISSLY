import type { Profile } from './user';

export type MessageKind = 'text' | 'image' | 'gif' | 'audio';

export type MediaMeta = { width?: number; height?: number; durationMs?: number };

export type Message = {
  id: string;
  matchId: string;
  senderId: string;
  kind: MessageKind;
  /** Texto (vazio em foto/áudio/GIF). */
  body: string;
  /** Foto/áudio: caminho no Storage ("<match>/<arquivo>"); GIF: endereço do GIPHY. */
  mediaUrl: string | null;
  mediaMeta: MediaMeta | null;
  /** ISO */
  createdAt: string;
  readAt: string | null;
  /** Só no app: ainda enviando ou falhou ao enviar. */
  status?: 'sending' | 'failed';
};

/** Um match e o estado da conversa com essa pessoa. */
export type Conversation = {
  matchId: string;
  matchedAt: string;
  profile: Profile;
  lastMessage: string | null;
  lastMessageAt: string | null;
  lastFromMe: boolean;
  unread: number;
};

export type ReportReason = 'fake' | 'inappropriate_photos' | 'harassment' | 'spam' | 'underage' | 'other';

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'fake', label: 'Perfil falso ou golpe' },
  { value: 'inappropriate_photos', label: 'Fotos impróprias' },
  { value: 'harassment', label: 'Assédio ou mensagens ofensivas' },
  { value: 'spam', label: 'Spam ou propaganda' },
  { value: 'underage', label: 'Parece ser menor de idade' },
  { value: 'other', label: 'Outro motivo' },
];

export const MESSAGE_MAX = 1000;
export const AUDIO_MAX_SECONDS = 60;

/** Texto curto da mensagem para a lista de conversas e notificações. */
export function messagePreview(kind: MessageKind, body: string) {
  return kind === 'image' ? '📷 Foto' : kind === 'gif' ? 'GIF' : kind === 'audio' ? '🎤 Áudio' : body;
}

/** O que vai no envio de uma mensagem. */
export type OutgoingMessage = Pick<Message, 'id' | 'matchId' | 'kind' | 'body' | 'mediaUrl' | 'mediaMeta'>;

export type ChatEvents = {
  onMessage: (message: Message) => void;
  onRead: (messageIds: string[], readAt: string) => void;
  onTyping: () => void;
};

export type ChatChannel = {
  sendTyping: () => void;
  close: () => void;
};

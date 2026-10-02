import type { Profile } from './user';

export type Message = {
  id: string;
  matchId: string;
  senderId: string;
  body: string;
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

export type ChatEvents = {
  onMessage: (message: Message) => void;
  onRead: (messageIds: string[], readAt: string) => void;
  onTyping: () => void;
};

export type ChatChannel = {
  sendTyping: () => void;
  close: () => void;
};

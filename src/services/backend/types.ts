import type { ChatChannel, ChatEvents, Conversation, Message, ReportReason } from '@/types/chat';
import type { DiscoveryPrefs, DiscoveryScope, Plan, Profile, UserProfile } from '@/types/user';

export type Account = { id: string; email: string };

export type ProfileDraft = Omit<UserProfile, 'id' | 'email'>;

export type SignUpResult =
  /** Conta criada e já logada. */
  | { status: 'signedIn' }
  /** O Supabase exige confirmar o e-mail antes do primeiro login. */
  | { status: 'confirmEmail' };

export type OAuthProvider = 'google' | 'apple';

export type BackendErrorCode = 'auth' | 'premium_required' | 'network' | 'not_available' | 'unknown';

/** Erro com mensagem já pronta para mostrar ao usuário. */
export class BackendError extends Error {
  constructor(
    message: string,
    readonly code: BackendErrorCode = 'unknown',
  ) {
    super(message);
  }
}

/**
 * Contrato único entre as telas e o servidor.
 * Hoje existem duas implementações: Supabase (produção) e local (demonstração).
 */
export interface Backend {
  readonly mode: 'supabase' | 'local';

  /** Avisa sempre que a conta logada muda. Chama o callback logo na inscrição com o estado atual. */
  onAuthChange(callback: (account: Account | null) => void): () => void;
  signUp(email: string, password: string): Promise<SignUpResult>;
  signIn(email: string, password: string): Promise<Account>;
  /** Retorna false se o usuário cancelou. */
  signInWithProvider(provider: OAuthProvider): Promise<boolean>;
  /** Conclui login social / recuperação de senha a partir do link recebido. */
  completeAuthRedirect(url: string): Promise<boolean>;
  sendPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;

  loadProfile(account: Account): Promise<UserProfile | null>;
  createProfile(account: Account, draft: ProfileDraft, prefs: DiscoveryPrefs): Promise<UserProfile>;
  updateProfile(current: UserProfile, changes: Partial<ProfileDraft>): Promise<UserProfile>;
  loadPrefs(account: Account): Promise<DiscoveryPrefs>;
  savePrefs(account: Account, prefs: DiscoveryPrefs): Promise<void>;
  loadPlan(account: Account): Promise<Plan>;

  fetchDeck(scope: DiscoveryScope): Promise<Profile[]>;
  swipe(target: Profile, direction: 'like' | 'nope' | 'super'): Promise<{ matched: boolean; matchId: string | null }>;
  /** Matches com a última mensagem e as não lidas, da conversa mais recente para a mais antiga. */
  fetchConversations(): Promise<Conversation[]>;
  likesYouCount(): Promise<number>;
  /** Exige plano Gold ou Platinum. */
  fetchLikesYou(): Promise<Profile[]>;

  // ---- chat
  /** Mensagens mais recentes primeiro. Passe `before` (ISO) para carregar as anteriores. */
  fetchMessages(matchId: string, before?: string): Promise<Message[]>;
  sendMessage(message: Pick<Message, 'id' | 'matchId' | 'body'>): Promise<Message>;
  markRead(matchId: string): Promise<void>;
  /** Mensagens novas, confirmações de leitura e "digitando…" de uma conversa. */
  openChat(matchId: string, events: ChatEvents): ChatChannel;
  /** Avisa quando chega mensagem ou match novo em qualquer conversa. */
  subscribeInbox(onChange: (event: { type: 'message' | 'match'; matchId: string; fromMe: boolean }) => void): () => void;
  unmatch(matchId: string): Promise<void>;
  report(profileId: string, reason: ReportReason, details: string): Promise<void>;
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { AudioBubble } from '@/components/chat/AudioBubble';
import { GifPicker } from '@/components/chat/GifPicker';
import { MediaBubble } from '@/components/chat/MediaBubble';
import { VoiceRecorder } from '@/components/chat/VoiceRecorder';
import { useToast } from '@/components/Toast';
import { ActionSheet } from '@/components/ui/ActionSheet';
import { noWebOutline } from '@/components/ui/TextField';
import { BackendError } from '@/services/backend';
import { useAppState } from '@/state/AppState';
import { useChat, type ChatDraft } from '@/state/useChat';
import { optimizeImage } from '@/utils/images';
import { PermissionError, pickImages } from '@/utils/pickImages';
import { useMatchActions } from '@/state/useMatchActions';
import { useCurrentUser } from '@/state/Session';
import { colors, fonts, gradients, radii, spacing } from '@/theme';
import { MESSAGE_MAX, type Conversation, type Message } from '@/types/chat';
import { formatClock, formatDay, isSameDay } from '@/utils/time';

export default function ChatScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const me = useCurrentUser();
  const { conversations, setActiveChat, clearUnread } = useAppState();
  const conversation = conversations.find((c) => c.matchId === matchId);
  const { show } = useToast();
  const chat = useChat(matchId, me.id);
  const actions = useMatchActions(conversation);
  const [draft, setDraft] = useState('');
  const [recording, setRecording] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [gifOpen, setGifOpen] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Separadores de dia viram itens próprios da lista: numa lista invertida, cada item
  // com um único elemento mantém a ordem certa em todas as plataformas.
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    chat.messages.forEach((message, index) => {
      const older = chat.messages[index + 1];
      out.push({ kind: 'message', key: message.id, message, index });
      if (!older || !isSameDay(older.createdAt, message.createdAt)) {
        out.push({ kind: 'day', key: `day-${message.id}`, label: formatDay(message.createdAt) });
      }
    });
    return out;
  }, [chat.messages]);

  useFocusEffect(
    useCallback(() => {
      setActiveChat(matchId);
      clearUnread(matchId);
      return () => setActiveChat(null);
    }, [matchId, setActiveChat, clearUnread]),
  );

  // Match desfeito do outro lado (ou link inválido): volta para a lista.
  useEffect(() => {
    if (!conversation && !chat.loading) router.back();
  }, [conversation, chat.loading]);

  if (!conversation) return <View style={styles.screen} />;
  const { profile } = conversation;

  const notSent = (e: unknown) =>
    show(e instanceof BackendError ? e.message : 'Mensagem não enviada', 'cloud-offline-outline', colors.danger);
  const send = (content: ChatDraft) => {
    chat.send(content).catch(notSent);
  };

  const submit = () => {
    if (!draft.trim()) return;
    send({ kind: 'text', body: draft });
    setDraft('');
  };

  const sendPhoto = async (camera: boolean) => {
    setAttachOpen(false);
    try {
      const picked = await pickImages({ limit: 1, camera });
      if (!picked) return;
      const photo = await optimizeImage(picked[0].uri, 1280).catch(() => null);
      if (!photo) {
        const heic = /hei[cf]/i.test(`${picked[0].mimeType} ${picked[0].fileName}`);
        show(heic ? 'Fotos HEIC não abrem no navegador. Escolha uma foto JPG.' : 'Não foi possível usar essa foto.', 'image-outline', colors.danger);
        return;
      }
      send({ kind: 'image', localUri: photo.uri, width: photo.width, height: photo.height });
    } catch (e) {
      show(e instanceof PermissionError ? 'Permita o acesso às fotos/câmera nas configurações.' : 'Não foi possível abrir as fotos.', 'images-outline', colors.danger);
    }
  };

  // A mensagem minha mais recente mostra o status (Enviando / Enviada / Lida).
  const lastMineId = chat.messages.find((m) => m.senderId === me.id)?.id;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Pressable
          style={styles.headerPerson}
          onPress={() => router.push({ pathname: '/person/[matchId]', params: { matchId } })}
        >
          <Image source={profile.photos[0]} style={styles.headerAvatar} />
          <View style={{ flexShrink: 1 }}>
            <View style={styles.headerNameRow}>
              <Text style={styles.headerName} numberOfLines={1}>
                {profile.name}
              </Text>
              {profile.verified && <Ionicons name="checkmark-circle" size={15} color={colors.sky} />}
            </View>
            {chat.typing ? (
              <Animated.Text entering={FadeIn} style={[styles.headerSub, { color: colors.rose }]}>
                digitando…
              </Animated.Text>
            ) : (
              <Text style={styles.headerSub} numberOfLines={1}>
                {profile.flag} {profile.city}
              </Text>
            )}
          </View>
        </Pressable>
        <Pressable onPress={actions.open} hitSlop={12} style={styles.headerButton}>
          <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        {chat.loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.rose} />
          </View>
        ) : chat.error && chat.messages.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="cloud-offline-outline" size={40} color={colors.textFaint} />
            <Text style={styles.muted}>{chat.error}</Text>
          </View>
        ) : chat.messages.length === 0 ? (
          <Icebreakers
            conversation={conversation}
            myPhoto={me.photos[0]}
            onPick={(text) => {
              setDraft(text);
              inputRef.current?.focus();
            }}
          />
        ) : (
          <FlatList
            inverted
            data={rows}
            keyExtractor={(row) => row.key}
            contentContainerStyle={styles.list}
            onEndReached={chat.loadOlder}
            onEndReachedThreshold={0.3}
            ListFooterComponent={chat.loadingMore ? <ActivityIndicator color={colors.rose} style={{ margin: spacing.lg }} /> : null}
            renderItem={({ item }) => {
              if (item.kind === 'day') return <Text style={styles.day}>{item.label}</Text>;
              const { message, index } = item;
              const older = chat.messages[index + 1];
              const newer = chat.messages[index - 1];
              return (
                <Bubble
                  message={message}
                  mine={message.senderId === me.id}
                  joinedAbove={!!older && older.senderId === message.senderId && isSameDay(older.createdAt, message.createdAt)}
                  joinedBelow={!!newer && newer.senderId === message.senderId && isSameDay(newer.createdAt, message.createdAt)}
                  showStatus={message.id === lastMineId}
                  onRetry={() => chat.retry(message.id).catch(notSent)}
                />
              );
            }}
          />
        )}

        {recording ? (
          <VoiceRecorder
            onCancel={() => setRecording(false)}
            onError={(msg) => show(msg, 'mic-off-outline', colors.danger)}
            onSend={(audio) => {
              setRecording(false);
              send({ kind: 'audio', localUri: audio.uri, durationMs: audio.durationMs, mimeType: audio.mimeType });
            }}
          />
        ) : (
          <View style={styles.composer}>
            <Pressable onPress={() => setAttachOpen(true)} hitSlop={8} style={styles.attach} accessibilityLabel="Enviar foto ou GIF">
              <Ionicons name="add" size={26} color={colors.rose} />
            </Pressable>
            <TextInput
              ref={inputRef}
              value={draft}
              onChangeText={(text) => {
                setDraft(text);
                if (text) chat.sendTyping();
              }}
              placeholder={`Mensagem para ${profile.name}…`}
              placeholderTextColor={colors.textFaint}
              selectionColor={colors.rose}
              multiline
              maxLength={MESSAGE_MAX}
              style={[styles.input, noWebOutline]}
              onKeyPress={(e) => {
                // No navegador, Enter envia e Shift+Enter quebra a linha.
                const native = e.nativeEvent as { key: string; shiftKey?: boolean };
                if (Platform.OS === 'web' && native.key === 'Enter' && !native.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            {draft.trim() ? (
              <Pressable onPress={submit} accessibilityLabel="Enviar mensagem">
                <LinearGradient colors={gradients.brand} style={styles.send}>
                  <Ionicons name="arrow-up" size={22} color="#fff" />
                </LinearGradient>
              </Pressable>
            ) : (
              <Pressable onPress={() => setRecording(true)} accessibilityLabel="Gravar áudio" style={styles.mic}>
                <Ionicons name="mic" size={22} color={colors.rose} />
              </Pressable>
            )}
          </View>
        )}
      </KeyboardAvoidingView>

      {actions.sheet}
      <ActionSheet
        visible={attachOpen}
        onClose={() => setAttachOpen(false)}
        actions={[
          { label: 'Foto da galeria', icon: 'images-outline', onPress: () => sendPhoto(false) },
          ...(Platform.OS === 'web' ? [] : [{ label: 'Tirar foto', icon: 'camera-outline' as const, onPress: () => sendPhoto(true) }]),
          {
            label: 'GIF',
            icon: 'happy-outline',
            onPress: () => {
              setAttachOpen(false);
              setGifOpen(true);
            },
          },
        ]}
      />
      <GifPicker
        visible={gifOpen}
        onClose={() => setGifOpen(false)}
        onPick={(gif) => {
          setGifOpen(false);
          send({ kind: 'gif', url: gif.url, width: gif.width, height: gif.height });
        }}
      />
    </SafeAreaView>
  );
}

type Row =
  | { kind: 'message'; key: string; message: Message; index: number }
  | { kind: 'day'; key: string; label: string };

type BubbleProps = {
  message: Message;
  mine: boolean;
  joinedAbove: boolean;
  joinedBelow: boolean;
  showStatus: boolean;
  onRetry: () => void;
};

function Bubble({ message, mine, joinedAbove, joinedBelow, showStatus, onRetry }: BubbleProps) {
  const failed = message.status === 'failed';
  const shape = mine
    ? { borderTopRightRadius: joinedAbove ? 6 : 20, borderBottomRightRadius: joinedBelow ? 6 : 20 }
    : { borderTopLeftRadius: joinedAbove ? 6 : 20, borderBottomLeftRadius: joinedBelow ? 6 : 20 };

  const content = (
    <>
      <Text style={[styles.bubbleText, mine && { color: '#fff' }]}>{message.body}</Text>
      <Text style={[styles.bubbleTime, mine && { color: 'rgba(255,255,255,0.75)' }]}>{formatClock(message.createdAt)}</Text>
    </>
  );

  const media = message.kind === 'image' || message.kind === 'gif' ? (
    <MediaBubble message={message} mine={mine} />
  ) : message.kind === 'audio' ? (
    <AudioBubble message={message} mine={mine} />
  ) : null;

  return (
    <Animated.View
      entering={FadeInDown.duration(220)}
      style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs, { marginTop: joinedAbove ? 2 : spacing.sm }]}
    >
      {media ? (
        <Pressable onPress={failed ? onRetry : undefined} disabled={!failed} style={failed && styles.mediaFailed}>
          {media}
          <Text style={styles.mediaTime}>{formatClock(message.createdAt)}</Text>
        </Pressable>
      ) : mine ? (
        <Pressable onPress={failed ? onRetry : undefined} disabled={!failed}>
          <LinearGradient
            colors={failed ? [colors.surfaceRaised, colors.surfaceRaised] : gradients.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.bubble, shape, failed && styles.bubbleFailed]}
          >
            {content}
          </LinearGradient>
        </Pressable>
      ) : (
        <View style={[styles.bubble, styles.bubbleTheirs, shape]}>{content}</View>
      )}
      {mine && showStatus && (
        <Text style={[styles.status, failed && { color: colors.danger }]}>
          {failed
            ? 'Não enviada · toque para tentar de novo'
            : message.status === 'sending'
              ? 'Enviando…'
              : message.readAt
                ? `Lida às ${formatClock(message.readAt)}`
                : 'Enviada'}
        </Text>
      )}
    </Animated.View>
  );
}

function Icebreakers({
  conversation,
  myPhoto,
  onPick,
}: {
  conversation: Conversation;
  myPhoto: string;
  onPick: (text: string) => void;
}) {
  const { profile } = conversation;
  const interest = profile.interests[0];
  const ideas = [
    interest
      ? `Oi, ${profile.name}! Vi que você curte ${interest.toLowerCase()}. Como isso começou?`
      : `Oi, ${profile.name}! Seu perfil chamou minha atenção 😊`,
    `Se a gente marcasse um primeiro encontro em ${profile.city}, onde seria?`,
    'Qual foi a melhor coisa que te aconteceu essa semana?',
  ];

  return (
    <Animated.ScrollView entering={FadeIn} contentContainerStyle={styles.ice}>
      <View style={styles.iceAvatars}>
        <Image source={myPhoto} style={[styles.iceAvatar, { transform: [{ rotate: '-8deg' }, { translateX: 14 }] }]} />
        <Image source={profile.photos[0]} style={[styles.iceAvatar, { transform: [{ rotate: '8deg' }, { translateX: -14 }] }]} />
      </View>
      <Text style={styles.iceTitle}>Vocês deram match {formatDay(conversation.matchedAt).toLowerCase()}</Text>
      <Text style={styles.muted}>Quebre o gelo com uma destas ideias ou escreva do seu jeito:</Text>
      <View style={{ gap: spacing.sm, alignSelf: 'stretch' }}>
        {ideas.map((idea) => (
          <Pressable key={idea} style={styles.idea} onPress={() => onPick(idea)}>
            <Ionicons name="sparkles" size={16} color={colors.gold} />
            <Text style={styles.ideaText}>{idea}</Text>
          </Pressable>
        ))}
      </View>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerPerson: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface },
  headerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  headerName: { fontFamily: fonts.semibold, fontSize: 17, color: colors.text, flexShrink: 1 },
  headerSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, marginTop: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  muted: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textMuted, textAlign: 'center' },
  list: { paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  day: {
    alignSelf: 'center',
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textFaint,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  bubbleRow: { maxWidth: '80%' },
  mediaFailed: { opacity: 0.6 },
  mediaTime: { alignSelf: 'flex-end', fontFamily: fonts.regular, fontSize: 10, color: colors.textFaint, marginTop: 3, marginRight: 4 },
  attach: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  mic: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,61,127,0.12)',
  },
  rowMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  rowTheirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: {
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 6,
    borderRadius: 20,
    overflow: 'hidden',
  },
  bubbleTheirs: { backgroundColor: colors.surfaceRaised },
  bubbleFailed: { borderWidth: 1, borderColor: colors.danger },
  bubbleText: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.text },
  bubbleTime: {
    alignSelf: 'flex-end',
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.textFaint,
    marginTop: 2,
  },
  status: { fontFamily: fonts.regular, fontSize: 11, color: colors.textFaint, marginTop: 4, marginRight: 4 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 130,
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
    paddingBottom: 12,
    borderRadius: 22,
    backgroundColor: colors.surface,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.text,
  },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  ice: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl },
  iceAvatars: { flexDirection: 'row', marginBottom: spacing.sm },
  iceAvatar: {
    width: 96,
    height: 120,
    borderRadius: radii.lg,
    borderWidth: 3,
    borderColor: colors.text,
    backgroundColor: colors.surface,
  },
  iceTitle: { fontFamily: fonts.display, fontSize: 24, color: colors.text, textAlign: 'center' },
  idea: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  ideaText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.text },
});

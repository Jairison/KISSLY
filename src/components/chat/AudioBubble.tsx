import { useEffect, useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { useMediaUrl } from '@/state/useMediaUrl';
import { colors, fonts, gradients, radii } from '@/theme';
import type { Message } from '@/types/chat';

const BARS = 28;

export const formatDuration = (ms: number) => {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/** Mensagem de voz: tocar/pausar, "onda" de progresso e duração. */
export function AudioBubble({ message, mine }: { message: Message; mine: boolean }) {
  const { url } = useMediaUrl(message.mediaUrl);
  const player = useAudioPlayer(url ? { uri: url } : null);
  const status = useAudioPlayerStatus(player);

  const durationMs = message.mediaMeta?.durationMs ?? (status.duration || 0) * 1000;
  const progress = status.duration > 0 ? Math.min(1, status.currentTime / status.duration) : 0;

  // "Onda" fixa por mensagem (só visual), derivada do id.
  const bars = useMemo(() => {
    let seed = 0;
    for (const ch of message.id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    return Array.from({ length: BARS }, () => {
      seed = (seed * 1103515245 + 12345) >>> 0;
      return 0.25 + ((seed >>> 16) % 1000) / 1333;
    });
  }, [message.id]);

  // Ao terminar, volta para o começo.
  useEffect(() => {
    if (status.didJustFinish) player.seekTo(0);
  }, [status.didJustFinish, player]);

  const toggle = async () => {
    if (!url) return;
    if (status.playing) return player.pause();
    await setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    player.play();
  };

  const ink = mine ? '#fff' : colors.text;
  const dim = mine ? 'rgba(255,255,255,0.45)' : 'rgba(247,242,245,0.3)';

  const content = (
    <View style={styles.row}>
      <Pressable
        onPress={toggle}
        disabled={!url || message.status === 'sending'}
        style={[styles.play, { backgroundColor: mine ? 'rgba(255,255,255,0.2)' : colors.surface }]}
        accessibilityLabel={status.playing ? 'Pausar áudio' : 'Tocar áudio'}
      >
        {!url || message.status === 'sending' ? (
          <ActivityIndicator size="small" color={ink} />
        ) : (
          <Ionicons name={status.playing ? 'pause' : 'play'} size={20} color={ink} style={!status.playing && { marginLeft: 2 }} />
        )}
      </Pressable>
      <View style={styles.wave}>
        {bars.map((h, i) => (
          <View
            key={i}
            style={[styles.bar, { height: 4 + h * 22, backgroundColor: i / BARS < progress ? ink : dim }]}
          />
        ))}
      </View>
      <Text style={[styles.time, { color: ink }]}>
        {formatDuration(status.playing || status.currentTime > 0 ? status.currentTime * 1000 : durationMs)}
      </Text>
    </View>
  );

  return mine ? (
    <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.bubble, styles.mine]}>
      {content}
    </LinearGradient>
  ) : (
    <View style={[styles.bubble, styles.theirs]}>{content}</View>
  );
}

const styles = StyleSheet.create({
  bubble: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: radii.lg, width: 250 },
  mine: { borderBottomRightRadius: 6 },
  theirs: { borderBottomLeftRadius: 6, backgroundColor: colors.surfaceRaised },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  play: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  wave: { flex: 1, height: 30, flexDirection: 'row', alignItems: 'center', gap: 2 },
  bar: { flex: 1, borderRadius: 2 },
  time: { fontFamily: fonts.medium, fontSize: 12, minWidth: 34, textAlign: 'right' },
});

import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { formatDuration } from '@/components/chat/AudioBubble';
import { colors, fonts, gradients, spacing } from '@/theme';
import { AUDIO_MAX_SECONDS } from '@/types/chat';

export type RecordedAudio = { uri: string; durationMs: number; mimeType: string };

type Props = {
  /** Quando a gravação termina e a pessoa toca em enviar. */
  onSend: (audio: RecordedAudio) => void;
  onCancel: () => void;
  onError: (message: string) => void;
};

/**
 * Barra de gravação que substitui o campo de texto enquanto grava.
 * Começa a gravar ao aparecer; limite de AUDIO_MAX_SECONDS.
 */
export function VoiceRecorder({ onSend, onCancel, onError }: Props) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [elapsed, setElapsed] = useState(0);
  const [ready, setReady] = useState(false);
  const startedAt = useRef(0);
  const finished = useRef(false);

  const pulse = useSharedValue(1);
  const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  useEffect(() => {
    pulse.value = withRepeat(withTiming(0.25, { duration: 700 }), -1, true);
    let alive = true;
    (async () => {
      try {
        const permission = await requestRecordingPermissionsAsync();
        if (!permission.granted) {
          onError('Permita o uso do microfone para enviar áudios.');
          return onCancel();
        }
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync();
        if (!alive) return;
        recorder.record();
        startedAt.current = Date.now();
        setReady(true);
      } catch {
        onError('Não foi possível usar o microfone.');
        onCancel();
      }
    })();
    return () => {
      alive = false;
      if (!finished.current) recorder.stop().catch(() => {});
      setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    };
    // Grava uma vez, ao montar.
  }, []);

  const finish = async (send: boolean) => {
    if (finished.current) return;
    finished.current = true;
    const durationMs = Date.now() - startedAt.current;
    try {
      await recorder.stop();
    } catch {
      // segue com o que tiver sido gravado
    }
    const uri = recorder.uri;
    if (!send) return onCancel();
    if (!uri || durationMs < 700) {
      onError('Áudio curto demais. Segure um pouco mais.');
      return onCancel();
    }
    onSend({ uri, durationMs, mimeType: Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4' });
  };

  // Cronômetro e limite de duração.
  useEffect(() => {
    if (!ready) return;
    const timer = setInterval(() => {
      const ms = Date.now() - startedAt.current;
      setElapsed(ms);
      if (ms >= AUDIO_MAX_SECONDS * 1000) finish(true);
    }, 200);
    return () => clearInterval(timer);
  }, [ready]);

  return (
    <View style={styles.bar}>
      <Pressable onPress={() => finish(false)} hitSlop={10} style={styles.cancel} accessibilityLabel="Cancelar gravação">
        <Ionicons name="trash-outline" size={22} color={colors.danger} />
      </Pressable>
      <View style={styles.middle}>
        <Animated.View style={[styles.dot, dotStyle]} />
        <Text style={styles.time}>{formatDuration(elapsed)}</Text>
        <Text style={styles.hint}>{ready ? `Gravando · até ${AUDIO_MAX_SECONDS}s` : 'Preparando microfone…'}</Text>
      </View>
      <Pressable onPress={() => finish(true)} disabled={!ready} accessibilityLabel="Enviar áudio" style={{ opacity: ready ? 1 : 0.4 }}>
        <LinearGradient colors={gradients.brand} style={styles.send}>
          <Ionicons name="arrow-up" size={22} color="#fff" />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  cancel: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  middle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: 22,
    backgroundColor: colors.surface,
  },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger },
  time: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text, minWidth: 40 },
  hint: { flex: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.textFaint },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});

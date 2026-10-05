import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { useMediaUrl } from '@/state/useMediaUrl';
import { colors, fonts, radii } from '@/theme';
import type { Message } from '@/types/chat';

const MAX_W = 230;
const MAX_H = 300;

/** Foto ou GIF dentro da conversa. Tocar abre em tela cheia. */
export function MediaBubble({ message, mine }: { message: Message; mine: boolean }) {
  const { url, error } = useMediaUrl(message.mediaUrl);
  const [full, setFull] = useState(false);
  const { width: screenW, height: screenH } = useWindowDimensions();

  const w0 = message.mediaMeta?.width ?? 3;
  const h0 = message.mediaMeta?.height ?? 4;
  const scale = Math.min(MAX_W / w0, MAX_H / h0);
  const size = { width: Math.round(w0 * scale), height: Math.round(h0 * scale) };
  const sending = message.status === 'sending';

  return (
    <>
      <Pressable
        onPress={() => url && setFull(true)}
        accessibilityLabel={message.kind === 'gif' ? 'GIF' : 'Foto'}
        style={[styles.frame, size, mine ? styles.mine : styles.theirs]}
      >
        {url ? (
          <Image source={url} style={StyleSheet.absoluteFill} contentFit="cover" autoplay />
        ) : (
          <View style={styles.center}>
            {error ? (
              <Ionicons name="image-outline" size={28} color={colors.textFaint} />
            ) : (
              <ActivityIndicator color={colors.rose} />
            )}
          </View>
        )}
        {message.kind === 'gif' && (
          <View style={styles.gifTag}>
            <Text style={styles.gifTagText}>GIF</Text>
          </View>
        )}
        {sending && (
          <View style={[StyleSheet.absoluteFill, styles.sending]}>
            <ActivityIndicator color="#fff" />
          </View>
        )}
      </Pressable>

      <Modal visible={full} transparent animationType="fade" onRequestClose={() => setFull(false)}>
        <Pressable style={styles.viewer} onPress={() => setFull(false)}>
          {url && (
            <Image
              source={url}
              style={{ width: screenW, height: screenH * 0.8 }}
              contentFit="contain"
              autoplay
            />
          )}
          <View style={styles.close}>
            <Ionicons name="close" size={26} color="#fff" />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: radii.lg, overflow: 'hidden', backgroundColor: colors.surfaceRaised },
  mine: { borderBottomRightRadius: 6 },
  theirs: { borderBottomLeftRadius: 6 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  gifTag: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  gifTagText: { fontFamily: fonts.bold, fontSize: 10, color: '#fff', letterSpacing: 1 },
  sending: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(11,8,16,0.35)' },
  viewer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.92)' },
  close: {
    position: 'absolute',
    top: 48,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
});

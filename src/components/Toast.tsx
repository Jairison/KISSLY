import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { colors, fonts, radii } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;
type ToastData = { message: string; icon: IconName; color: string };

export function useToast() {
  const [toast, setToast] = useState<ToastData | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback((message: string, icon: IconName = 'sparkles', color: string = colors.gold) => {
    clearTimeout(timer.current);
    setToast({ message, icon, color });
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return { toast, show };
}

export function Toast({ toast }: { toast: ToastData | null }) {
  if (!toast) return null;
  return (
    <Animated.View entering={FadeInDown.springify()} exiting={FadeOutDown} style={styles.toast} pointerEvents="none">
      <Ionicons name={toast.icon} size={18} color={toast.color} />
      <Text style={styles.text}>{toast.message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    maxWidth: '90%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  text: { fontFamily: fonts.medium, fontSize: 14, color: colors.text, flexShrink: 1 },
});

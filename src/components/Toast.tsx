import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { colors, fonts, radii } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;
type ToastData = { id: number; message: string; icon: IconName; color: string };
type Show = (message: string, icon?: IconName, color?: string) => void;

const ToastContext = createContext<Show | null>(null);

/** Avisos flutuantes disponíveis em qualquer tela via useToast(). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const insets = useSafeAreaInsets();

  const show = useCallback<Show>((message, icon = 'sparkles', color = colors.gold) => {
    clearTimeout(timer.current);
    setToast({ id: Date.now(), message, icon, color });
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <Animated.View
          key={toast.id}
          entering={FadeInDown.springify()}
          exiting={FadeOutDown}
          style={[styles.toast, { bottom: insets.bottom + 100 }]}
          pointerEvents="none"
        >
          <Ionicons name={toast.icon} size={18} color={toast.color} />
          <Text style={styles.text}>{toast.message}</Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast deve ser usado dentro de ToastProvider');
  return useMemo(() => ({ show }), [show]);
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
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

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { colors, fonts, spacing } from '@/theme';

type Props = {
  title?: string;
  /** "close" mostra um X (modais); "back" mostra a seta. */
  mode?: 'back' | 'close';
  onBack?: () => void;
  right?: ReactNode;
};

export function ScreenHeader({ title, mode = 'back', onBack, right }: Props) {
  return (
    <View style={styles.row}>
      <Pressable onPress={onBack ?? (() => router.back())} hitSlop={12} style={styles.button}>
        <Ionicons name={mode === 'close' ? 'close' : 'chevron-back'} size={24} color={colors.text} />
      </Pressable>
      {title ? <Text style={styles.title}>{title}</Text> : <View />}
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 56,
  },
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  title: { fontFamily: fonts.semibold, fontSize: 17, color: colors.text },
  right: { minWidth: 40, alignItems: 'flex-end' },
});

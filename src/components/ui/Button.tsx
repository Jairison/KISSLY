import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { colors, fonts, gradients, radii } from '@/theme';

type Variant = 'primary' | 'gold' | 'light' | 'outline' | 'ghost';

type Props = {
  title: string;
  onPress: () => void;
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Ícone customizado à esquerda (ex.: logos), substitui `icon`. */
  leading?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

const TEXT_COLOR: Record<Variant, string> = {
  primary: '#fff',
  gold: colors.background,
  light: colors.background,
  outline: colors.text,
  ghost: colors.textMuted,
};

export function Button({ title, onPress, variant = 'primary', icon, leading, loading, disabled, style }: Props) {
  const inactive = disabled || loading;
  const color = TEXT_COLOR[variant];

  const content = (
    <View style={styles.inner}>
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <>
          {leading ?? (icon && <Ionicons name={icon} size={18} color={color} />)}
          <Text style={[styles.text, { color }]}>{title}</Text>
        </>
      )}
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        variant === 'light' && { backgroundColor: colors.text },
        variant === 'outline' && styles.outline,
        { opacity: disabled ? 0.4 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        style,
      ]}
    >
      {variant === 'primary' || variant === 'gold' ? (
        <LinearGradient
          colors={variant === 'gold' ? gradients.gold : gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radii.pill, overflow: 'hidden', minHeight: 54, justifyContent: 'center' },
  outline: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(255,255,255,0.04)' },
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 24 },
  text: { fontFamily: fonts.semibold, fontSize: 16 },
});

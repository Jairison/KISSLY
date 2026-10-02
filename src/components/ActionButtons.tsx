import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { colors, fonts, gradients } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

type ButtonProps = {
  icon: IconName;
  /** Numerozinho no canto (ex.: Super Likes restantes). */
  badge?: string;
  color: string;
  size: number;
  onPress: () => void;
  filled?: boolean;
  disabled?: boolean;
};

function RoundButton({ icon, color, size, onPress, filled, disabled, badge }: ButtonProps) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      disabled={disabled}
      onPressIn={() => (scale.value = withSpring(0.88))}
      onPressOut={() => (scale.value = withSpring(1))}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        onPress();
      }}
    >
      <Animated.View
        style={[
          styles.button,
          { width: size, height: size, borderRadius: size / 2, opacity: disabled ? 0.4 : 1 },
          !filled && { borderColor: color + '55' },
          style,
        ]}
      >
        {filled ? (
          <LinearGradient colors={gradients.brand} style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]} />
        ) : null}
        <Ionicons name={icon} size={size * 0.46} color={filled ? '#fff' : color} />
      </Animated.View>
      {badge !== undefined && (
        <View style={[styles.badge, { backgroundColor: color }]}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

type Props = {
  onRewind: () => void;
  onNope: () => void;
  onSuper: () => void;
  onLike: () => void;
  onBoost: () => void;
  disabled?: boolean;
  /** Super Likes restantes hoje. */
  supersLeft?: number;
  /** Tempo restante do Boost ativo (ex.: "12:34"). */
  boostLabel?: string;
};

export function ActionButtons({ onRewind, onNope, onSuper, onLike, onBoost, disabled, supersLeft, boostLabel }: Props) {
  return (
    <View style={styles.row}>
      <RoundButton icon="arrow-undo" color={colors.gold} size={46} onPress={onRewind} />
      <RoundButton icon="close" color={colors.danger} size={62} onPress={onNope} disabled={disabled} />
      <RoundButton
        icon="star"
        color={colors.sky}
        size={50}
        onPress={onSuper}
        disabled={disabled}
        badge={supersLeft !== undefined ? String(supersLeft) : undefined}
      />
      <RoundButton icon="heart" color="#fff" size={70} onPress={onLike} filled disabled={disabled} />
      <RoundButton icon="flash" color={colors.violet} size={46} onPress={onBoost} badge={boostLabel} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  badgeText: { fontFamily: fonts.bold, fontSize: 10, color: colors.background },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});

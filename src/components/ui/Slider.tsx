import { useEffect } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { colors, gradients } from '@/theme';

const THUMB = 28;
const SPRING = { damping: 20, stiffness: 240 };

type Props = {
  min: number;
  max: number;
  step?: number;
  low: number;
  /** Informe `high` para um slider de faixa (dois controles). */
  high?: number;
  onChange: (low: number, high: number | undefined) => void;
};

export function Slider({ min, max, step = 1, low, high, onChange }: Props) {
  const ranged = high !== undefined;
  const width = useSharedValue(0);
  const lowX = useSharedValue(0);
  const highX = useSharedValue(0);
  const startX = useSharedValue(0);
  const dragging = useSharedValue(false);
  const lastLow = useSharedValue(low);
  const lastHigh = useSharedValue(high ?? max);

  const toX = (value: number, w: number) => {
    'worklet';
    return ((value - min) / (max - min)) * w;
  };
  const toValue = (x: number, w: number) => {
    'worklet';
    if (w <= 0) return min;
    const raw = min + (x / w) * (max - min);
    return Math.min(max, Math.max(min, Math.round((raw - min) / step) * step + min));
  };

  // Mantém os controles alinhados quando o valor muda por fora (ex.: carregar preferências).
  useEffect(() => {
    if (dragging.value) return;
    lastLow.value = low;
    lowX.value = toX(low, width.value);
    if (high !== undefined) {
      lastHigh.value = high;
      highX.value = toX(high, width.value);
    }
  }, [low, high]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.max(0, e.nativeEvent.layout.width - THUMB);
    width.value = w;
    lowX.value = toX(low, w);
    if (high !== undefined) highX.value = toX(high, w);
  };

  const emit = (l: number, h: number) => {
    Haptics.selectionAsync().catch(() => {});
    onChange(l, ranged ? h : undefined);
  };

  const pan = (thumb: 'low' | 'high') =>
    Gesture.Pan()
      .hitSlop({ horizontal: 14, vertical: 14 })
      .activeOffsetX([-3, 3])
      .onBegin(() => {
        dragging.value = true;
        startX.value = thumb === 'low' ? lowX.value : highX.value;
      })
      .onUpdate((e) => {
        const w = width.value;
        const x = startX.value + e.translationX;
        if (thumb === 'low') lowX.value = Math.max(0, Math.min(x, ranged ? highX.value : w));
        else highX.value = Math.max(lowX.value, Math.min(x, w));

        const l = toValue(lowX.value, w);
        const h = ranged ? toValue(highX.value, w) : max;
        if (l !== lastLow.value || h !== lastHigh.value) {
          lastLow.value = l;
          lastHigh.value = h;
          scheduleOnRN(emit, l, h);
        }
      })
      .onFinalize(() => {
        dragging.value = false;
        const w = width.value;
        lowX.value = withSpring(toX(lastLow.value, w), SPRING);
        if (ranged) highX.value = withSpring(toX(lastHigh.value, w), SPRING);
      });

  const fillStyle = useAnimatedStyle(() => {
    const start = ranged ? lowX.value : 0;
    const end = ranged ? highX.value : lowX.value;
    return { left: THUMB / 2 + start, width: Math.max(0, end - start) };
  });
  const lowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: lowX.value }],
    // Se os dois controles se encostarem no fim da barra, o de baixo precisa ficar por cima.
    zIndex: ranged && lowX.value > width.value / 2 ? 2 : 1,
  }));
  const highStyle = useAnimatedStyle(() => ({ transform: [{ translateX: highX.value }] }));

  return (
    <View style={styles.container} onLayout={onLayout}>
      <View style={styles.track} />
      <Animated.View style={[styles.fill, fillStyle]}>
        <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <GestureDetector gesture={pan('low')}>
        <Animated.View style={[styles.thumb, lowStyle]} />
      </GestureDetector>
      {ranged && (
        <GestureDetector gesture={pan('high')}>
          <Animated.View style={[styles.thumb, highStyle]} />
        </GestureDetector>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: THUMB + 12, justifyContent: 'center' },
  track: {
    position: 'absolute',
    left: THUMB / 2,
    right: THUMB / 2,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceRaised,
  },
  fill: { position: 'absolute', height: 4, borderRadius: 2, overflow: 'hidden' },
  thumb: {
    position: 'absolute',
    left: 0,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: colors.text,
    borderWidth: 3,
    borderColor: colors.rose,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
});

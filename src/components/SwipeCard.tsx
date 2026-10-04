import { useImperativeHandle, useState, type Ref } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { formatDistance, type Profile, type SwipeDirection } from '@/types/user';
import { colors, fonts, gradients, radii, spacing } from '@/theme';

export type SwipeCardHandle = {
  swipe: (direction: SwipeDirection) => void;
};

type Props = {
  ref?: Ref<SwipeCardHandle>;
  profile: Profile;
  isTop: boolean;
  /** 0 → 1 conforme o card do topo é arrastado; usado pelo card de trás. */
  progress: SharedValue<number>;
  onSwiped: (profile: Profile, direction: SwipeDirection) => void;
  /** Abre o menu do card (denunciar / bloquear). */
  onMore?: (profile: Profile) => void;
};

const SPRING = { damping: 18, stiffness: 180 };

export function SwipeCard({ ref, profile, isTop, progress, onSwiped, onMore }: Props) {
  const { width, height } = useWindowDimensions();
  const threshold = width * 0.28;
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const [photoIndex, setPhotoIndex] = useState(0);

  const finish = (direction: SwipeDirection) => onSwiped(profile, direction);

  const flyOut = (direction: SwipeDirection) => {
    'worklet';
    const done = (finished?: boolean) => {
      'worklet';
      if (finished) scheduleOnRN(finish, direction);
    };
    progress.value = withTiming(1, { duration: 250 });
    if (direction === 'up') {
      y.value = withTiming(-height * 1.2, { duration: 320 }, done);
    } else {
      x.value = withTiming((direction === 'right' ? 1 : -1) * width * 1.5, { duration: 300 }, done);
    }
  };

  useImperativeHandle(ref, () => ({ swipe: (direction) => flyOut(direction) }));

  const pan = Gesture.Pan()
    .enabled(isTop)
    .onUpdate((e) => {
      x.value = e.translationX;
      y.value = e.translationY;
      progress.value = Math.min(1, Math.max(Math.abs(e.translationX), Math.abs(e.translationY)) / threshold);
    })
    .onEnd((e) => {
      if (e.translationX > threshold || e.velocityX > 900) flyOut('right');
      else if (e.translationX < -threshold || e.velocityX < -900) flyOut('left');
      else if (e.translationY < -threshold * 1.2 || e.velocityY < -1100) flyOut('up');
      else {
        x.value = withSpring(0, SPRING);
        y.value = withSpring(0, SPRING);
        progress.value = withSpring(0, SPRING);
      }
    });

  const cardStyle = useAnimatedStyle(() => {
    if (!isTop) {
      const scale = interpolate(progress.value, [0, 1], [0.94, 1], Extrapolation.CLAMP);
      const translateY = interpolate(progress.value, [0, 1], [18, 0], Extrapolation.CLAMP);
      return { transform: [{ translateY }, { scale }] };
    }
    const rotate = interpolate(x.value, [-width, 0, width], [-14, 0, 14]);
    return {
      transform: [{ translateX: x.value }, { translateY: y.value }, { rotate: `${rotate}deg` }],
    };
  });

  const likeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [0, threshold * 0.8], [0, 1], Extrapolation.CLAMP),
  }));
  const nopeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [-threshold * 0.8, 0], [1, 0], Extrapolation.CLAMP),
  }));
  const superStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [-threshold, 0], [1, 0], Extrapolation.CLAMP) *
      interpolate(Math.abs(x.value), [0, threshold * 0.5], [1, 0], Extrapolation.CLAMP),
  }));

  const photos = profile.photos;
  const changePhoto = (delta: number) =>
    setPhotoIndex((i) => Math.min(photos.length - 1, Math.max(0, i + delta)));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.card, cardStyle]}>
        <Image
          source={photos[photoIndex]}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
        />

        {photos.length > 1 && (
          <View style={styles.bars}>
            {photos.map((_, i) => (
              <View key={i} style={[styles.bar, i === photoIndex && styles.barActive]} />
            ))}
          </View>
        )}

        {/* Toque nas laterais da foto para navegar entre as fotos */}
        <View style={styles.tapZones}>
          <Pressable style={{ flex: 1 }} onPress={() => changePhoto(-1)} />
          <Pressable style={{ flex: 1 }} onPress={() => changePhoto(1)} />
        </View>

        <Animated.View style={[styles.stamp, styles.stampLike, likeStyle]}>
          <Text style={[styles.stampText, { color: colors.mint }]}>KISS</Text>
        </Animated.View>
        <Animated.View style={[styles.stamp, styles.stampNope, nopeStyle]}>
          <Text style={[styles.stampText, { color: colors.danger }]}>NOPE</Text>
        </Animated.View>
        <Animated.View style={[styles.stamp, styles.stampSuper, superStyle]}>
          <Text style={[styles.stampText, { color: colors.sky }]}>SUPER</Text>
        </Animated.View>

        {isTop && onMore && (
          <Pressable onPress={() => onMore(profile)} hitSlop={10} style={styles.more} accessibilityLabel={`Mais opções sobre ${profile.name}`}>
            <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
          </Pressable>
        )}

        {profile.superLikedYou && (
          <View style={styles.superBadge}>
            <Ionicons name="star" size={14} color="#fff" />
            <Text style={styles.superBadgeText}>Deu Super Like em você</Text>
          </View>
        )}

        <LinearGradient colors={gradients.cardShade} locations={[0.45, 0.65, 1]} style={styles.shade} pointerEvents="none">
          <View style={styles.info}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{profile.name}</Text>
              <Text style={styles.age}>{profile.age}</Text>
              {profile.verified && (
                <Ionicons name="checkmark-circle" size={22} color={colors.sky} style={{ marginLeft: 6 }} />
              )}
            </View>
            {profile.job && (
              <View style={styles.metaRow}>
                <Ionicons name="briefcase-outline" size={14} color={colors.textMuted} />
                <Text style={styles.meta}>{profile.job}</Text>
              </View>
            )}
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={14} color={colors.textMuted} />
              <Text style={styles.meta}>
                {profile.flag} {profile.city}, {profile.country}
                {profile.distanceKm !== null ? ` · ${formatDistance(profile.distanceKm)}` : ''}
              </Text>
            </View>
            {profile.prompts?.length ? (
              <View style={styles.prompt}>
                <Text style={styles.promptQuestion}>{profile.prompts[0].question}</Text>
                <Text style={styles.promptAnswer} numberOfLines={2}>
                  {profile.prompts[0].answer}
                </Text>
              </View>
            ) : (
              <Text style={styles.bio} numberOfLines={2}>
                {profile.bio}
              </Text>
            )}
            <View style={styles.tags}>
              {profile.interests.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        </LinearGradient>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  bars: { position: 'absolute', top: 10, left: 12, right: 12, flexDirection: 'row', gap: 4, zIndex: 2 },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' },
  barActive: { backgroundColor: '#fff' },
  tapZones: { ...StyleSheet.absoluteFill, flexDirection: 'row', bottom: '40%' },
  stamp: {
    position: 'absolute',
    top: 48,
    borderWidth: 3,
    borderRadius: radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 4,
    zIndex: 3,
  },
  stampLike: { left: 24, borderColor: colors.mint, transform: [{ rotate: '-16deg' }] },
  stampNope: { right: 24, borderColor: colors.danger, transform: [{ rotate: '16deg' }] },
  stampSuper: { alignSelf: 'center', top: '42%', borderColor: colors.sky, transform: [{ rotate: '-8deg' }] },
  stampText: { fontFamily: fonts.bold, fontSize: 36, letterSpacing: 4 },
  more: {
    position: 'absolute',
    top: 22,
    right: 14,
    zIndex: 4,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11,8,16,0.45)',
  },
  superBadge: {
    position: 'absolute',
    top: 22,
    left: 14,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.sky,
  },
  superBadgeText: { fontFamily: fonts.bold, fontSize: 12, color: '#fff' },
  shade: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end' },
  info: { padding: spacing.xl, gap: 6 },
  nameRow: { flexDirection: 'row', alignItems: 'baseline' },
  name: { fontFamily: fonts.display, fontSize: 34, color: colors.text },
  age: { fontFamily: fonts.regular, fontSize: 26, color: colors.text, marginLeft: 10 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted },
  bio: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.text, opacity: 0.9, marginTop: 4 },
  prompt: {
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderLeftWidth: 3,
    borderLeftColor: colors.rose,
  },
  promptQuestion: { fontFamily: fonts.semibold, fontSize: 12, color: colors.rose, marginBottom: 2 },
  promptAnswer: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 20, color: colors.text },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  tagText: { fontFamily: fonts.medium, fontSize: 12, color: colors.text },
});

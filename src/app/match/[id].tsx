import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInUp, ZoomIn } from 'react-native-reanimated';

import { profiles } from '@/data/profiles';
import { useCurrentUser } from '@/state/Session';
import { colors, fonts, gradients, radii, spacing } from '@/theme';

export default function MatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useCurrentUser();
  const profile = profiles.find((p) => p.id === id);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, []);

  if (!profile) return null;

  return (
    <View style={styles.screen}>
      <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(255,61,127,0.35)', 'rgba(11,8,16,0.92)', colors.background]}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.titleBlock}>
        <Text style={styles.kicker}>VOCÊS SE CURTIRAM</Text>
        <Text style={styles.title}>É um Match!</Text>
        <Text style={styles.subtitle}>Você e {profile.name} sentiram a mesma faísca.</Text>
      </Animated.View>

      <View style={styles.photos}>
        <Animated.View entering={ZoomIn.delay(250).springify()} style={[styles.photoFrame, styles.photoLeft]}>
          <Image source={me.photos[0]} style={styles.photo} />
        </Animated.View>
        <Animated.View entering={ZoomIn.delay(350).springify()} style={[styles.photoFrame, styles.photoRight]}>
          <Image source={profile.photos[0]} style={styles.photo} />
        </Animated.View>
        <Animated.View entering={ZoomIn.delay(600).springify()} style={styles.heart}>
          <LinearGradient colors={gradients.brand} style={styles.heartInner}>
            <Ionicons name="heart" size={26} color="#fff" />
          </LinearGradient>
        </Animated.View>
      </View>

      <Animated.View entering={FadeIn.delay(700)} style={styles.buttons}>
        <Pressable onPress={() => router.dismissTo('/chats')}>
          <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primary}>
            <Ionicons name="chatbubble-ellipses" size={18} color="#fff" />
            <Text style={styles.primaryText}>Enviar mensagem</Text>
          </LinearGradient>
        </Pressable>
        <Pressable onPress={() => router.back()} style={styles.secondary}>
          <Text style={styles.secondaryText}>Continuar explorando</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const PHOTO = 150;

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl },
  titleBlock: { alignItems: 'center', gap: spacing.sm },
  kicker: { fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 3, color: colors.gold },
  title: { fontFamily: fonts.displayItalic, fontSize: 48, color: colors.text },
  subtitle: { fontFamily: fonts.regular, fontSize: 16, color: colors.textMuted, textAlign: 'center' },
  photos: { height: PHOTO + 60, marginVertical: spacing.xxl, alignItems: 'center', justifyContent: 'center' },
  photoFrame: {
    position: 'absolute',
    width: PHOTO,
    height: PHOTO * 1.25,
    borderRadius: radii.lg,
    borderWidth: 3,
    borderColor: colors.text,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  photoLeft: { transform: [{ translateX: -62 }, { rotate: '-8deg' }] },
  photoRight: { transform: [{ translateX: 62 }, { rotate: '8deg' }] },
  photo: { width: '100%', height: '100%' },
  heart: { position: 'absolute', bottom: 0 },
  heartInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.background,
  },
  buttons: { gap: spacing.md },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 16,
    borderRadius: radii.pill,
  },
  primaryText: { fontFamily: fonts.semibold, fontSize: 16, color: '#fff' },
  secondary: {
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
});

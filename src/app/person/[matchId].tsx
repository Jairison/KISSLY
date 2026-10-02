import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '@/components/ui/Button';
import { useAppState } from '@/state/AppState';
import { useMatchActions } from '@/state/useMatchActions';
import { colors, fonts, gradients, radii, spacing } from '@/theme';
import { formatDistance } from '@/types/user';

export default function PersonScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { conversations } = useAppState();
  const conversation = conversations.find((c) => c.matchId === matchId);
  const actions = useMatchActions(conversation, { showProfile: false });
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);

  if (!conversation) return <View style={styles.screen} />;
  const { profile } = conversation;
  const photoHeight = width * 1.2;
  const distance = formatDistance(profile.distanceKm);

  return (
    <View style={styles.screen}>
      <ScrollView>
        <View style={{ height: photoHeight }}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
          >
            {profile.photos.map((uri, i) => (
              <Image key={`${uri}-${i}`} source={uri} style={{ width, height: photoHeight }} contentFit="cover" />
            ))}
          </ScrollView>
          <LinearGradient colors={['rgba(11,8,16,0.55)', 'transparent']} style={styles.topShade} pointerEvents="none" />
          <LinearGradient colors={['transparent', colors.background]} style={styles.bottomShade} pointerEvents="none" />
          {profile.photos.length > 1 && (
            <View style={styles.dots}>
              {profile.photos.map((_, i) => (
                <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
              ))}
            </View>
          )}
          <SafeAreaView edges={['top']} style={styles.topBar}>
            <Pressable onPress={() => router.back()} style={styles.roundButton} hitSlop={10}>
              <Ionicons name="chevron-down" size={24} color={colors.text} />
            </Pressable>
            <Pressable onPress={actions.open} style={styles.roundButton} hitSlop={10}>
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
            </Pressable>
          </SafeAreaView>
        </View>

        <View style={styles.body}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{profile.name}</Text>
            <Text style={styles.age}>{profile.age}</Text>
            {profile.verified && <Ionicons name="checkmark-circle" size={22} color={colors.sky} />}
          </View>

          <View style={styles.meta}>
            {profile.job && <Meta icon="briefcase-outline" text={profile.job} />}
            <Meta icon="location-outline" text={`${profile.flag} ${profile.city}, ${profile.country}`} />
            {distance && <Meta icon="navigate-outline" text={`A ${distance} de você`} />}
          </View>

          {profile.bio ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Sobre</Text>
              <Text style={styles.bio}>{profile.bio}</Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Interesses</Text>
            <View style={styles.tags}>
              {profile.interests.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>

          <Button
            title={`Conversar com ${profile.name}`}
            icon="chatbubble-ellipses"
            onPress={() => router.replace({ pathname: '/chat/[matchId]', params: { matchId } })}
          />
        </View>
      </ScrollView>
      {actions.sheet}
    </View>
  );
}

function Meta({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.metaRow}>
      <Ionicons name={icon} size={16} color={colors.textMuted} />
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  topShade: { position: 'absolute', top: 0, left: 0, right: 0, height: 120 },
  bottomShade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 140 },
  dots: { position: 'absolute', top: 12, left: 16, right: 16, flexDirection: 'row', gap: 4 },
  dot: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotActive: { backgroundColor: '#fff' },
  topBar: {
    position: 'absolute',
    top: 16,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  roundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11,8,16,0.55)',
  },
  body: { padding: spacing.xl, gap: spacing.lg, marginTop: -spacing.xxl },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  name: { fontFamily: fonts.display, fontSize: 36, color: colors.text },
  age: { fontFamily: fonts.regular, fontSize: 28, color: colors.text },
  meta: { gap: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText: { fontFamily: fonts.medium, fontSize: 15, color: colors.textMuted },
  card: { gap: spacing.md, padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.surface },
  cardTitle: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.rose,
  },
  bio: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.text },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
  },
  tagText: { fontFamily: fonts.medium, fontSize: 13, color: colors.text },
});

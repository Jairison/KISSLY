import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { profiles } from '@/data/profiles';
import { useAppState } from '@/state/AppState';
import { colors, fonts, gradients, radii, spacing } from '@/theme';

export default function LikesScreen() {
  const { plan } = useAppState();
  const canSee = plan === 'gold' || plan === 'platinum';
  const { width } = useWindowDimensions();
  const tile = (width - spacing.lg * 2 - spacing.md) / 2;
  const likers = profiles.filter((p) => p.likesYou);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Curtidas</Text>
        <Text style={styles.subtitle}>{likers.length} pessoas curtiram você</Text>

        <View style={styles.grid}>
          {likers.map((p) => (
            <View key={p.id} style={[styles.tile, { width: tile, height: tile * 1.35 }]}>
              <Image source={p.photos[0]} style={StyleSheet.absoluteFill} blurRadius={canSee ? 0 : 28} />
              <LinearGradient colors={gradients.cardShade} style={styles.tileShade}>
                <Text style={styles.tileName}>{canSee ? `${p.name}, ${p.age}` : '••••••'}</Text>
                <Text style={styles.tileMeta}>{p.flag} {p.city}</Text>
              </LinearGradient>
            </View>
          ))}
        </View>
      </ScrollView>

      {!canSee && (
        <View style={styles.ctaWrap}>
          <Pressable>
            <LinearGradient colors={gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cta}>
              <Ionicons name="eye" size={18} color={colors.background} />
              <Text style={styles.ctaText}>Veja quem curtiu você com o Gold</Text>
            </LinearGradient>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 120 },
  title: { fontFamily: fonts.display, fontSize: 32, color: colors.text },
  subtitle: { fontFamily: fonts.medium, fontSize: 14, color: colors.gold, marginTop: 4, marginBottom: spacing.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: { borderRadius: radii.lg, overflow: 'hidden', backgroundColor: colors.surface },
  tileShade: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end', padding: spacing.md },
  tileName: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  tileMeta: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  ctaWrap: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.lg },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 16,
    borderRadius: radii.pill,
  },
  ctaText: { fontFamily: fonts.bold, fontSize: 15, color: colors.background },
});

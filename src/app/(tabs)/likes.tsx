import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { useToast } from '@/components/Toast';
import { backend } from '@/services/backend';
import { useAppState } from '@/state/AppState';
import { colors, fonts, gradients, radii, spacing } from '@/theme';
import { isPremium, type Profile } from '@/types/user';

// Tons para os cards "misteriosos" do plano grátis (o servidor não envia as fotos).
const MYSTERY = [
  ['#3A1730', '#1B1222'],
  ['#3B2216', '#1B1222'],
  ['#1E2440', '#1B1222'],
  ['#2E1A40', '#1B1222'],
] as const;

export default function LikesScreen() {
  const { plan, likesCount, refresh } = useAppState();
  const { show } = useToast();
  const canSee = isPremium(plan);
  const { width } = useWindowDimensions();
  const tile = (width - spacing.lg * 2 - spacing.md) / 2;
  const [likers, setLikers] = useState<Profile[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    await refresh();
    if (canSee) setLikers(await backend.fetchLikesYou().catch(() => []));
  }, [refresh, canSee]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const tiles = canSee ? likers.length : Math.min(likesCount, 8);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.rose} />}
      >
        <Text style={styles.title}>Curtidas</Text>
        <Text style={styles.subtitle}>
          {likesCount === 0
            ? 'Ninguém novo por enquanto'
            : likesCount === 1
              ? '1 pessoa curtiu você'
              : `${likesCount} pessoas curtiram você`}
        </Text>

        {tiles === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="sparkles-outline" size={42} color={colors.textFaint} />
            <Text style={styles.emptyText}>
              Capriche nas fotos e na bio: perfis completos recebem muito mais Kiss.
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {canSee
              ? likers.map((p) => (
                  <View key={p.id} style={[styles.tile, { width: tile, height: tile * 1.35 }]}>
                    <Image source={p.photos[0]} style={StyleSheet.absoluteFill} contentFit="cover" />
                    <LinearGradient colors={gradients.cardShade} style={styles.tileShade}>
                      <Text style={styles.tileName}>
                        {p.name}, {p.age}
                      </Text>
                      <Text style={styles.tileMeta}>
                        {p.flag} {p.city}
                      </Text>
                    </LinearGradient>
                  </View>
                ))
              : Array.from({ length: tiles }).map((_, i) => (
                  <LinearGradient
                    key={i}
                    colors={MYSTERY[i % MYSTERY.length]}
                    style={[styles.tile, styles.mystery, { width: tile, height: tile * 1.35 }]}
                  >
                    <Ionicons name="heart" size={34} color="rgba(255,61,127,0.55)" />
                    <View style={styles.blurLine} />
                    <View style={[styles.blurLine, { width: '40%' }]} />
                  </LinearGradient>
                ))}
          </View>
        )}
      </ScrollView>

      {!canSee && likesCount > 0 && (
        <View style={styles.ctaWrap}>
          <Pressable onPress={() => show('Os planos chegam na Parte 5', 'diamond')}>
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
  content: { padding: spacing.lg, paddingBottom: 120, flexGrow: 1 },
  title: { fontFamily: fonts.display, fontSize: 32, color: colors.text },
  subtitle: { fontFamily: fonts.medium, fontSize: 14, color: colors.gold, marginTop: 4, marginBottom: spacing.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: { borderRadius: radii.lg, overflow: 'hidden', backgroundColor: colors.surface },
  mystery: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  blurLine: { width: '60%', height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)' },
  tileShade: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end', padding: spacing.md },
  tileName: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  tileMeta: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.xl },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textMuted, textAlign: 'center' },
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

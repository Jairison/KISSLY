import { useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { useToast } from '@/components/Toast';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { noWebOutline } from '@/components/ui/TextField';
import { flagFor } from '@/data/catalog';
import { PASSPORT_CITIES } from '@/data/cities';
import { BackendError } from '@/services/backend';
import { useAppState } from '@/state/AppState';
import { useCurrentUser } from '@/state/Session';
import { colors, fonts, gradients, radii, spacing } from '@/theme';
import type { Passport } from '@/types/extras';
import { isPremium } from '@/types/user';

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export default function PassportScreen() {
  const me = useCurrentUser();
  const { plan, passport, setPassport } = useAppState();
  const { show } = useToast();
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const premium = isPremium(plan);

  const sections = useMemo(() => {
    const q = normalize(query.trim());
    const match = (c: (typeof PASSPORT_CITIES)[number]) =>
      !q || normalize(`${c.city} ${c.state} ${c.country}`).includes(q);
    return (['Brasil', 'Mundo'] as const)
      .map((region) => ({ title: region, data: PASSPORT_CITIES.filter((c) => c.region === region && match(c)) }))
      .filter((s) => s.data.length > 0);
  }, [query]);

  const choose = async (place: Passport | null, label: string) => {
    if (!premium) {
      router.replace({ pathname: '/plans', params: { feature: 'international' } });
      return;
    }
    setSaving(label);
    try {
      await setPassport(place);
      show(
        place ? `Você está em ${place.city} ✈️` : 'De volta à sua localização real',
        place ? 'airplane' : 'navigate',
        colors.gold,
      );
      router.back();
    } catch (e) {
      show(e instanceof BackendError ? e.message : 'Não foi possível mudar a localização', 'alert-circle', colors.danger);
      setSaving(null);
    }
  };

  const isCurrent = (c: Passport) => passport?.city === c.city && passport?.country === c.country;

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader mode="close" title="Passaporte" />

      <View style={styles.intro}>
        <LinearGradient colors={gradients.gold} style={styles.introIcon}>
          <Ionicons name="airplane" size={22} color={colors.background} />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={styles.introTitle}>Dê match antes de chegar</Text>
          <Text style={styles.introText}>
            Escolha uma cidade e passe a ver, e ser visto(a), por quem está lá.
            {!premium && ' Exclusivo do Kissly Gold.'}
          </Text>
        </View>
      </View>

      <View style={styles.search}>
        <Ionicons name="search" size={18} color={colors.textFaint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar cidade ou país"
          placeholderTextColor={colors.textFaint}
          selectionColor={colors.rose}
          style={[styles.searchInput, noWebOutline]}
        />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(c) => `${c.city}-${c.country}`}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <Pressable style={styles.row} onPress={() => choose(null, 'real')}>
            <View style={[styles.rowIcon, { backgroundColor: 'rgba(61,220,151,0.15)' }]}>
              <Ionicons name="navigate" size={18} color={colors.mint} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Minha localização real</Text>
              <Text style={styles.rowSub}>
                {me.city}, {me.state}
              </Text>
            </View>
            {!passport && <Ionicons name="checkmark-circle" size={22} color={colors.mint} />}
          </Pressable>
        }
        renderSectionHeader={({ section }) => <Text style={styles.section}>{section.title}</Text>}
        ListEmptyComponent={<Text style={styles.empty}>Nenhuma cidade encontrada.</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => choose(item, item.city)} disabled={!!saving}>
            <View style={styles.rowIcon}>
              <Text style={{ fontSize: 18 }}>{flagFor(item.country)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{item.city}</Text>
              <Text style={styles.rowSub}>
                {item.country === 'Brasil' ? item.state : item.country}
              </Text>
            </View>
            {isCurrent(item) ? (
              <Ionicons name="checkmark-circle" size={22} color={colors.gold} />
            ) : (
              !premium && <Ionicons name="lock-closed" size={16} color={colors.textFaint} />
            )}
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  intro: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(232,194,122,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(232,194,122,0.3)',
  },
  introIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  introTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  introText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted, marginTop: 2 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    margin: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  section: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.gold,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  rowTitle: { fontFamily: fonts.medium, fontSize: 16, color: colors.text },
  rowSub: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted },
  empty: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
});

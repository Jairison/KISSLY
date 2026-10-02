import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { useToast } from '@/components/Toast';
import {
  DURATIONS,
  PLANS,
  PLAN_FOR_FEATURE,
  PLAN_LABEL,
  PLAN_RANK,
  type Duration,
  type Feature,
  type PaidPlan,
} from '@/data/plans';
import { PaymentError, payments, type PlanOffer } from '@/services/payments';
import { useAppState } from '@/state/AppState';
import { colors, fonts, radii, spacing } from '@/theme';

export default function PlansScreen() {
  const params = useLocalSearchParams<{ feature?: Feature; plan?: PaidPlan }>();
  const { plan: currentPlan, applyPlan } = useAppState();
  const { show } = useToast();

  const initial = params.plan ?? (params.feature ? PLAN_FOR_FEATURE[params.feature] : 'gold');
  const [selected, setSelected] = useState<PaidPlan>(initial);
  const [duration, setDuration] = useState<Duration>('semiannual');
  const [offers, setOffers] = useState<PlanOffer[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);

  useEffect(() => {
    payments
      .getOffers()
      .then(setOffers)
      .catch(() => setLoadError('Não foi possível carregar os preços agora.'));
  }, []);

  const info = PLANS.find((p) => p.id === selected)!;
  const planOffers = useMemo(() => offers?.filter((o) => o.plan === selected) ?? [], [offers, selected]);
  const offer = planOffers.find((o) => o.duration === duration) ?? planOffers[0];
  const isCurrent = currentPlan === selected;
  const unavailable = payments.mode === 'unavailable';

  const buy = async () => {
    if (!offer) return;
    setBusy('buy');
    try {
      const result = await payments.purchase(offer);
      if (result.status === 'cancelled') return;
      applyPlan(result.plan);
      show(`Bem-vindo(a) ao ${PLAN_LABEL[result.plan]}! ✨`, 'diamond', colors.gold);
      router.back();
    } catch (e) {
      show(e instanceof PaymentError ? e.message : 'Não foi possível concluir a compra', 'alert-circle', colors.danger);
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    setBusy('restore');
    try {
      const restored = await payments.restore();
      applyPlan(restored);
      show(
        restored === 'free' ? 'Nenhuma assinatura ativa encontrada' : `${PLAN_LABEL[restored]} restaurado`,
        restored === 'free' ? 'information-circle-outline' : 'checkmark-circle',
        restored === 'free' ? colors.textMuted : colors.mint,
      );
    } catch (e) {
      show(e instanceof PaymentError ? e.message : 'Não foi possível restaurar', 'alert-circle', colors.danger);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.screen}>
      {/* Brilho de fundo na cor do plano */}
      <LinearGradient
        colors={[`${info.colors[1]}55`, 'transparent']}
        style={styles.glow}
        pointerEvents="none"
      />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.close}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
          <Pressable onPress={restore} disabled={!!busy} hitSlop={12}>
            {busy === 'restore' ? (
              <ActivityIndicator color={colors.textMuted} />
            ) : (
              <Text style={styles.restore}>Restaurar compras</Text>
            )}
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.tabs}>
            {PLANS.map((p) => {
              const active = p.id === selected;
              return (
                <Pressable key={p.id} onPress={() => setSelected(p.id)} style={styles.tabWrap}>
                  {active ? (
                    <LinearGradient colors={p.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tab}>
                      <Text style={[styles.tabText, { color: p.ink }]}>{p.name}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={[styles.tab, styles.tabIdle]}>
                      <Text style={styles.tabText}>{p.name}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          <Animated.View key={selected} entering={FadeInDown.duration(300)} style={styles.hero}>
            <LinearGradient colors={info.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroIcon}>
              <Ionicons name={info.icon} size={34} color={info.ink} />
            </LinearGradient>
            <Text style={styles.heroTitle}>
              Kissly <Text style={{ color: info.colors[0] }}>{info.name}</Text>
            </Text>
            <Text style={styles.heroTagline}>{info.tagline}</Text>
            {isCurrent && (
              <View style={styles.currentBadge}>
                <Ionicons name="checkmark-circle" size={14} color={colors.mint} />
                <Text style={styles.currentText}>Seu plano atual</Text>
              </View>
            )}
          </Animated.View>

          <Animated.View key={`perks-${selected}`} entering={FadeIn.duration(300)} style={styles.perks}>
            {info.perks.map((perk) => {
              const highlighted = !!params.feature && perk.feature === params.feature;
              return (
                <View key={perk.text} style={[styles.perk, highlighted && { backgroundColor: `${info.colors[1]}26` }]}>
                  <Ionicons name={perk.icon} size={20} color={info.colors[0]} />
                  <Text style={[styles.perkText, highlighted && { fontFamily: fonts.semibold }]}>{perk.text}</Text>
                </View>
              );
            })}
          </Animated.View>

          {offers === null && !loadError ? (
            <ActivityIndicator color={colors.rose} style={{ marginVertical: spacing.xl }} />
          ) : loadError || planOffers.length === 0 ? (
            <Text style={styles.notice}>{loadError ?? 'Este plano ainda não está disponível na loja.'}</Text>
          ) : (
            <View style={styles.durations}>
              {DURATIONS.map((d) => {
                const o = planOffers.find((x) => x.duration === d.id);
                if (!o) return null;
                const active = d.id === offer?.duration;
                return (
                  <Pressable
                    key={d.id}
                    onPress={() => setDuration(d.id)}
                    style={[styles.duration, active && { borderColor: info.colors[0], backgroundColor: colors.surfaceRaised }]}
                  >
                    {d.id === 'semiannual' && (
                      <LinearGradient colors={info.colors} style={styles.popular}>
                        <Text style={[styles.popularText, { color: info.ink }]}>MAIS POPULAR</Text>
                      </LinearGradient>
                    )}
                    <Text style={styles.durationLabel}>{d.label}</Text>
                    <Text style={styles.durationPerMonth}>{o.perMonth.replace('/mês', '')}</Text>
                    <Text style={styles.durationUnit}>por mês</Text>
                    <Text style={styles.durationTotal}>{d.months > 1 ? `${o.price} no total` : 'cobrado mensalmente'}</Text>
                    {o.savings > 0 && (
                      <View style={[styles.savings, { backgroundColor: `${info.colors[0]}33` }]}>
                        <Text style={[styles.savingsText, { color: info.colors[0] }]}>Economize {o.savings}%</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}

          {payments.mode === 'demo' && (
            <View style={styles.demo}>
              <Ionicons name="flask-outline" size={16} color={colors.gold} />
              <Text style={styles.demoText}>Modo demonstração: a compra é simulada e nada é cobrado.</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={buy}
            disabled={!offer || isCurrent || unavailable || !!busy}
            style={({ pressed }) => ({ opacity: !offer || isCurrent || unavailable ? 0.45 : pressed ? 0.85 : 1 })}
          >
            <LinearGradient colors={info.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cta}>
              {busy === 'buy' ? (
                <ActivityIndicator color={info.ink} />
              ) : (
                <Text style={[styles.ctaText, { color: info.ink }]}>
                  {isCurrent
                    ? 'Este já é o seu plano'
                    : PLAN_RANK[currentPlan] > PLAN_RANK[selected]
                      ? `Mudar para o ${info.name}`
                      : `Assinar ${info.name}${offer ? ` · ${offer.price}` : ''}`}
                </Text>
              )}
            </LinearGradient>
          </Pressable>
          {unavailable && (
            <Text style={styles.unavailable}>Assinaturas disponíveis pelo app Kissly no iPhone e no Android.</Text>
          )}
          <Text style={styles.legal}>
            A assinatura renova automaticamente pelo mesmo período e valor, a menos que seja cancelada até 24 horas
            antes do fim do período atual, nas configurações da sua conta da App Store ou do Google Play. Ao assinar,
            você concorda com os{' '}
            <Text style={styles.legalLink} onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'terms' } })}>Termos de Uso</Text> e a{' '}
            <Text style={styles.legalLink} onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'privacy' } })}>Política de Privacidade</Text>.
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 380 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  restore: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.xl },
  tabs: {
    flexDirection: 'row',
    gap: 6,
    padding: 4,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  tabWrap: { flex: 1 },
  tab: { paddingVertical: 10, borderRadius: radii.pill, alignItems: 'center' },
  tabIdle: { backgroundColor: 'transparent' },
  tabText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textMuted },
  hero: { alignItems: 'center', gap: spacing.sm },
  heroIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  heroTitle: { fontFamily: fonts.display, fontSize: 34, color: colors.text },
  heroTagline: { fontFamily: fonts.regular, fontSize: 16, color: colors.textMuted },
  currentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(61,220,151,0.12)',
    marginTop: spacing.xs,
  },
  currentText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.mint },
  perks: { gap: 4 },
  perk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: radii.md,
  },
  perkText: { flex: 1, fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.text },
  durations: { flexDirection: 'row', gap: spacing.sm },
  duration: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    paddingHorizontal: 4,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  popular: {
    position: 'absolute',
    top: -10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  popularText: { fontFamily: fonts.bold, fontSize: 9, letterSpacing: 0.5 },
  durationLabel: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  durationPerMonth: { fontFamily: fonts.bold, fontSize: 19, color: colors.text, marginTop: spacing.sm },
  durationUnit: { fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted },
  durationTotal: { fontFamily: fonts.regular, fontSize: 10, color: colors.textFaint, marginTop: 6, textAlign: 'center' },
  savings: { marginTop: spacing.sm, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.pill },
  savingsText: { fontFamily: fonts.bold, fontSize: 10 },
  notice: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  demo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: 'rgba(232,194,122,0.1)',
  },
  demoText: { flex: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.gold },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md, gap: spacing.sm },
  cta: { minHeight: 56, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: fonts.bold, fontSize: 16 },
  unavailable: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  legalLink: { textDecorationLine: 'underline' },
  legal: { fontFamily: fonts.regular, fontSize: 10, lineHeight: 14, color: colors.textFaint, textAlign: 'center' },
});

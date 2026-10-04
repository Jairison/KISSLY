import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/Button';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { BackendError, backend } from '@/services/backend';
import { INVITE_REWARD, inviteLink, type InviteInfo } from '@/services/invites';
import { colors, fonts, gradients, radii, spacing } from '@/theme';

export default function InviteScreen() {
  const { show } = useToast();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    backend
      .getInvite()
      .then(setInfo)
      .catch((e) => setError(e instanceof BackendError ? e.message : 'Não foi possível carregar seu convite.'));
  }, []);

  const message = info
    ? `Vem pro Kissly! 💘 Use meu código ${info.code} e ganhe ${INVITE_REWARD.inviteeDays} dias de Kissly Gold: ${inviteLink(info.code)}`
    : '';

  const copy = async () => {
    if (!info) return;
    await Clipboard.setStringAsync(inviteLink(info.code));
    show('Link copiado! É só colar no WhatsApp 😉', 'copy-outline', colors.mint);
  };

  const share = async () => {
    if (!info) return;
    try {
      if (Platform.OS === 'web') {
        // Navegadores sem o menu de compartilhar (ex.: computador): copia o convite.
        if (typeof navigator !== 'undefined' && navigator.share) await navigator.share({ text: message });
        else {
          await Clipboard.setStringAsync(message);
          show('Convite copiado! É só colar no WhatsApp 😉', 'copy-outline', colors.mint);
        }
      } else {
        await Share.share({ message });
      }
    } catch {
      // a pessoa fechou o menu de compartilhar
    }
  };

  const progress = info ? INVITE_REWARD.friendsPerReward - info.nextRewardIn : 0;

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader title="Convide amigos" />
      <ScrollView contentContainerStyle={styles.content}>
        <LinearGradient colors={gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="gift" size={34} color={colors.goldDeep} />
          </View>
          <Text style={styles.heroTitle}>Convide amigos, ganhe Gold</Text>
          <Text style={styles.heroText}>
            A cada {INVITE_REWARD.friendsPerReward} amigos que completarem o perfil com o seu código, você ganha{' '}
            <Text style={styles.bold}>{INVITE_REWARD.inviterDays} dias de Kissly Gold</Text>. E cada amigo ganha{' '}
            <Text style={styles.bold}>{INVITE_REWARD.inviteeDays} dias</Text> de boas-vindas.
          </Text>
        </LinearGradient>

        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : !info ? (
          <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.xl }} />
        ) : (
          <>
            <View style={styles.codeCard}>
              <Text style={styles.codeLabel}>SEU CÓDIGO</Text>
              <Text style={styles.code} selectable>
                {info.code}
              </Text>
              <Pressable onPress={copy} style={styles.copy} hitSlop={8}>
                <Ionicons name="copy-outline" size={16} color={colors.gold} />
                <Text style={styles.copyText}>Copiar link</Text>
              </Pressable>
            </View>

            <Button title="Compartilhar convite" icon="share-social" variant="gold" onPress={share} />

            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressTitle}>Próximo prêmio</Text>
                <Text style={styles.progressCount}>
                  {progress}/{INVITE_REWARD.friendsPerReward} amigos
                </Text>
              </View>
              <View style={styles.dots}>
                {Array.from({ length: INVITE_REWARD.friendsPerReward }).map((_, i) => (
                  <View key={i} style={[styles.dot, i < progress && styles.dotOn]}>
                    <Ionicons name={i < progress ? 'person' : 'person-outline'} size={18} color={i < progress ? colors.background : colors.textFaint} />
                  </View>
                ))}
                <Ionicons name="arrow-forward" size={18} color={colors.textFaint} />
                <View style={[styles.dot, styles.prize]}>
                  <Ionicons name="diamond" size={18} color={colors.gold} />
                </View>
              </View>
              <Text style={styles.stats}>
                {info.invited === 0
                  ? 'Nenhum amigo entrou ainda. Que tal mandar no grupo da galera?'
                  : `${info.invited} ${info.invited === 1 ? 'amigo entrou' : 'amigos entraram'} · ${info.rewardsEarned} ${info.rewardsEarned === 1 ? 'prêmio ganho' : 'prêmios ganhos'}`}
              </Text>
            </View>

            <Text style={styles.rules}>
              Vale para amigos que criarem conta e completarem o perfil usando o seu código nos primeiros 7 dias. Cada
              pessoa só pode usar um convite. Os dias de Gold se somam se você ganhar mais de um prêmio.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  hero: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl, borderRadius: radii.xl },
  heroIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
    marginBottom: spacing.xs,
  },
  heroTitle: { fontFamily: fonts.display, fontSize: 26, color: colors.background, textAlign: 'center' },
  heroText: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: '#3A2A10', textAlign: 'center' },
  bold: { fontFamily: fonts.bold },
  error: { fontFamily: fonts.regular, fontSize: 14, color: colors.danger, textAlign: 'center' },
  codeCard: {
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.xl,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(232,194,122,0.5)',
  },
  codeLabel: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 2, color: colors.textFaint },
  code: { fontFamily: fonts.bold, fontSize: 38, letterSpacing: 8, color: colors.gold },
  copy: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.xs },
  copyText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.gold },
  progressCard: { gap: spacing.md, padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.surface },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  progressTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  progressCount: { fontFamily: fonts.semibold, fontSize: 14, color: colors.gold },
  dots: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  dotOn: { backgroundColor: colors.gold },
  prize: { borderWidth: 1.5, borderColor: colors.gold, backgroundColor: 'transparent' },
  stats: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted },
  rules: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textFaint, textAlign: 'center' },
});

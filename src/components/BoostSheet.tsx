import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { useToast } from '@/components/Toast';
import { BackendError } from '@/services/backend';
import { useAppState } from '@/state/AppState';
import { colors, fonts, radii, spacing } from '@/theme';
import { BOOST_MINUTES } from '@/types/extras';

const VIOLET = ['#B58CFF', '#7B4DFF'] as const;

/** Minutos:segundos que faltam para o Boost acabar ("" se não estiver ativo). */
export function useBoostCountdown(activeUntil: string | null | undefined) {
  const [now, setNow] = useState(Date.now());
  const ends = activeUntil ? new Date(activeUntil).getTime() : 0;
  useEffect(() => {
    if (ends <= Date.now()) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [ends]);
  const left = Math.max(0, ends - now);
  if (!left) return '';
  const m = Math.floor(left / 60_000);
  const s = Math.floor((left % 60_000) / 1000);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function BoostSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { boost, activateBoost, plan } = useAppState();
  const { show } = useToast();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const countdown = useBoostCountdown(boost?.activeUntil);
  const included = plan === 'gold' || plan === 'platinum';

  const activate = async () => {
    if (!included) {
      onClose();
      router.push({ pathname: '/plans', params: { feature: 'boost' } });
      return;
    }
    setBusy(true);
    try {
      await activateBoost();
      show(`Boost ativado! Você está em destaque por ${BOOST_MINUTES} min ⚡`, 'flash', colors.violet);
      onClose();
    } catch (e) {
      show(e instanceof BackendError ? e.message : 'Não foi possível ativar o Boost', 'alert-circle', colors.danger);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
          <LinearGradient colors={VIOLET} style={styles.icon}>
            <Ionicons name="flash" size={34} color="#fff" />
          </LinearGradient>

          {countdown ? (
            <>
              <Text style={styles.title}>Boost ativo</Text>
              <Text style={styles.countdown}>{countdown}</Text>
              <Text style={styles.text}>Você está entre os primeiros perfis para quem está perto. Aproveite!</Text>
            </>
          ) : (
            <>
              <Text style={styles.title}>Seja visto(a) primeiro</Text>
              <Text style={styles.text}>
                Por {BOOST_MINUTES} minutos, seu perfil aparece antes para as pessoas da sua região. Funciona melhor no
                fim da tarde e à noite.
              </Text>
              {included && (
                <Text style={styles.left}>
                  {boost?.leftThisMonth ?? 0} {boost?.leftThisMonth === 1 ? 'Boost disponível' : 'Boosts disponíveis'} este mês
                </Text>
              )}
              <Pressable onPress={activate} disabled={busy} style={{ alignSelf: 'stretch' }}>
                <LinearGradient colors={VIOLET} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.button}>
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>{included ? 'Ativar Boost agora' : 'Liberar Boost com o Gold'}</Text>
                  )}
                </LinearGradient>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    backgroundColor: colors.surface,
  },
  icon: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.text, textAlign: 'center' },
  countdown: { fontFamily: fonts.bold, fontSize: 44, color: colors.violet },
  text: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.textMuted, textAlign: 'center' },
  left: { fontFamily: fonts.semibold, fontSize: 13, color: colors.violet },
  button: { minHeight: 56, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
  buttonText: { fontFamily: fonts.bold, fontSize: 16, color: '#fff' },
});

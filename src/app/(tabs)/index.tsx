import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSharedValue } from 'react-native-reanimated';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { ActionButtons } from '@/components/ActionButtons';
import { Logo } from '@/components/Logo';
import { ScopeSelector } from '@/components/ScopeSelector';
import { SwipeCard, type SwipeCardHandle, type SwipeDirection } from '@/components/SwipeCard';
import { useToast } from '@/components/Toast';
import { buildDeck, profiles, type DiscoveryScope, type Profile } from '@/data/profiles';
import { useAppState } from '@/state/AppState';
import { useCurrentUser, useSession } from '@/state/Session';
import { colors, fonts, gradients, radii, spacing } from '@/theme';

export default function DiscoverScreen() {
  const { plan, addMatch } = useAppState();
  const user = useCurrentUser();
  const { prefs } = useSession();
  const hasPremium = plan === 'gold' || plan === 'platinum';

  const [scope, setScope] = useState<DiscoveryScope>('state');
  const [index, setIndex] = useState(0);
  const deck = useMemo(() => buildDeck(profiles, user, prefs, scope), [user, prefs, scope]);

  // Filtros novos = baralho novo, recomeçando do primeiro perfil.
  useEffect(() => setIndex(0), [deck]);

  const progress = useSharedValue(0);
  const topCard = useRef<SwipeCardHandle>(null);
  const { show } = useToast();

  const current = deck[index];
  const next = deck[index + 1];

  const changeScope = (value: DiscoveryScope) => {
    if (value === 'international' && !hasPremium) {
      show('Conheça pessoas do mundo todo com o Kissly Gold', 'globe-outline');
      return;
    }
    setScope(value);
    setIndex(0);
  };

  const handleSwiped = (profile: Profile, direction: SwipeDirection) => {
    progress.value = 0;
    setIndex((i) => i + 1);
    if (direction === 'left') return;
    if (direction === 'up') show(`Super Like enviado para ${profile.name}`, 'star', colors.sky);
    if (profile.likesYou) {
      addMatch(profile);
      router.push({ pathname: '/match/[id]', params: { id: profile.id } });
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Logo />
        <Pressable style={styles.iconButton} onPress={() => router.push('/filters')}>
          <Ionicons name="options-outline" size={22} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.scope}>
        <ScopeSelector value={scope} onChange={changeScope} hasPremium={hasPremium} />
      </View>

      <View style={styles.deck}>
        {current ? (
          // O card de trás é renderizado primeiro para ficar embaixo do card do topo.
          [next, current].map((profile) =>
            profile ? (
              <SwipeCard
                key={profile.id}
                ref={profile === current ? topCard : undefined}
                profile={profile}
                isTop={profile === current}
                progress={progress}
                onSwiped={handleSwiped}
              />
            ) : null,
          )
        ) : (
          <EmptyDeck scope={scope} onRestart={() => setIndex(0)} onExpand={() => changeScope('national')} />
        )}
      </View>

      <View style={styles.actions}>
        <ActionButtons
          disabled={!current}
          onRewind={() => show('Voltar perfis é um recurso do Kissly Plus', 'arrow-undo')}
          onNope={() => topCard.current?.swipe('left')}
          onSuper={() => topCard.current?.swipe('up')}
          onLike={() => topCard.current?.swipe('right')}
          onBoost={() => show('Boost: seja destaque por 30 min no Kissly Gold', 'flash', colors.violet)}
        />
      </View>

    </SafeAreaView>
  );
}

function EmptyDeck({ scope, onRestart, onExpand }: { scope: DiscoveryScope; onRestart: () => void; onExpand: () => void }) {
  return (
    <View style={styles.empty}>
      <LinearGradient colors={gradients.brand} style={styles.emptyIcon}>
        <Ionicons name="heart-half" size={34} color="#fff" />
      </LinearGradient>
      <Text style={styles.emptyTitle}>Você viu todo mundo por aqui</Text>
      <Text style={styles.emptyText}>
        Novas pessoas entram no Kissly o tempo todo. Volte mais tarde ou amplie seu alcance.
      </Text>
      {scope === 'state' && (
        <Pressable style={styles.primaryButton} onPress={onExpand}>
          <Text style={styles.primaryButtonText}>Explorar o Brasil inteiro</Text>
        </Pressable>
      )}
      <Pressable onPress={() => router.push('/filters')} style={styles.linkButton}>
        <Text style={styles.linkText}>Ajustar filtros</Text>
      </Pressable>
      <Pressable onPress={onRestart} style={styles.linkButton}>
        <Text style={styles.linkText}>Rever perfis</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  scope: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  deck: { flex: 1, marginHorizontal: spacing.md, marginTop: spacing.lg },
  actions: { paddingVertical: spacing.lg },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxl, gap: spacing.md },
  emptyIcon: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  emptyTitle: { fontFamily: fonts.display, fontSize: 24, color: colors.text, textAlign: 'center' },
  emptyText: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.textMuted, textAlign: 'center' },
  primaryButton: {
    marginTop: spacing.md,
    backgroundColor: colors.text,
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
    borderRadius: radii.pill,
  },
  primaryButtonText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.background },
  linkButton: { padding: spacing.sm },
  linkText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted },
});

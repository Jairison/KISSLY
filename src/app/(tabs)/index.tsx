import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSharedValue } from 'react-native-reanimated';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { ActionButtons } from '@/components/ActionButtons';
import { Logo } from '@/components/Logo';
import { ScopeSelector } from '@/components/ScopeSelector';
import { SwipeCard, type SwipeCardHandle } from '@/components/SwipeCard';
import { useToast } from '@/components/Toast';
import { BackendError, backend } from '@/services/backend';
import { useAppState } from '@/state/AppState';
import { useDeck } from '@/state/useDeck';
import { colors, fonts, gradients, radii, spacing } from '@/theme';
import { isPremium, type DiscoveryScope, type Profile, type SwipeDirection } from '@/types/user';

const DIRECTION = { left: 'nope', right: 'like', up: 'super' } as const;

export default function DiscoverScreen() {
  const { plan, addMatch } = useAppState();
  const hasPremium = isPremium(plan);
  const { show } = useToast();

  const [scope, setScope] = useState<DiscoveryScope>('state');
  const { queue, status, error, pop, reload } = useDeck(scope);

  const progress = useSharedValue(0);
  const topCard = useRef<SwipeCardHandle>(null);

  const current = queue[0];
  const next = queue[1];

  const changeScope = (value: DiscoveryScope) => {
    if (value === 'international' && !hasPremium) {
      show('Conheça pessoas do mundo todo com o Kissly Gold', 'globe-outline');
      return;
    }
    setScope(value);
  };

  const handleSwiped = (profile: Profile, direction: SwipeDirection) => {
    progress.value = 0;
    pop();
    if (direction === 'up') show(`Super Like enviado para ${profile.name}`, 'star', colors.sky);

    backend
      .swipe(profile, DIRECTION[direction])
      .then(({ matched, matchId }) => {
        if (!matched || !matchId) return;
        addMatch(profile, matchId);
        router.push({ pathname: '/match/[id]', params: { id: matchId } });
      })
      .catch((e) =>
        show(e instanceof BackendError ? e.message : 'Não foi possível registrar seu swipe', 'cloud-offline-outline', colors.danger),
      );
  };

  let content;
  if (status === 'loading') {
    content = (
      <View style={styles.empty}>
        <ActivityIndicator size="large" color={colors.rose} />
        <Text style={styles.emptyText}>Procurando pessoas incríveis…</Text>
      </View>
    );
  } else if (status === 'error') {
    content = (
      <View style={styles.empty}>
        <Ionicons name="cloud-offline-outline" size={44} color={colors.textFaint} />
        <Text style={styles.emptyText}>{error}</Text>
        <Pressable style={styles.primaryButton} onPress={reload}>
          <Text style={styles.primaryButtonText}>Tentar de novo</Text>
        </Pressable>
      </View>
    );
  } else if (!current) {
    content = <EmptyDeck scope={scope} onReload={reload} onExpand={() => changeScope('national')} />;
  } else {
    // O card de trás é renderizado primeiro para ficar embaixo do card do topo.
    content = [next, current].map((profile) =>
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
    );
  }

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

      <View style={styles.deck}>{content}</View>

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

function EmptyDeck({ scope, onReload, onExpand }: { scope: DiscoveryScope; onReload: () => void; onExpand: () => void }) {
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
      <Pressable onPress={onReload} style={styles.linkButton}>
        <Text style={styles.linkText}>Atualizar</Text>
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

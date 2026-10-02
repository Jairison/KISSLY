import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { useToast } from '@/components/Toast';
import { useAppState } from '@/state/AppState';
import { useCurrentUser, useSession } from '@/state/Session';
import { colors, fonts, gradients, radii, spacing } from '@/theme';
import { ageFromBirthdate, profileCompletion } from '@/types/user';

type IconName = keyof typeof Ionicons.glyphMap;

const GOLD_PERKS: { icon: IconName; text: string }[] = [
  { icon: 'eye-outline', text: 'Veja quem curtiu você' },
  { icon: 'globe-outline', text: 'Modo Internacional: conheça o mundo' },
  { icon: 'infinite-outline', text: 'Kiss ilimitados e voltar perfis' },
  { icon: 'flash-outline', text: '1 Boost grátis por mês' },
];

const PLAN_LABEL = { free: 'Kissly Free', plus: 'Kissly Plus', gold: 'Kissly Gold', platinum: 'Kissly Platinum' };

export default function ProfileScreen() {
  const { plan } = useAppState();
  const user = useCurrentUser();
  const { account, signOut } = useSession();
  const { show } = useToast();
  const completion = profileCompletion(user);

  const menu: { icon: IconName; label: string; href?: Href; soon?: string }[] = [
    { icon: 'create-outline', label: 'Editar perfil', href: '/edit-profile' },
    { icon: 'options-outline', label: 'Preferências de descoberta', href: '/filters' },
    { icon: 'shield-checkmark-outline', label: 'Segurança e privacidade', soon: 'Verificação de perfil chega na Parte 6' },
    { icon: 'notifications-outline', label: 'Notificações', soon: 'Notificações chegam na Parte 6' },
  ];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Pressable onPress={() => router.push('/edit-profile')}>
            <LinearGradient colors={gradients.brand} style={styles.ring}>
              <Image source={user.photos[0]} style={styles.avatar} />
            </LinearGradient>
            <View style={styles.editBadge}>
              <Ionicons name="pencil" size={14} color={colors.background} />
            </View>
          </Pressable>
          <Text style={styles.name}>
            {user.name}, <Text style={styles.age}>{ageFromBirthdate(user.birthdate)}</Text>
          </Text>
          <Text style={styles.location}>
            {user.city}, {user.state} · {PLAN_LABEL[plan]}
          </Text>

          <View style={styles.progressTrack}>
            <LinearGradient
              colors={gradients.brand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: `${completion * 100}%` }]}
            />
          </View>
          <Text style={styles.progressText}>
            Perfil {Math.round(completion * 100)}% completo
            {completion < 1 ? ' · complete para aparecer mais' : ' ✨'}
          </Text>
        </View>

        <LinearGradient colors={['#2A2116', '#16111C']} style={styles.goldCard}>
          <View style={styles.goldHeader}>
            <Ionicons name="diamond" size={20} color={colors.gold} />
            <Text style={styles.goldTitle}>Kissly Gold</Text>
          </View>
          {GOLD_PERKS.map((perk) => (
            <View key={perk.text} style={styles.perk}>
              <Ionicons name={perk.icon} size={18} color={colors.gold} />
              <Text style={styles.perkText}>{perk.text}</Text>
            </View>
          ))}
          <Pressable onPress={() => show('Os planos chegam na Parte 5', 'diamond')}>
            <LinearGradient colors={gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.goldButton}>
              <Text style={styles.goldButtonText}>Conhecer os planos</Text>
            </LinearGradient>
          </Pressable>
        </LinearGradient>

        {menu.map((item) => (
          <Pressable
            key={item.label}
            style={styles.row}
            onPress={() => (item.href ? router.push(item.href) : show(item.soon!, item.icon))}
          >
            <Ionicons name={item.icon} size={20} color={colors.textMuted} />
            <Text style={styles.rowText}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </Pressable>
        ))}

        <Pressable style={styles.row} onPress={signOut}>
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={[styles.rowText, { color: colors.danger }]}>Sair</Text>
        </Pressable>
        <Text style={styles.account}>Conectado como {account?.email}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  hero: { alignItems: 'center', paddingVertical: spacing.lg },
  ring: { width: 128, height: 128, borderRadius: 64, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 118, height: 118, borderRadius: 59, borderWidth: 4, borderColor: colors.background },
  editBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.text,
    borderWidth: 3,
    borderColor: colors.background,
  },
  name: { fontFamily: fonts.display, fontSize: 28, color: colors.text, marginTop: spacing.md },
  age: { fontFamily: fonts.regular, fontSize: 24 },
  location: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted, marginTop: 4 },
  progressTrack: {
    width: '70%',
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceRaised,
    marginTop: spacing.lg,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },
  progressText: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, marginTop: 6 },
  goldCard: {
    borderRadius: radii.lg,
    padding: spacing.xl,
    marginVertical: spacing.xl,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(232,194,122,0.25)',
  },
  goldHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  goldTitle: { fontFamily: fonts.displayItalic, fontSize: 24, color: colors.gold },
  perk: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  perkText: { fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  goldButton: { alignItems: 'center', paddingVertical: 14, borderRadius: radii.pill, marginTop: spacing.sm },
  goldButtonText: { fontFamily: fonts.bold, fontSize: 15, color: colors.background },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowText: { flex: 1, fontFamily: fonts.medium, fontSize: 16, color: colors.text },
  account: { fontFamily: fonts.regular, fontSize: 12, color: colors.textFaint, textAlign: 'center', marginTop: spacing.xl },
});

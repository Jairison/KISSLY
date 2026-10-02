import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { useAppState } from '@/state/AppState';
import { colors, fonts, gradients, spacing } from '@/theme';

export default function ChatsScreen() {
  const { matches } = useAppState();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.title}>Mensagens</Text>

        <Text style={styles.section}>Novos matches</Text>
        {matches.length === 0 ? (
          <Text style={styles.muted}>Dê Kiss em quem você gostar. Quando for recíproco, aparece aqui.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.matchRow}>
            {matches.map((p) => (
              <View key={p.id} style={styles.match}>
                <LinearGradient colors={gradients.brand} style={styles.ring}>
                  <Image source={p.photos[0]} style={styles.avatar} />
                </LinearGradient>
                <Text style={styles.matchName}>{p.name}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        <Text style={[styles.section, { marginTop: spacing.xxl }]}>Conversas</Text>
        <View style={styles.empty}>
          <Ionicons name="chatbubbles-outline" size={40} color={colors.textFaint} />
          <Text style={styles.muted}>O chat em tempo real chega na Parte 4.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  title: { fontFamily: fonts.display, fontSize: 32, color: colors.text, marginBottom: spacing.xl },
  section: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.rose,
    marginBottom: spacing.md,
  },
  muted: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textMuted, textAlign: 'center' },
  matchRow: { gap: spacing.lg },
  match: { alignItems: 'center', gap: 6 },
  ring: { width: 74, height: 74, borderRadius: 37, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 66, height: 66, borderRadius: 33, borderWidth: 3, borderColor: colors.background },
  matchName: { fontFamily: fonts.medium, fontSize: 13, color: colors.text },
  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
});

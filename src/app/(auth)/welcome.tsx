import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { Logo } from '@/components/Logo';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/Button';
import { profiles } from '@/data/profiles';
import { colors, fonts, spacing } from '@/theme';

const COLUMNS = 3;

export default function WelcomeScreen() {
  const { width, height } = useWindowDimensions();
  const { show } = useToast();
  const tile = width / 2.4;
  const photos = profiles.map((p) => p.photos[0]);

  return (
    <View style={styles.screen}>
      {/* Mosaico inclinado de fotos ao fundo */}
      <Animated.View entering={FadeIn.duration(900)} style={[styles.mosaic, { width: width * 1.5, left: -width * 0.25 }]}>
        {Array.from({ length: COLUMNS }).map((_, col) => (
          <View key={col} style={[styles.column, { marginTop: col % 2 ? -tile * 0.6 : 0 }]}>
            {photos
              .filter((_, i) => i % COLUMNS === col)
              .map((uri) => (
                <Image key={uri} source={uri} style={[styles.tile, { width: tile, height: tile * 1.3 }]} />
              ))}
          </View>
        ))}
      </Animated.View>
      <LinearGradient
        colors={['rgba(11,8,16,0.2)', 'rgba(11,8,16,0.75)', colors.background, colors.background]}
        locations={[0, 0.38, 0.6, 1]}
        style={[StyleSheet.absoluteFill, { height }]}
      />

      <SafeAreaView style={styles.content}>
        <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.brand}>
          <Logo size={44} />
          <Text style={styles.tagline}>Onde conexões viram histórias.</Text>
          <Text style={styles.sub}>Pessoas reais do seu estado, do Brasil e do mundo inteiro.</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.actions}>
          <Button title="Criar conta" onPress={() => router.push('/signup')} />
          <Button title="Já tenho conta" variant="outline" onPress={() => router.push('/login')} />

          <View style={styles.socialRow}>
            <Button
              title="Apple"
              variant="light"
              leading={<Ionicons name="logo-apple" size={20} color={colors.background} />}
              onPress={() => show('Login com Apple chega junto com o Supabase, na Parte 3', 'logo-apple', colors.text)}
              style={{ flex: 1 }}
            />
            <Button
              title="Google"
              variant="light"
              leading={<Ionicons name="logo-google" size={18} color={colors.background} />}
              onPress={() => show('Login com Google chega junto com o Supabase, na Parte 3', 'logo-google', colors.text)}
              style={{ flex: 1 }}
            />
          </View>

          <Text style={styles.legal}>
            Ao continuar, você confirma ter 18 anos ou mais e concorda com os Termos de Uso e a Política de Privacidade do
            Kissly.
          </Text>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, overflow: 'hidden' },
  mosaic: {
    position: 'absolute',
    top: -40,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    transform: [{ rotate: '-10deg' }],
  },
  column: { gap: 12 },
  tile: { borderRadius: 22, backgroundColor: colors.surface },
  content: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
  brand: { gap: spacing.md, marginBottom: spacing.xxl },
  tagline: { fontFamily: fonts.display, fontSize: 34, lineHeight: 42, color: colors.text, marginTop: spacing.sm },
  sub: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, color: colors.textMuted },
  actions: { gap: spacing.md },
  socialRow: { flexDirection: 'row', gap: spacing.md },
  legal: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});

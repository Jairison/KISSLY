import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '@/components/ui/Button';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { TextField } from '@/components/ui/TextField';
import { BackendError, backend, isValidEmail } from '@/services/backend';
import { colors, fonts, spacing } from '@/theme';

export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      await backend.sendPasswordReset(email);
      setSent(true);
    } catch (e) {
      setError(e instanceof BackendError ? e.message : 'Algo deu errado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {sent ? (
            <View style={styles.sent}>
              <View style={styles.icon}>
                <Ionicons name="mail-open-outline" size={34} color={colors.rose} />
              </View>
              <Text style={styles.title}>Confira seu e-mail</Text>
              <Text style={styles.subtitle}>
                Se existir uma conta com {email.trim()}, você vai receber um link para criar uma nova senha. Abra o link
                neste aparelho.
              </Text>
              <Button title="Voltar para o login" variant="outline" onPress={() => router.back()} style={{ alignSelf: 'stretch' }} />
            </View>
          ) : (
            <>
              <Text style={styles.title}>Esqueceu a senha?</Text>
              <Text style={styles.subtitle}>Sem problema. Enviaremos um link para você criar uma nova.</Text>
              <TextField
                label="E-mail da conta"
                icon="mail-outline"
                placeholder="voce@email.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoFocus
                error={error}
                onSubmitEditing={submit}
              />
              <Button title="Enviar link" onPress={submit} loading={loading} disabled={!isValidEmail(email)} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, gap: spacing.xl, flexGrow: 1 },
  title: { fontFamily: fonts.display, fontSize: 30, color: colors.text, textAlign: 'left' },
  subtitle: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.textMuted, marginTop: -spacing.md },
  sent: { flex: 1, justifyContent: 'center', gap: spacing.xl },
  icon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,61,127,0.12)',
  },
});

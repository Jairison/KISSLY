import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { Button } from '@/components/ui/Button';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { TextField } from '@/components/ui/TextField';
import { BackendError } from '@/services/backend';
import { useSession } from '@/state/Session';
import { colors, fonts, spacing } from '@/theme';

export default function LoginScreen() {
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
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
          <Text style={styles.title}>Bem-vindo de volta</Text>
          <Text style={styles.subtitle}>Alguém pode estar esperando seu Kiss.</Text>

          <View style={styles.form}>
            <TextField
              label="E-mail"
              icon="mail-outline"
              placeholder="voce@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <TextField
              ref={passwordRef}
              label="Senha"
              icon="lock-closed-outline"
              placeholder="Sua senha"
              value={password}
              onChangeText={setPassword}
              password
              autoComplete="password"
              returnKeyType="go"
              onSubmitEditing={submit}
              error={error}
            />
            <Pressable onPress={() => router.push({ pathname: '/forgot-password', params: { email } })}>
              <Text style={styles.forgot}>Esqueci minha senha</Text>
            </Pressable>
          </View>

          <Button title="Entrar" onPress={submit} loading={loading} disabled={!email || !password} />

          <Pressable onPress={() => router.replace('/signup')} style={styles.switch}>
            <Text style={styles.switchText}>
              Novo por aqui? <Text style={styles.switchLink}>Criar conta</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, gap: spacing.xl },
  title: { fontFamily: fonts.display, fontSize: 32, color: colors.text },
  subtitle: { fontFamily: fonts.regular, fontSize: 16, color: colors.textMuted, marginTop: -spacing.md },
  form: { gap: spacing.sm },
  forgot: { fontFamily: fonts.medium, fontSize: 14, color: colors.rose, alignSelf: 'flex-end' },
  switch: { alignItems: 'center', padding: spacing.sm },
  switchText: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted },
  switchLink: { fontFamily: fonts.semibold, color: colors.text },
});

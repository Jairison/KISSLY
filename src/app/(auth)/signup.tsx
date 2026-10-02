import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '@/components/ui/Button';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { TextField } from '@/components/ui/TextField';
import { AuthError, PASSWORD_MIN, isValidEmail } from '@/services/auth';
import { useSession } from '@/state/Session';
import { colors, fonts, radii, spacing } from '@/theme';

function passwordStrength(pw: string): { label: string; color: string; level: number } {
  let score = 0;
  if (pw.length >= PASSWORD_MIN) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: 'Fraca', color: colors.danger, level: 1 };
  if (score <= 2) return { label: 'Média', color: colors.gold, level: 2 };
  return { label: 'Forte', color: colors.mint, level: 3 };
}

export default function SignupScreen() {
  const { signUp } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const emailError = touched && email && !isValidEmail(email) ? 'E-mail inválido' : null;
  const confirmError = confirm && confirm !== password ? 'As senhas não coincidem' : null;
  const strength = passwordStrength(password);
  const valid = isValidEmail(email) && password.length >= PASSWORD_MIN && confirm === password && accepted;

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      // Ao criar a conta, a sessão vai para "onboarding" e o app abre o cadastro do perfil.
      await signUp(email, password);
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'Algo deu errado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Crie sua conta</Text>
          <Text style={styles.subtitle}>Leva menos de dois minutos. Prometemos.</Text>

          <View style={styles.form}>
            <TextField
              label="E-mail"
              icon="mail-outline"
              placeholder="voce@email.com"
              value={email}
              onChangeText={setEmail}
              onBlur={() => setTouched(true)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              error={emailError}
            />
            <TextField
              ref={passwordRef}
              label="Senha"
              icon="lock-closed-outline"
              placeholder={`Mínimo de ${PASSWORD_MIN} caracteres`}
              value={password}
              onChangeText={setPassword}
              password
              autoComplete="new-password"
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
            />
            {password.length > 0 && (
              <View style={styles.strength}>
                {[1, 2, 3].map((n) => (
                  <View
                    key={n}
                    style={[styles.strengthBar, { backgroundColor: n <= strength.level ? strength.color : colors.surfaceRaised }]}
                  />
                ))}
                <Text style={[styles.strengthText, { color: strength.color }]}>{strength.label}</Text>
              </View>
            )}
            <TextField
              ref={confirmRef}
              label="Confirmar senha"
              icon="shield-checkmark-outline"
              placeholder="Digite a senha novamente"
              value={confirm}
              onChangeText={setConfirm}
              password
              autoComplete="new-password"
              error={confirmError}
            />

            <Pressable onPress={() => setAccepted((a) => !a)} style={styles.terms}>
              <View style={[styles.checkbox, accepted && styles.checkboxOn]}>
                {accepted && <Ionicons name="checkmark" size={16} color="#fff" />}
              </View>
              <Text style={styles.termsText}>
                Tenho 18 anos ou mais e aceito os <Text style={styles.termsLink}>Termos de Uso</Text> e a{' '}
                <Text style={styles.termsLink}>Política de Privacidade</Text>.
              </Text>
            </Pressable>
            {error && <Text style={styles.error}>{error}</Text>}
          </View>

          <Button title="Continuar" onPress={submit} loading={loading} disabled={!valid} />

          <Pressable onPress={() => router.replace('/login')} style={styles.switch}>
            <Text style={styles.switchText}>
              Já tem conta? <Text style={styles.switchLink}>Entrar</Text>
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
  strength: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -spacing.sm, marginBottom: spacing.sm, paddingHorizontal: 4 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthText: { fontFamily: fonts.semibold, fontSize: 12, marginLeft: 6, minWidth: 40 },
  terms: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', marginTop: spacing.sm },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.textFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.rose, borderColor: colors.rose },
  termsText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.textMuted },
  termsLink: { fontFamily: fonts.semibold, color: colors.text },
  error: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.danger,
    backgroundColor: 'rgba(255,84,112,0.1)',
    padding: spacing.md,
    borderRadius: radii.sm,
    marginTop: spacing.sm,
  },
  switch: { alignItems: 'center', padding: spacing.sm },
  switchText: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted },
  switchLink: { fontFamily: fonts.semibold, color: colors.text },
});

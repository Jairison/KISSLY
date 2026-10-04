import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '@/components/ui/Button';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { TextField } from '@/components/ui/TextField';
import { BackendError, PASSWORD_MIN, isValidEmail } from '@/services/backend';
import {
  INVITE_REWARD,
  getPendingInvite,
  isInviteCodeShape,
  normalizeInviteCode,
  setPendingInvite,
} from '@/services/invites';
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
  const [confirmSent, setConfirmSent] = useState(false);
  const [invite, setInvite] = useState('');
  const [showInvite, setShowInvite] = useState(false);

  // Se a pessoa chegou por um link de convite, o código já vem preenchido.
  useEffect(() => {
    getPendingInvite().then((code) => {
      if (code) {
        setInvite(code);
        setShowInvite(true);
      }
    });
  }, []);
  const inviteError = invite && !isInviteCodeShape(invite) ? 'O código tem 6 letras/números' : null;
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const emailError = touched && email && !isValidEmail(email) ? 'E-mail inválido' : null;
  const confirmError = confirm && confirm !== password ? 'As senhas não coincidem' : null;
  const strength = passwordStrength(password);
  const valid =
    isValidEmail(email) && password.length >= PASSWORD_MIN && confirm === password && accepted && !inviteError;

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      // Ao criar a conta, a sessão vai para "onboarding" e o app abre o cadastro do perfil.
      await setPendingInvite(invite || null);
      const result = await signUp(email, password);
      if (result.status === 'confirmEmail') setConfirmSent(true);
    } catch (e) {
      setError(e instanceof BackendError ? e.message : 'Algo deu errado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (confirmSent) {
    return (
      <SafeAreaView style={styles.screen}>
        <ScreenHeader />
        <View style={styles.sent}>
          <View style={styles.sentIcon}>
            <Ionicons name="mail-unread-outline" size={36} color={colors.rose} />
          </View>
          <Text style={styles.title}>Confirme seu e-mail</Text>
          <Text style={styles.sentText}>
            Enviamos um link para <Text style={styles.termsLink}>{email.trim()}</Text>. Abra o e-mail, toque no link e
            depois é só entrar com sua senha.
          </Text>
          <Button title="Ir para o login" onPress={() => router.replace('/login')} style={{ alignSelf: 'stretch' }} />
        </View>
      </SafeAreaView>
    );
  }

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

            {showInvite ? (
              <TextField
                label="Código de convite (opcional)"
                icon="gift-outline"
                placeholder="Ex.: K7M2QP"
                value={invite}
                onChangeText={(t) => setInvite(normalizeInviteCode(t).slice(0, 6))}
                autoCapitalize="characters"
                autoCorrect={false}
                error={inviteError}
                hint={`Você ganha ${INVITE_REWARD.inviteeDays} dias de Kissly Gold ao completar o perfil`}
              />
            ) : (
              <Pressable onPress={() => setShowInvite(true)} style={styles.inviteLink}>
                <Ionicons name="gift-outline" size={16} color={colors.gold} />
                <Text style={styles.inviteLinkText}>Tenho um código de convite</Text>
              </Pressable>
            )}

            <Pressable onPress={() => setAccepted((a) => !a)} style={styles.terms}>
              <View style={[styles.checkbox, accepted && styles.checkboxOn]}>
                {accepted && <Ionicons name="checkmark" size={16} color="#fff" />}
              </View>
              <Text style={styles.termsText}>
                Tenho 18 anos ou mais e aceito os <Text style={styles.termsLink} onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'terms' } })}>Termos de Uso</Text> e a{' '}
                <Text style={styles.termsLink} onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'privacy' } })}>Política de Privacidade</Text>.
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
  inviteLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: spacing.sm },
  inviteLinkText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.gold },
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
  sent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl },
  sentIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,61,127,0.12)',
  },
  sentText: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.textMuted, textAlign: 'center' },
  switch: { alignItems: 'center', padding: spacing.sm },
  switchText: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted },
  switchLink: { fontFamily: fonts.semibold, color: colors.text },
});

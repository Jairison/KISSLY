import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';

import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { BackendError, PASSWORD_MIN, backend } from '@/services/backend';
import { colors, fonts, spacing } from '@/theme';

/** Aberta pelo link do e-mail "redefinir senha". Fica fora das rotas protegidas. */
export default function ResetPasswordScreen() {
  const url = Linking.useLinkingURL();
  const { show } = useToast();
  const [phase, setPhase] = useState<'checking' | 'form' | 'invalid'>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!url) return;
    backend
      .completeAuthRedirect(url)
      .then((ok) => setPhase(ok ? 'form' : 'invalid'))
      .catch(() => setPhase('invalid'));
  }, [url]);

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      await backend.updatePassword(password);
      show('Senha alterada com sucesso', 'checkmark-circle', colors.mint);
      router.replace('/');
    } catch (e) {
      setError(e instanceof BackendError ? e.message : 'Não foi possível alterar a senha.');
      setSaving(false);
    }
  };

  if (phase === 'checking') {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.rose} size="large" />
      </View>
    );
  }

  if (phase === 'invalid') {
    return (
      <SafeAreaView style={[styles.screen, styles.center, { padding: spacing.xl, gap: spacing.lg }]}>
        <Text style={styles.title}>Link expirado</Text>
        <Text style={styles.subtitle}>Esse link não é mais válido. Peça um novo na tela de login.</Text>
        <Button title="Voltar" onPress={() => router.replace('/')} style={{ alignSelf: 'stretch' }} />
      </SafeAreaView>
    );
  }

  const valid = password.length >= PASSWORD_MIN && password === confirm;

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Crie uma nova senha</Text>
          <Text style={styles.subtitle}>Escolha uma senha forte que você não use em outros lugares.</Text>
          <TextField
            label="Nova senha"
            icon="lock-closed-outline"
            placeholder={`Mínimo de ${PASSWORD_MIN} caracteres`}
            value={password}
            onChangeText={setPassword}
            password
            autoComplete="new-password"
          />
          <TextField
            label="Confirmar nova senha"
            icon="shield-checkmark-outline"
            value={confirm}
            onChangeText={setConfirm}
            password
            autoComplete="new-password"
            error={error ?? (confirm && confirm !== password ? 'As senhas não coincidem' : null)}
          />
          <Button title="Salvar nova senha" onPress={save} loading={saving} disabled={!valid} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.xl, gap: spacing.lg },
  title: { fontFamily: fonts.display, fontSize: 30, color: colors.text },
  subtitle: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.textMuted },
});

import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/Button';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { TextField } from '@/components/ui/TextField';
import { BackendError } from '@/services/backend';
import { useSession } from '@/state/Session';
import { colors, fonts, radii, spacing } from '@/theme';

const CONFIRM_WORD = 'EXCLUIR';

const LOSSES = [
  'Seu perfil e suas fotos',
  'Todos os seus matches e curtidas',
  'Suas preferências de descoberta',
];

export default function DeleteAccountScreen() {
  const { deleteAccount } = useSession();
  const { show } = useToast();
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);

  const confirm = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
      show('Sua conta foi excluída', 'checkmark-circle', colors.mint);
    } catch (e) {
      show(e instanceof BackendError ? e.message : 'Não foi possível excluir a conta.', 'alert-circle', colors.danger);
      setDeleting(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader title="Excluir conta" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.icon}>
          <Ionicons name="warning-outline" size={34} color={colors.danger} />
        </View>
        <Text style={styles.title}>Tem certeza?</Text>
        <Text style={styles.text}>Esta ação é definitiva e não pode ser desfeita. Você vai perder:</Text>

        <View style={styles.card}>
          {LOSSES.map((item) => (
            <View key={item} style={styles.row}>
              <Ionicons name="close-circle" size={18} color={colors.danger} />
              <Text style={styles.rowText}>{item}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.text}>
          Assinaturas pagas nas lojas não são canceladas automaticamente: cancele também na App Store ou no Google Play.
        </Text>

        <TextField
          label={`Digite ${CONFIRM_WORD} para confirmar`}
          value={typed}
          onChangeText={setTyped}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <Button
          title="Excluir minha conta"
          variant="outline"
          onPress={confirm}
          loading={deleting}
          disabled={typed.trim().toUpperCase() !== CONFIRM_WORD}
          style={{ borderColor: colors.danger }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, gap: spacing.lg },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,84,112,0.12)',
  },
  title: { fontFamily: fonts.display, fontSize: 30, color: colors.text },
  text: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.textMuted },
  card: { gap: spacing.md, padding: spacing.lg, borderRadius: radii.md, backgroundColor: colors.surface },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowText: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
});

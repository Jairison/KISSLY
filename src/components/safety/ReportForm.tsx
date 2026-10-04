import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/Button';
import { ChoiceList } from '@/components/ui/ChipGroup';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { TextField } from '@/components/ui/TextField';
import { BackendError, backend } from '@/services/backend';
import { colors, fonts, radii, spacing } from '@/theme';
import { REPORT_REASONS, type ReportReason } from '@/types/chat';

type Props = {
  profile: { id: string; name: string };
  /** Chamado depois de denunciar e bloquear com sucesso (para fechar a tela e atualizar listas). */
  onDone: () => void;
};

/**
 * Denúncia anônima. Por segurança, denunciar também bloqueia a pessoa
 * (nenhum dos dois volta a ver o outro e um match existente é desfeito).
 */
export function ReportForm({ profile, onDone }: Props) {
  const { show } = useToast();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const needsDetails = reason === 'other' && details.trim().length < 5;

  const submit = async () => {
    if (!reason) return;
    setSending(true);
    try {
      await backend.report(profile.id, reason, details);
      await backend.blockUser(profile.id);
      onDone();
      show('Denúncia enviada. Obrigado por proteger a comunidade.', 'shield-checkmark', colors.mint);
    } catch (e) {
      show(e instanceof BackendError ? e.message : 'Não foi possível enviar a denúncia', 'alert-circle', colors.danger);
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader mode="close" title="Denunciar" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>O que aconteceu com {profile.name}?</Text>
          <View style={styles.notice}>
            <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
            <Text style={styles.noticeText}>
              Sua denúncia é anônima e {profile.name} não será avisado(a). A pessoa também é bloqueada: vocês não vão mais se ver.
            </Text>
          </View>

          <ChoiceList large options={REPORT_REASONS} value={reason} onChange={setReason} />

          <TextField
            label={reason === 'other' ? 'Conte o que aconteceu' : 'Detalhes (opcional)'}
            placeholder="Isso ajuda nossa equipe a analisar mais rápido"
            value={details}
            onChangeText={setDetails}
            multiline
            maxLength={1000}
            counter
          />

          <Button
            title="Enviar denúncia"
            icon="flag"
            onPress={submit}
            loading={sending}
            disabled={!reason || needsDetails}
          />
          <Text style={styles.emergency}>
            Se você estiver em perigo, ligue 190 (Polícia) ou 180 (Central de Atendimento à Mulher).
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, gap: spacing.lg },
  title: { fontFamily: fonts.display, fontSize: 26, color: colors.text },
  notice: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  noticeText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.textMuted },
  emergency: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textFaint, textAlign: 'center' },
});

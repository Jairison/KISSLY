import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/Button';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { backend } from '@/services/backend';
import { PUSH_UNSUPPORTED_REASON, disablePush, enablePush, permissionStatus, pushSupport } from '@/services/push';
import { colors, fonts, radii, spacing } from '@/theme';
import type { NotificationSettings } from '@/types/extras';

export default function NotificationsScreen() {
  const { show } = useToast();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [permission, setPermission] = useState<Awaited<ReturnType<typeof permissionStatus>> | null>(null);
  const [busy, setBusy] = useState(false);
  const support = pushSupport();

  const refreshPermission = useCallback(() => {
    permissionStatus().then(setPermission);
  }, []);

  useEffect(() => {
    backend.loadNotificationSettings().then(setSettings).catch(() => setSettings({ newMatches: true, messages: true }));
    refreshPermission();
  }, [refreshPermission]);

  const toggle = async (key: keyof NotificationSettings, value: boolean) => {
    if (!settings) return;
    const next = { ...settings, [key]: value };
    setSettings(next);
    try {
      await backend.saveNotificationSettings(next);
    } catch {
      setSettings(settings);
      show('Não foi possível salvar', 'alert-circle', colors.danger);
    }
  };

  const enable = async () => {
    setBusy(true);
    const result = await enablePush();
    setBusy(false);
    refreshPermission();
    if (result.ok) show('Notificações ativadas neste aparelho', 'notifications', colors.mint);
    else show(result.reason, 'notifications-off-outline', colors.textMuted);
  };

  const disable = async () => {
    setBusy(true);
    await disablePush();
    setBusy(false);
    show('Este aparelho não vai mais receber notificações', 'notifications-off-outline', colors.textMuted);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader title="Notificações" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <Ionicons
              name={permission === 'granted' ? 'notifications' : 'notifications-off-outline'}
              size={22}
              color={permission === 'granted' ? colors.mint : colors.textMuted}
            />
            <Text style={styles.statusText}>
              {support !== 'ok'
                ? PUSH_UNSUPPORTED_REASON[support]
                : permission === 'granted'
                  ? 'Ativadas neste aparelho'
                  : permission === 'denied'
                    ? 'Bloqueadas nas configurações do aparelho'
                    : 'Desativadas neste aparelho'}
            </Text>
          </View>
          {support === 'ok' &&
            (permission === 'granted' ? (
              <Button title="Desativar neste aparelho" variant="outline" onPress={disable} loading={busy} />
            ) : (
              <Button title="Ativar notificações" icon="notifications" onPress={enable} loading={busy} />
            ))}
        </View>

        <Text style={styles.section}>Me avise quando</Text>
        <View style={styles.card}>
          <SettingRow
            icon="heart"
            title="Eu tiver um novo match"
            value={settings?.newMatches ?? true}
            onChange={(v) => toggle('newMatches', v)}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="chatbubble-ellipses"
            title="Chegar uma mensagem"
            value={settings?.messages ?? true}
            onChange={(v) => toggle('messages', v)}
          />
        </View>
        <Text style={styles.note}>
          Estas preferências valem para todos os seus aparelhos. O Kissly nunca envia propaganda por notificação.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingRow({
  icon,
  title,
  value,
  onChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={20} color={colors.rose} />
      <Text style={styles.rowTitle}>{title}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.rose, false: colors.surfaceRaised }}
        thumbColor="#fff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  card: { gap: spacing.md, padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.surface },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  statusText: { flex: 1, fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, color: colors.text },
  section: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.rose,
    marginTop: spacing.lg,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowTitle: { flex: 1, fontFamily: fonts.medium, fontSize: 16, color: colors.text },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  note: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textFaint },
});

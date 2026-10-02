import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';

import { useToast } from '@/components/Toast';
import { ActionSheet } from '@/components/ui/ActionSheet';
import { enablePush, markPushAsked, shouldAskForPush, syncPushIfGranted } from '@/services/push';
import { colors } from '@/theme';

/**
 * Liga as notificações com o app (só com a pessoa logada):
 * - abre a conversa certa ao tocar numa notificação;
 * - renova o registro do aparelho;
 * - convida, uma única vez, a ativar as notificações.
 */
export function PushBridge() {
  const { show } = useToast();
  const [ask, setAsk] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    syncPushIfGranted();

    const open = (response: Notifications.NotificationResponse | null) => {
      const url = response?.notification.request.content.data?.url;
      if (typeof url === 'string' && url.startsWith('/')) router.push(url as never);
    };
    // App aberto pela notificação (estava fechado).
    open(Notifications.getLastNotificationResponse());
    const subscription = Notifications.addNotificationResponseReceivedListener(open);

    const timer = setTimeout(async () => {
      if (await shouldAskForPush()) setAsk(true);
    }, 4000);

    return () => {
      subscription.remove();
      clearTimeout(timer);
    };
  }, []);

  const close = () => {
    setAsk(false);
    markPushAsked();
  };

  return (
    <ActionSheet
      visible={ask}
      onClose={close}
      title="Não perca nenhum match 💘"
      message="Avisamos quando alguém der match com você ou mandar mensagem. Nada de spam."
      actions={[
        {
          label: 'Ativar notificações',
          icon: 'notifications',
          onPress: async () => {
            setAsk(false);
            const result = await enablePush();
            if (result.ok) show('Notificações ativadas', 'notifications', colors.mint);
            else show(result.reason, 'notifications-off-outline', colors.textMuted);
          },
        },
      ]}
    />
  );
}

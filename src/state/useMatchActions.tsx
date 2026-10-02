import { useState } from 'react';
import { router } from 'expo-router';

import { useToast } from '@/components/Toast';
import { ActionSheet } from '@/components/ui/ActionSheet';
import { BackendError, backend } from '@/services/backend';
import { useAppState } from '@/state/AppState';
import { colors } from '@/theme';
import type { Conversation } from '@/types/chat';

/**
 * Menu "⋯" de um match: ver perfil, desfazer match (com confirmação) e denunciar.
 * Devolve `open` e o elemento `sheet` para a tela renderizar.
 */
export function useMatchActions(conversation: Conversation | undefined, options: { showProfile?: boolean } = {}) {
  const { removeConversation } = useAppState();
  const { show } = useToast();
  const [step, setStep] = useState<'closed' | 'menu' | 'confirmUnmatch'>('closed');

  const close = () => setStep('closed');
  const name = conversation?.profile.name ?? '';

  const unmatch = async () => {
    if (!conversation) return;
    close();
    try {
      await backend.unmatch(conversation.matchId);
      removeConversation(conversation.matchId);
      router.dismissTo('/chats');
      show(`Match com ${name} desfeito`, 'heart-dislike-outline', colors.textMuted);
    } catch (e) {
      show(e instanceof BackendError ? e.message : 'Não foi possível desfazer o match', 'alert-circle', colors.danger);
    }
  };

  const sheet = conversation ? (
    <ActionSheet
      visible={step !== 'closed'}
      onClose={close}
      title={step === 'confirmUnmatch' ? `Desfazer match com ${name}?` : undefined}
      message={
        step === 'confirmUnmatch'
          ? 'A conversa será apagada para os dois e vocês não vão mais aparecer um para o outro.'
          : undefined
      }
      actions={
        step === 'confirmUnmatch'
          ? [{ label: 'Sim, desfazer match', icon: 'heart-dislike', destructive: true, onPress: unmatch }]
          : [
              ...(options.showProfile !== false
                ? [
                    {
                      label: `Ver perfil de ${name}`,
                      icon: 'person-circle-outline' as const,
                      onPress: () => {
                        close();
                        router.push({ pathname: '/person/[matchId]', params: { matchId: conversation.matchId } });
                      },
                    },
                  ]
                : []),
              { label: 'Desfazer match', icon: 'heart-dislike-outline', onPress: () => setStep('confirmUnmatch') },
              {
                label: 'Denunciar',
                icon: 'flag-outline',
                destructive: true,
                onPress: () => {
                  close();
                  router.push({ pathname: '/report/[matchId]', params: { matchId: conversation.matchId } });
                },
              },
            ]
      }
    />
  ) : null;

  return { open: () => setStep('menu'), sheet };
}

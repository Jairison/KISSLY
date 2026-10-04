import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { ReportForm } from '@/components/safety/ReportForm';
import { useAppState } from '@/state/AppState';
import { colors } from '@/theme';

/** Denúncia a partir de uma conversa (menu "⋯" do chat ou do perfil do match). */
export default function ReportMatchScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { conversations, removeConversation } = useAppState();
  const conversation = conversations.find((c) => c.matchId === matchId);

  if (!conversation) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  return (
    <ReportForm
      profile={conversation.profile}
      onDone={() => {
        removeConversation(matchId);
        router.dismissTo('/chats');
      }}
    />
  );
}

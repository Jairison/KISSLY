import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';

import { backend } from '@/services/backend';
import { colors } from '@/theme';

/**
 * Destino dos links de confirmação de e-mail e do login social.
 * Conclui a sessão e volta para o início; o layout raiz decide a tela certa.
 */
export default function AuthCallbackScreen() {
  const url = Linking.useLinkingURL();

  useEffect(() => {
    if (!url) return;
    backend
      .completeAuthRedirect(url)
      .catch(() => {})
      .finally(() => router.replace('/'));
  }, [url]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.rose} size="large" />
    </View>
  );
}

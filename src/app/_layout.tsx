import { useEffect } from 'react';
import { DarkTheme, SplashScreen, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import {
  PlayfairDisplay_600SemiBold_Italic,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';

import { PushBridge } from '@/components/PushBridge';
import { ToastProvider } from '@/components/Toast';
import { Button } from '@/components/ui/Button';
import { captureInviteFromUrl } from '@/services/invites';
import { AppStateProvider } from '@/state/AppState';
import { SessionProvider, useSession } from '@/state/Session';
import { colors, fonts, spacing } from '@/theme';

SplashScreen.preventAutoHideAsync();
// Link de convite (…/?convite=ABC123): guarda o código para usar após o cadastro.
captureInviteFromUrl();

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.background, card: colors.background, primary: colors.rose },
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlayfairDisplay_600SemiBold_Italic,
    PlayfairDisplay_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <ThemeProvider value={theme}>
        <SessionProvider>
          <ToastProvider>
            <StatusBar style="light" />
            <RootNavigator />
          </ToastProvider>
        </SessionProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

/** Cada grupo de telas só existe no status certo; o Expo Router redireciona sozinho. */
function RootNavigator() {
  const { status, account, retry, signOut } = useSession();

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hideAsync();
  }, [status]);

  if (status === 'loading') return null;
  if (status === 'error') return <LoadError onRetry={retry} onSignOut={signOut} />;

  return (
    // A key zera matches e estado em memória quando outra conta entra.
    <AppStateProvider key={account?.id ?? 'guest'}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Protected guard={status === 'signedOut'}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>

        <Stack.Protected guard={status === 'onboarding'}>
          <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        </Stack.Protected>

        <Stack.Protected guard={status === 'ready'}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="edit-profile" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="filters" options={{ presentation: 'modal' }} />
          <Stack.Screen name="match/[id]" options={{ presentation: 'transparentModal', animation: 'fade' }} />
          <Stack.Screen name="delete-account" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="chat/[matchId]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="person/[matchId]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="report/[matchId]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="report-profile" options={{ presentation: 'modal' }} />
          <Stack.Screen name="invite" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="plans" options={{ presentation: 'modal' }} />
          <Stack.Screen name="passport" options={{ presentation: 'modal' }} />
          <Stack.Screen name="notifications" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="verify" options={{ presentation: 'modal' }} />
        </Stack.Protected>

        {/* Sempre acessíveis: abertas por links de e-mail e pelo login social */}
        <Stack.Screen name="reset-password" />
        <Stack.Screen name="auth-callback" options={{ animation: 'none' }} />
        <Stack.Screen name="legal/[doc]" options={{ animation: 'slide_from_right' }} />
      </Stack>
      {status === 'ready' && <PushBridge />}
    </AppStateProvider>
  );
}

function LoadError({ onRetry, onSignOut }: { onRetry: () => void; onSignOut: () => void }) {
  return (
    <View style={errorStyles.screen}>
      <Ionicons name="cloud-offline-outline" size={48} color={colors.textFaint} />
      <Text style={errorStyles.title}>Não conseguimos carregar seu perfil</Text>
      <Text style={errorStyles.text}>Verifique sua conexão com a internet e tente de novo.</Text>
      <Button title="Tentar de novo" onPress={onRetry} style={{ alignSelf: 'stretch' }} />
      <Button title="Sair da conta" variant="ghost" onPress={onSignOut} style={{ alignSelf: 'stretch' }} />
    </View>
  );
}

const errorStyles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  title: { fontFamily: fonts.display, fontSize: 24, color: colors.text, textAlign: 'center' },
  text: { fontFamily: fonts.regular, fontSize: 15, color: colors.textMuted, textAlign: 'center' },
});

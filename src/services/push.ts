import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import { backend } from '@/services/backend';

const TOKEN_KEY = 'kissly.pushToken';
const ASKED_KEY = 'kissly.pushAsked';

export type PushSupport = 'ok' | 'web' | 'simulator' | 'expo_go_android' | 'no_project';

export const PUSH_UNSUPPORTED_REASON: Record<Exclude<PushSupport, 'ok'>, string> = {
  web: 'Notificações estão disponíveis no app para iPhone e Android.',
  simulator: 'Notificações push só funcionam em um aparelho de verdade.',
  expo_go_android: 'No Android, notificações exigem o app instalado (development build), não o Expo Go.',
  no_project: 'Falta configurar o projeto EAS (rode "npx eas-cli init") para ativar notificações.',
};

const projectId: string | undefined =
  Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;

export function pushSupport(): PushSupport {
  if (Platform.OS === 'web') return 'web';
  if (!Device.isDevice) return 'simulator';
  if (Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return 'expo_go_android';
  }
  if (!projectId) return 'no_project';
  return 'ok';
}

if (Platform.OS !== 'web') {
  // Com o app aberto, mostra a notificação como banner.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function permissionStatus(): Promise<'granted' | 'denied' | 'undetermined' | 'unsupported'> {
  if (pushSupport() !== 'ok') return 'unsupported';
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

async function registerToken() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Matches e mensagens',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 120, 200],
      lightColor: '#FF3D7F',
    });
  }
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await backend.registerPushToken(token, Platform.OS === 'ios' ? 'ios' : 'android');
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

/** Pede permissão (se preciso) e registra este aparelho. */
export async function enablePush(): Promise<{ ok: true } | { ok: false; reason: string }> {
  const support = pushSupport();
  if (support !== 'ok') return { ok: false, reason: PUSH_UNSUPPORTED_REASON[support] };
  await AsyncStorage.setItem(ASKED_KEY, '1');

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') {
    return { ok: false, reason: 'Permissão negada. Ative as notificações do Kissly nas configurações do aparelho.' };
  }
  try {
    await registerToken();
    return { ok: true };
  } catch {
    return { ok: false, reason: 'Não foi possível registrar este aparelho agora.' };
  }
}

/** Para de enviar notificações para este aparelho (ex.: ao sair da conta). */
export async function disablePush() {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (!token) return;
  await backend.unregisterPushToken(token).catch(() => {});
  await AsyncStorage.removeItem(TOKEN_KEY);
}

/** Ao abrir o app: se a permissão já existe, renova o registro (o token pode mudar). */
export async function syncPushIfGranted() {
  if ((await permissionStatus()) === 'granted') await registerToken().catch(() => {});
}

/** Deve mostrar o convite para ativar notificações? (só uma vez, e só se fizer sentido) */
export async function shouldAskForPush() {
  return (await permissionStatus()) === 'undetermined' && !(await AsyncStorage.getItem(ASKED_KEY));
}

export async function markPushAsked() {
  await AsyncStorage.setItem(ASKED_KEY, '1');
}

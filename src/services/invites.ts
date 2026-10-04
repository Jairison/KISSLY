import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_KEY = 'kissly.pendingInvite';

export type InviteInfo = {
  code: string;
  /** Amigos que completaram o perfil com o código. */
  invited: number;
  /** Quantas recompensas de 7 dias de Gold já foram ganhas. */
  rewardsEarned: number;
  /** Quantos amigos faltam para a próxima recompensa. */
  nextRewardIn: number;
};

export type RedeemResult = 'ok' | 'invalid' | 'own' | 'already' | 'expired';

export const INVITE_REWARD = { friendsPerReward: 3, inviterDays: 7, inviteeDays: 3 } as const;

export const normalizeInviteCode = (code: string) => code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
export const isInviteCodeShape = (code: string) => /^[A-Z2-9]{6}$/.test(normalizeInviteCode(code));

/** Endereço público do app na web, usado nos links de convite. */
const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://jairison.github.io/KISSLY';

export function inviteLink(code: string) {
  return `${WEB_URL}/?convite=${code}`;
}

export async function getPendingInvite() {
  return AsyncStorage.getItem(PENDING_KEY);
}

export async function setPendingInvite(code: string | null) {
  if (code && isInviteCodeShape(code)) await AsyncStorage.setItem(PENDING_KEY, normalizeInviteCode(code));
  else await AsyncStorage.removeItem(PENDING_KEY);
}

/** No navegador, guarda o código de um link "…?convite=ABC123" para usar depois do cadastro. */
export async function captureInviteFromUrl() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const code = new URLSearchParams(window.location.search).get('convite');
  if (code && isInviteCodeShape(code)) await setPendingInvite(code);
}

export const REDEEM_MESSAGES: Record<RedeemResult, string> = {
  ok: `Convite aceito! Você ganhou ${INVITE_REWARD.inviteeDays} dias de Kissly Gold ✨`,
  invalid: 'Esse código de convite não existe.',
  own: 'Esse é o seu próprio código de convite.',
  already: 'Você já usou um código de convite.',
  expired: 'Códigos de convite só valem nos primeiros 7 dias da conta.',
};

// Compras simuladas para o modo demonstração: o plano escolhido fica salvo no aparelho.

import AsyncStorage from '@react-native-async-storage/async-storage';

import { DURATIONS, REFERENCE_PRICES, formatBRL, type PaidPlan } from '@/data/plans';
import type { Plan } from '@/types/user';

import { PaymentError, type Payments, type PlanOffer } from './types';

const key = (userId: string) => `kissly.plan.${userId}`;
let currentUser: string | null = null;

const grantKey = (userId: string) => `kissly.grant.${userId}`;
const RANK: Record<Plan, number> = { free: 0, plus: 1, gold: 2, platinum: 3 };

/** Prêmio da demonstração (ex.: Gold ganho por convite), com validade. */
export async function grantDemoPlan(userId: string, plan: Plan, days: number) {
  const expiresAt = Date.now() + days * 86_400_000;
  await AsyncStorage.setItem(grantKey(userId), JSON.stringify({ plan, expiresAt }));
}

/** Plano da demonstração: o comprado ou um prêmio válido, o que for maior. */
export async function readDemoPlan(userId: string): Promise<Plan> {
  const bought = ((await AsyncStorage.getItem(key(userId))) as Plan | null) ?? 'free';
  const raw = await AsyncStorage.getItem(grantKey(userId));
  const grant = raw ? (JSON.parse(raw) as { plan: Plan; expiresAt: number }) : null;
  const granted = grant && grant.expiresAt > Date.now() ? grant.plan : 'free';
  return RANK[granted] > RANK[bought] ? granted : bought;
}

export function referenceOffers(): PlanOffer[] {
  return (Object.keys(REFERENCE_PRICES) as PaidPlan[]).flatMap((plan) =>
    DURATIONS.map(({ id, months }) => {
      const total = REFERENCE_PRICES[plan][id];
      const monthly = REFERENCE_PRICES[plan].monthly;
      return {
        plan,
        duration: id,
        price: formatBRL(total),
        perMonth: `${formatBRL(total / months)}/mês`,
        savings: Math.round((1 - total / (monthly * months)) * 100),
        ref: null,
      };
    }),
  );
}

export const demoPayments: Payments = {
  mode: 'demo',
  async identify(userId) {
    currentUser = userId;
  },
  async reset() {
    currentUser = null;
  },
  async getOffers() {
    return referenceOffers();
  },
  async purchase(offer) {
    if (!currentUser) throw new PaymentError('Entre na sua conta para assinar.');
    await new Promise((r) => setTimeout(r, 700));
    await AsyncStorage.setItem(key(currentUser), offer.plan);
    return { status: 'purchased', plan: offer.plan };
  },
  async restore() {
    return currentUser ? readDemoPlan(currentUser) : 'free';
  },
  async manage() {
    // No modo demonstração, "cancelar" volta para o plano grátis.
    if (currentUser) await AsyncStorage.removeItem(key(currentUser));
  },
};

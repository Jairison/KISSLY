// Assinaturas reais pela App Store / Google Play, via RevenueCat.
// No Expo Go o SDK roda em "modo de prévia" (sem cobrança); para comprar de verdade use um development build.

import { Platform } from 'react-native';
import Purchases, { PACKAGE_TYPE, type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';

import { PLAN_RANK, type Duration, type PaidPlan } from '@/data/plans';
import { supabase } from '@/lib/supabase';
import type { Plan } from '@/types/user';

import { PaymentError, type Payments, type PlanOffer } from './types';

const API_KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
});

export const isRevenueCatConfigured = Platform.OS !== 'web' && Boolean(API_KEY);

const PAID: PaidPlan[] = ['plus', 'gold', 'platinum'];

const DURATION_BY_TYPE: Partial<Record<PACKAGE_TYPE, { id: Duration; months: number }>> = {
  [PACKAGE_TYPE.MONTHLY]: { id: 'monthly', months: 1 },
  [PACKAGE_TYPE.SIX_MONTH]: { id: 'semiannual', months: 6 },
  [PACKAGE_TYPE.ANNUAL]: { id: 'annual', months: 12 },
};

let configured = false;

function ensureConfigured() {
  if (configured) return;
  if (!API_KEY) throw new PaymentError('Pagamentos não configurados neste aparelho.');
  Purchases.configure({ apiKey: API_KEY });
  configured = true;
}

/** O maior plano com direito ativo (entitlements "plus", "gold", "platinum" no RevenueCat). */
function planFrom(info: CustomerInfo): Plan {
  const active = Object.keys(info.entitlements.active).filter((id): id is PaidPlan => PAID.includes(id as PaidPlan));
  return active.sort((a, b) => PLAN_RANK[b] - PLAN_RANK[a])[0] ?? 'free';
}

/** Pede ao servidor para conferir a assinatura agora, sem esperar o webhook. */
async function syncServer() {
  await supabase?.functions.invoke('sync-subscription').catch(() => {});
}

export const revenueCatPayments: Payments = {
  mode: 'revenuecat',

  async identify(userId) {
    ensureConfigured();
    await Purchases.logIn(userId);
  },

  async reset() {
    if (!configured) return;
    if (!(await Purchases.isAnonymous())) await Purchases.logOut();
  },

  async getOffers() {
    ensureConfigured();
    const offerings = await Purchases.getOfferings();
    const offers: PlanOffer[] = [];

    for (const plan of PAID) {
      const offering = offerings.all[plan];
      if (!offering) continue;
      const monthly = offering.availablePackages.find((p) => p.packageType === PACKAGE_TYPE.MONTHLY);

      for (const pkg of offering.availablePackages) {
        const duration = DURATION_BY_TYPE[pkg.packageType];
        if (!duration) continue;
        const fullPrice = monthly ? monthly.product.price * duration.months : pkg.product.price;
        offers.push({
          plan,
          duration: duration.id,
          price: pkg.product.priceString,
          perMonth: `${pkg.product.pricePerMonthString ?? pkg.product.priceString}/mês`,
          savings: Math.max(0, Math.round((1 - pkg.product.price / fullPrice) * 100)),
          ref: pkg,
        });
      }
    }
    return offers;
  },

  async purchase(offer) {
    ensureConfigured();
    try {
      const { customerInfo } = await Purchases.purchasePackage(offer.ref as PurchasesPackage);
      await syncServer();
      return { status: 'purchased', plan: planFrom(customerInfo) };
    } catch (e) {
      if ((e as { userCancelled?: boolean }).userCancelled) return { status: 'cancelled' };
      throw new PaymentError((e as Error).message || 'Não foi possível concluir a compra.');
    }
  },

  async restore() {
    ensureConfigured();
    const info = await Purchases.restorePurchases();
    await syncServer();
    return planFrom(info);
  },

  async manage() {
    ensureConfigured();
    await Purchases.showManageSubscriptions();
  },
};

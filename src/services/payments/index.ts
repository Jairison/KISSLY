import { Platform } from 'react-native';

import { isSupabaseConfigured } from '@/lib/supabase';

import { demoPayments, referenceOffers } from './demo';
import { isRevenueCatConfigured, revenueCatPayments } from './revenuecat';
import { PaymentError, type Payments } from './types';

const unavailable = (message: string): Payments => ({
  mode: 'unavailable',
  identify: async () => {},
  reset: async () => {},
  // Mostra os preços de referência, mas não deixa comprar.
  getOffers: async () => referenceOffers(),
  purchase: async () => {
    throw new PaymentError(message);
  },
  restore: async () => {
    throw new PaymentError(message);
  },
  manage: async () => {
    throw new PaymentError(message);
  },
});

/**
 * - Sem Supabase: modo demonstração (compra simulada, salva no aparelho).
 * - Com Supabase e chaves do RevenueCat no celular: assinaturas reais.
 * - Com Supabase, mas sem RevenueCat (ou no navegador): compra indisponível.
 */
export const payments: Payments = !isSupabaseConfigured
  ? demoPayments
  : isRevenueCatConfigured
    ? revenueCatPayments
    : unavailable(
        Platform.OS === 'web'
          ? 'Assine pelo app Kissly no seu celular.'
          : 'Os pagamentos ainda não foram configurados (RevenueCat).',
      );

export * from './types';

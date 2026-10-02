// Regras puras (sem dependências) para converter os direitos do RevenueCat no plano do Kissly.
// Testadas em supabase/tests/plan.test.ts.

export type Plan = 'free' | 'plus' | 'gold' | 'platinum';

/** Ordem de prioridade: se a pessoa tiver mais de um direito ativo, vale o maior. */
const RANK: Plan[] = ['platinum', 'gold', 'plus'];

export type RevenueCatEntitlement = {
  expires_date: string | null;
  product_identifier?: string;
};

export type RevenueCatSubscriber = {
  entitlements?: Record<string, RevenueCatEntitlement>;
};

export type ResolvedPlan = { plan: Plan; expiresAt: string | null };

/**
 * Escolhe o maior plano com direito ("entitlement") ativo.
 * Os entitlements no painel do RevenueCat devem se chamar exatamente: plus, gold, platinum.
 */
export function resolvePlan(subscriber: RevenueCatSubscriber, now = new Date()): ResolvedPlan {
  const entitlements = subscriber.entitlements ?? {};
  for (const plan of RANK) {
    const ent = entitlements[plan];
    if (!ent) continue;
    // expires_date null = vitalício
    if (ent.expires_date === null || new Date(ent.expires_date) > now) {
      return { plan, expiresAt: ent.expires_date };
    }
  }
  return { plan: 'free', expiresAt: null };
}

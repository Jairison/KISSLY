import { adminClient, env } from './admin.ts';
import { resolvePlan, type ResolvedPlan, type RevenueCatSubscriber } from './plan.ts';

const REVENUECAT_API = 'https://api.revenuecat.com/v1/subscribers/';

/** Consulta o RevenueCat (fonte da verdade) e grava o plano atual da pessoa. */
export async function syncSubscription(userId: string): Promise<ResolvedPlan> {
  const response = await fetch(REVENUECAT_API + encodeURIComponent(userId), {
    headers: { Authorization: `Bearer ${env('REVENUECAT_SECRET_API_KEY')}` },
  });
  if (!response.ok) {
    throw new Error(`RevenueCat respondeu ${response.status}: ${await response.text()}`);
  }
  const { subscriber } = (await response.json()) as { subscriber: RevenueCatSubscriber };
  const resolved = resolvePlan(subscriber);

  const db = adminClient();
  const { error } =
    resolved.plan === 'free'
      ? await db.from('subscriptions').delete().eq('user_id', userId)
      : await db.from('subscriptions').upsert({
          user_id: userId,
          plan: resolved.plan,
          expires_at: resolved.expiresAt,
          updated_at: new Date().toISOString(),
        });
  if (error) throw new Error(`Falha ao gravar assinatura: ${error.message}`);
  return resolved;
}

import { createClient } from 'npm:@supabase/supabase-js@2';

import { resolvePlan, type ResolvedPlan, type RevenueCatSubscriber } from './plan.ts';

const REVENUECAT_API = 'https://api.revenuecat.com/v1/subscribers/';

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`);
  return value;
}

/** Cliente com a chave de serviço: único jeito de gravar na tabela subscriptions. */
export function adminClient() {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });
}

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

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

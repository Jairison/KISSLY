// Recebe os eventos do RevenueCat (compra, renovação, cancelamento, expiração…)
// e atualiza o plano da pessoa. Deploy: supabase functions deploy revenuecat-webhook --no-verify-jwt

import { json } from '../_shared/admin.ts';
import { syncSubscription } from '../_shared/revenuecat.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  // O RevenueCat envia o valor configurado em "Authorization header value" do webhook.
  const expected = Deno.env.get('REVENUECAT_WEBHOOK_AUTH');
  if (!expected || req.headers.get('Authorization') !== expected) {
    return json({ error: 'Não autorizado' }, 401);
  }

  const payload = await req.json().catch(() => null);
  const event = payload?.event;
  if (!event) return json({ error: 'Evento inválido' }, 400);

  // TRANSFER move a assinatura entre contas: sincroniza as duas pontas.
  const ids: string[] = [
    event.app_user_id,
    ...(event.transferred_from ?? []),
    ...(event.transferred_to ?? []),
  ].filter((id: unknown): id is string => typeof id === 'string' && UUID.test(id));

  if (ids.length === 0) {
    // Usuário anônimo do RevenueCat (antes do login): nada a fazer.
    return json({ ok: true, skipped: true });
  }

  try {
    const results = await Promise.all([...new Set(ids)].map(async (id) => ({ id, ...(await syncSubscription(id)) })));
    return json({ ok: true, type: event.type, results });
  } catch (error) {
    console.error(error);
    // 500 faz o RevenueCat tentar de novo mais tarde.
    return json({ error: String(error) }, 500);
  }
});

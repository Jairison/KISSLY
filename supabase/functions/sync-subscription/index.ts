// Chamada pelo app logo depois de uma compra ou restauração, para liberar os recursos
// sem esperar o webhook. Só sincroniza a própria conta de quem chama.
// Deploy: supabase functions deploy sync-subscription

import { createClient } from 'npm:@supabase/supabase-js@2';

import { json } from '../_shared/admin.ts';
import { syncSubscription } from '../_shared/revenuecat.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return withCors(json({ error: 'Não autenticado' }, 401));

  try {
    const resolved = await syncSubscription(data.user.id);
    return withCors(json(resolved));
  } catch (e) {
    console.error(e);
    return withCors(json({ error: 'Não foi possível verificar a assinatura agora' }, 502));
  }
});

function withCors(response: Response) {
  Object.entries(CORS).forEach(([k, v]) => response.headers.set(k, v));
  return response;
}

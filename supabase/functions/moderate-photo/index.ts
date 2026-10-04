// Moderação automática de fotos do perfil (Sightengine).
//
// Dois jeitos de chamar:
//  1) Pelo app, logo após enviar cada foto: POST { path } com o login da pessoa.
//     Responde { ok: true } ou { ok: false, reasons } — a foto recusada já é apagada.
//  2) (Opcional, reserva) Database Webhook em storage.objects (INSERT), com o cabeçalho
//     x-webhook-secret: pega fotos enviadas por fora do app.
//
// Sem SIGHTENGINE_API_USER/SECRET configurados, aprova tudo (moderação desligada).
// Deploy: supabase functions deploy moderate-photo --no-verify-jwt

import { createClient } from 'npm:@supabase/supabase-js@2';

import { adminClient, json } from '../_shared/admin.ts';
import { decide, type SightengineResult } from '../_shared/moderation.ts';

const BUCKET = 'photos';
const MODELS = 'nudity-2.1,gore-2.0,offensive-2.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};
const reply = (body: unknown, status = 200) => {
  const res = json(body, status);
  Object.entries(CORS).forEach(([k, v]) => res.headers.set(k, v));
  return res;
};

async function analyze(publicUrl: string): Promise<SightengineResult | null> {
  const user = Deno.env.get('SIGHTENGINE_API_USER');
  const secret = Deno.env.get('SIGHTENGINE_API_SECRET');
  if (!user || !secret) return null;
  const params = new URLSearchParams({ models: MODELS, api_user: user, api_secret: secret, url: publicUrl });
  const res = await fetch(`https://api.sightengine.com/1.0/check.json?${params}`);
  const data = (await res.json()) as SightengineResult & { error?: { message?: string } };
  if (data.status !== 'success') throw new Error(`Sightengine: ${data.error?.message ?? res.status}`);
  return data;
}

/** Analisa a foto e, se recusada, apaga o arquivo e registra. */
async function moderate(path: string, userId: string | null, source: 'app' | 'webhook') {
  const db = adminClient();
  const publicUrl = db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  let result: SightengineResult | null;
  try {
    result = await analyze(publicUrl);
  } catch (e) {
    // Serviço fora do ar: não trava o cadastro de ninguém (registrado nos logs da função).
    console.error(e);
    return { ok: true, skipped: 'erro na análise' };
  }
  if (!result) return { ok: true, skipped: 'moderação não configurada' };

  const decision = decide(result);
  if (decision.ok) return { ok: true };

  await db.storage.from(BUCKET).remove([path]);
  await db.from('photo_moderation').insert({
    user_id: userId,
    path,
    reasons: decision.reasons,
    scores: { nudity: result.nudity, gore: result.gore, offensive: result.offensive },
    source,
  });

  // Reserva: se a foto já estava no perfil (envio por fora do app), tira ela de lá
  // — desde que o perfil continue com o mínimo de 2 fotos exigido.
  if (source === 'webhook' && userId) {
    const { data: profile } = await db.from('profiles').select('photos').eq('id', userId).maybeSingle();
    const photos = (profile?.photos as string[] | undefined) ?? [];
    if (photos.includes(publicUrl) && photos.length > 2) {
      await db.from('profiles').update({ photos: photos.filter((p) => p !== publicUrl) }).eq('id', userId);
    }
  }
  return { ok: false, reasons: decision.reasons };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const body = await req.json().catch(() => null);

  // 2) Database Webhook (reserva)
  const secret = Deno.env.get('MODERATION_WEBHOOK_SECRET');
  if (body?.type && body?.table === 'objects') {
    if (!secret || req.headers.get('x-webhook-secret') !== secret) return reply({ error: 'Não autorizado' }, 401);
    const record = body.record as { bucket_id?: string; name?: string } | undefined;
    if (body.type !== 'INSERT' || record?.bucket_id !== BUCKET || !record.name) return reply({ ok: true, skipped: true });
    const userId = record.name.split('/')[0];
    return reply(await moderate(record.name, /^[0-9a-f-]{36}$/i.test(userId) ? userId : null, 'webhook'));
  }

  // 1) Chamada do app: só a própria pessoa, só a própria pasta
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return reply({ error: 'Não autenticado' }, 401);

  const path = typeof body?.path === 'string' ? body.path : '';
  if (!path.startsWith(`${data.user.id}/`) || path.includes('..')) return reply({ error: 'Foto inválida' }, 400);

  return reply(await moderate(path, data.user.id, 'app'));
});

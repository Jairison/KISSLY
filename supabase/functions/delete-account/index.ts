// Exclusão completa da conta: apaga TODOS os arquivos da pessoa e depois a conta.
//
//  - fotos do perfil          → photos/<id>/…
//  - selfies de verificação   → verifications/<id>/…
//  - fotos e áudios do chat   → chat-media/<match>/… (de todos os matches dela)
//  - conta (auth.users)       → o banco apaga em cascata perfil, matches, mensagens etc.
//
// Arquivo único de propósito: pode ser publicado colando no painel do Supabase
// (Edge Functions → Deploy a new function → Via Editor), sem instalar nada.
// Mantenha "Verify JWT" ligado: só a própria pessoa logada pode se excluir.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

/** Apaga tudo dentro de uma pasta de um bucket (em lotes). */
async function emptyFolder(admin: SupabaseClient, bucket: string, folder: string): Promise<number> {
  let removed = 0;
  for (;;) {
    const { data, error } = await admin.storage.from(bucket).list(folder, { limit: 100 });
    if (error) throw new Error(`listar ${bucket}/${folder}: ${error.message}`);
    const files = (data ?? []).filter((f) => f.id); // ignora subpastas
    if (files.length === 0) return removed;
    const { error: rmError } = await admin.storage.from(bucket).remove(files.map((f) => `${folder}/${f.name}`));
    if (rmError) throw new Error(`apagar ${bucket}/${folder}: ${rmError.message}`);
    removed += files.length;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply({ error: 'Método não permitido' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  });
  const { data: auth, error: authError } = await userClient.auth.getUser();
  if (authError || !auth.user) return reply({ error: 'Não autenticado' }, 401);
  const userId = auth.user.id;

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  try {
    // Conversas dela: os arquivos somem para os dois lados, já que a conversa toda é apagada.
    const { data: matches, error: mErr } = await admin
      .from('matches')
      .select('id')
      .or(`user_a.eq.${userId},user_b.eq.${userId}`);
    if (mErr) throw new Error(`matches: ${mErr.message}`);

    const removed = {
      photos: await emptyFolder(admin, 'photos', userId),
      verifications: await emptyFolder(admin, 'verifications', userId),
      chat: 0,
    };
    for (const m of matches ?? []) removed.chat += await emptyFolder(admin, 'chat-media', m.id as string);

    const { error: delError } = await admin.auth.admin.deleteUser(userId);
    if (delError) throw new Error(`excluir conta: ${delError.message}`);

    return reply({ ok: true, removed });
  } catch (e) {
    console.error(e);
    return reply({ error: 'Não foi possível excluir a conta agora. Tente de novo.' }, 500);
  }
});

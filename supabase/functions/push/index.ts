// Envia notificações push de novo match e nova mensagem.
// Chamada pelos "Database Webhooks" do Supabase (INSERT em public.matches e public.messages).
// Deploy: supabase functions deploy push --no-verify-jwt

import { adminClient, json } from '../_shared/admin.ts';

const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';

type WebhookPayload = {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: Record<string, string>;
};

type PushMessage = { to: string; title: string; body: string; data: { url: string }; sound: 'default' };

Deno.serve(async (req) => {
  // O webhook envia este cabeçalho (configurado no painel ao criar o Database Webhook).
  const secret = Deno.env.get('PUSH_WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-webhook-secret') !== secret) return json({ error: 'Não autorizado' }, 401);

  const payload = (await req.json().catch(() => null)) as WebhookPayload | null;
  if (!payload || payload.type !== 'INSERT') return json({ ok: true, skipped: true });

  const db = adminClient();
  const messages: PushMessage[] = [];

  const settingsOf = async (userId: string) => {
    const { data } = await db.from('notification_settings').select('new_matches, messages').eq('user_id', userId).maybeSingle();
    return data ?? { new_matches: true, messages: true };
  };
  const tokensOf = async (userId: string) => {
    const { data } = await db.from('push_tokens').select('token').eq('user_id', userId);
    return (data ?? []).map((t) => t.token as string);
  };
  const nameOf = async (userId: string) => {
    const { data } = await db.from('profiles').select('name').eq('id', userId).single();
    return (data?.name as string) ?? 'Alguém';
  };

  if (payload.table === 'matches') {
    const { id, user_a, user_b } = payload.record;
    for (const [me, other] of [[user_a, user_b], [user_b, user_a]]) {
      if (!(await settingsOf(me)).new_matches) continue;
      const otherName = await nameOf(other);
      for (const to of await tokensOf(me)) {
        messages.push({
          to,
          title: 'É um Match! 💘',
          body: `Você e ${otherName} se curtiram. Que tal mandar um oi?`,
          data: { url: `/chat/${id}` },
          sound: 'default',
        });
      }
    }
  }

  if (payload.table === 'messages') {
    const { match_id, sender_id, body, kind } = payload.record;
    const preview = kind === 'image' ? '📷 Foto' : kind === 'gif' ? 'GIF' : kind === 'audio' ? '🎤 Áudio' : body;
    const { data: match } = await db.from('matches').select('user_a, user_b').eq('id', match_id).single();
    if (match) {
      const recipient = match.user_a === sender_id ? match.user_b : match.user_a;
      if ((await settingsOf(recipient)).messages) {
        const senderName = await nameOf(sender_id);
        for (const to of await tokensOf(recipient)) {
          messages.push({
            to,
            title: senderName,
            body: preview.length > 120 ? `${preview.slice(0, 117)}…` : preview,
            data: { url: `/chat/${match_id}` },
            sound: 'default',
          });
        }
      }
    }
  }

  if (messages.length === 0) return json({ ok: true, sent: 0 });

  const response = await fetch(EXPO_PUSH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });
  const result = await response.json().catch(() => ({}));

  // Remove tokens de aparelhos que desinstalaram o app.
  const tickets: { status: string; details?: { error?: string } }[] = result.data ?? [];
  const dead = tickets
    .map((t, i) => (t.details?.error === 'DeviceNotRegistered' ? messages[i].to : null))
    .filter((t): t is string => !!t);
  if (dead.length) await db.from('push_tokens').delete().in('token', dead);

  return json({ ok: response.ok, sent: messages.length, removed: dead.length });
});

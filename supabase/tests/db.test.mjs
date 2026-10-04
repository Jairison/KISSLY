import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Testa a migração e o seed num Postgres embutido (PGlite), simulando o essencial do Supabase.
// Uso: npm run test:db
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new PGlite();
let failures = 0;
const ok = (cond, label, extra = '') => {
  console.log(`${cond ? '✔' : '✘'} ${label}${extra ? ' → ' + extra : ''}`);
  if (!cond) failures++;
};

// --- Simulação mínima do ambiente Supabase -------------------------------
await db.exec(`
  create publication supabase_realtime;
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create schema auth;
  create table auth.users (
    id uuid primary key, instance_id uuid, aud text, role text, email text, encrypted_password text,
    email_confirmed_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb,
    created_at timestamptz, updated_at timestamptz, confirmation_token text, recovery_token text,
    email_change_token_new text, email_change text
  );
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  grant usage on schema storage to authenticated;
  grant all on storage.objects to authenticated;
  grant execute on function storage.foldername(text) to authenticated;
  -- privilégios padrão do Supabase no schema public
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`);

for (const file of fs.readdirSync(`${ROOT}/migrations`).sort()) {
  await db.exec(fs.readFileSync(`${ROOT}/migrations/${file}`, 'utf8'));
  ok(true, `migração ${file}`);
}
await db.exec(fs.readFileSync(`${ROOT}/seed.sql`, 'utf8'));
await db.exec(fs.readFileSync(`${ROOT}/seed.sql`, 'utf8')); // idempotente?
const demos = (await db.query(`select count(*)::int n from public.profiles`)).rows[0].n;
ok(demos === 16, 'seed cria 16 perfis (e pode rodar 2x)', demos);

// --- Usuários reais de teste ----------------------------------------------
const U1 = '11111111-1111-4111-8111-111111111111'; // homem, quer mulheres, São Paulo
const U2 = '22222222-2222-4222-8222-222222222222'; // mulher, quer homens, São Paulo
await db.exec(`insert into auth.users (id, email) values ('${U1}', 'u1@test.dev'), ('${U2}', 'u2@test.dev');`);

async function as(uid, sql, params = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false); set role ${uid ? 'authenticated' : 'anon'};`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role;');
  }
}
async function expectError(label, fn, match) {
  try {
    await fn();
    ok(false, label, 'não deu erro');
  } catch (e) {
    ok(!match || e.message.includes(match), label, e.message);
  }
}

const insertProfile = `insert into public.profiles (id, name, birthdate, gender, show_me, bio, interests, photos, city, state, country, lat, lng)
  values ($1, $2, $3, $4, $5, 'oi', array['Café'], array['a','b'], 'São Paulo', 'SP', 'Brasil', -23.5505, -46.6333)`;

await expectError('menor de 18 é bloqueado no banco',
  () => as(U1, insertProfile, [U1, 'Teen', new Date(Date.now() - 17 * 365.25 * 864e5).toISOString().slice(0, 10), 'man', 'women']),
  '18 anos');
await expectError('não dá para criar perfil com id de outra pessoa',
  () => as(U1, insertProfile, [U2, 'Fake', '1990-01-01', 'woman', 'men']));

await as(U1, insertProfile, [U1, 'Jairison', '1993-06-15', 'man', 'women']);
await as(U2, insertProfile, [U2, 'Ana', '1995-03-10', 'woman', 'men']);
ok(true, 'U1 e U2 criam os próprios perfis');

const visible = await as(U1, 'select id from public.profiles');
ok(visible.rows.length === 1 && visible.rows[0].id === U1, 'RLS: só enxerga o próprio perfil', visible.rows.length);

await expectError('não pode se marcar como verificado', () => as(U1, `update public.profiles set verified = true where id = '${U1}'`), 'permission denied');
await expectError('não pode alterar a data de nascimento', () => as(U1, `update public.profiles set birthdate = '1980-01-01' where id = '${U1}'`), 'permission denied');
await as(U1, `update public.profiles set bio = 'nova bio' where id = '${U1}'`);
ok(true, 'pode editar a própria bio');
await expectError('não pode gravar swipe direto na tabela', () => as(U1, `insert into public.swipes values ('${U1}', '${U2}', 'like')`), 'permission denied');
await expectError('não pode se dar plano Gold', () => as(U1, `insert into public.subscriptions values ('${U1}', 'gold')`), 'permission denied');
await expectError('anônimo não acessa o baralho', () => as(null, `select * from public.get_deck('state')`), 'permission denied');

await as(U1, `insert into public.preferences (user_id, age_min, age_max, max_distance_km) values ($1, 18, 70, 120)`, [U1]);

const state = await as(U1, `select name, distance_km, age from public.get_deck('state')`);
const names = state.rows.map((r) => `${r.name}(${r.distance_km}km)`).join(', ');
ok(
  state.rows.map((r) => r.name).join() === 'Ana,Mariana,Valentina,Isabela',
  'Estadual: mulheres de SP (que querem homens) a até 120 km, da mais perto à mais longe',
  names,
);
ok(!state.rows.some((r) => ['Rafael', 'Thiago'].includes(r.name)), 'Estadual: nenhum homem aparece para quem quer mulheres', names);

const national = await as(U1, `select name from public.get_deck('national')`);
ok(national.rows.length === 7, 'Nacional: mulheres brasileiras (sem limite de distância)', national.rows.map((r) => r.name).join(', '));

await expectError('Internacional exige Gold', () => as(U1, `select * from public.get_deck('international')`), 'Kissly Gold');

const m1 = await as(U1, `select * from public.swipe($1, 'like')`, ['00000000-0000-4000-8000-000000000013']);
ok(m1.rows[0].matched === true && !!m1.rows[0].match_id, 'Kiss na Mariana (curte de volta) → match');
const m2 = await as(U1, `select * from public.swipe($1, 'like')`, ['00000000-0000-4000-8000-000000000009']);
ok(m2.rows[0].matched === false, 'Kiss na Valentina (não curte de volta) → sem match');
await as(U1, `select * from public.swipe($1, 'nope')`, ['00000000-0000-4000-8000-000000000001']);

const after = await as(U1, `select name from public.get_deck('state')`);
ok(after.rows.map((r) => r.name).join() === 'Ana', 'Perfis já vistos somem do baralho (resta só a Ana)', after.rows.map((r) => r.name).join(', ') || 'vazio');

const matches = await as(U1, `select name, age from public.get_matches()`);
ok(matches.rows.length === 1 && matches.rows[0].name === 'Mariana', 'get_matches traz a Mariana', JSON.stringify(matches.rows));
ok(!('birthdate' in matches.rows[0]), 'match não expõe data de nascimento');

const theirMatches = await as(U2, `select * from public.get_matches()`);
ok(theirMatches.rows.length === 0, 'U2 não vê matches de U1');

// U2 dá super like em U1
const u2deck = await as(U2, `select name from public.get_deck('state')`);
ok(u2deck.rows.some((r) => r.name === 'Jairison'), 'U2 (quer homens) vê o U1 no baralho', u2deck.rows.map((r) => r.name).join(', '));
await as(U2, `select * from public.swipe($1, 'super')`, [U1]);
const count = await as(U1, `select public.likes_you_count() n`);
ok(count.rows[0].n === 1, 'U1 tem 1 curtida aguardando', count.rows[0].n);
await expectError('Ver quem curtiu exige Gold', () => as(U1, `select * from public.get_likes_you()`), 'Kissly Gold');

await db.exec(`insert into public.subscriptions values ('${U1}', 'gold', now() + interval '30 days')`);
const likers = await as(U1, `select name, super_like from public.get_likes_you()`);
ok(likers.rows[0]?.name === 'Ana' && likers.rows[0]?.super_like === true, 'Com Gold, vê que Ana deu Super Like', JSON.stringify(likers.rows));
const intl = await as(U1, `select name from public.get_deck('international')`);
ok(intl.rows.length === 4, 'Com Gold, Internacional mostra mulheres de fora do Brasil', intl.rows.map((r) => r.name).join(', '));

const back = await as(U1, `select * from public.swipe($1, 'like')`, [U2]);
ok(back.rows[0].matched === true, 'U1 curte Ana de volta → match entre usuários reais');
const count2 = await as(U1, `select public.likes_you_count() n`);
ok(count2.rows[0].n === 0, 'Após o match, a curtida sai da lista de pendentes');

await expectError('Não pode enviar foto na pasta de outra pessoa',
  () => as(U1, `insert into storage.objects (bucket_id, name) values ('photos', '${U2}/x.jpg')`), 'row-level security');
await as(U1, `insert into storage.objects (bucket_id, name) values ('photos', '${U1}/x.jpg')`);
ok(true, 'Pode enviar foto na própria pasta');
const ownPhotos = await as(U1, "select name from storage.objects where bucket_id = 'photos'");
ok(ownPhotos.rows.length === 1, 'Lista as próprias fotos (necessário para conseguir apagá-las)', ownPhotos.rows.length);
const othersPhotos = await as(U2, "select name from storage.objects where bucket_id = 'photos'");
ok(othersPhotos.rows.length === 0, 'Não lista as fotos de outras pessoas', othersPhotos.rows.length);

// ------------------------------------------------------------------ chat
const U3 = '33333333-3333-4333-8333-333333333333'; // intruso, fora do match
await db.exec(`insert into auth.users (id, email) values ('${U3}', 'u3@test.dev');`);
await as(U3, insertProfile, [U3, 'Intruso', '1990-01-01', 'man', 'women']);

const conv = await as(U1, `select match_id, name, last_message, unread from public.get_matches() where name = 'Ana'`);
const MATCH = conv.rows[0]?.match_id;
ok(!!MATCH && conv.rows[0].last_message === null, 'Conversa nova com a Ana, ainda sem mensagens');

await as(U1, `insert into public.messages (match_id, body) values ($1, 'Oi Ana! Tudo bem?')`, [MATCH]);
ok(true, 'U1 envia mensagem (remetente preenchido automaticamente)');
await new Promise((r) => setTimeout(r, 5));
await as(U2, `insert into public.messages (match_id, sender_id, body) values ($1, $2, 'Tudo ótimo, e você?')`, [MATCH, U2]);

await expectError('Não pode enviar mensagem em nome de outra pessoa',
  () => as(U1, `insert into public.messages (match_id, sender_id, body) values ($1, $2, 'fake')`, [MATCH, U2]), 'row-level security');
await expectError('Quem não é do match não consegue enviar',
  () => as(U3, `insert into public.messages (match_id, body) values ($1, 'oi')`, [MATCH]), 'row-level security');
await expectError('Mensagem vazia é recusada',
  () => as(U1, `insert into public.messages (match_id, body) values ($1, '   ')`, [MATCH]), 'check constraint');
await expectError('Não pode editar mensagens diretamente',
  () => as(U1, `update public.messages set body = 'editada'`), 'permission denied');

const spy = await as(U3, `select count(*)::int n from public.messages`);
ok(spy.rows[0].n === 0, 'Quem não é do match não lê a conversa', spy.rows[0].n);
const both = await as(U2, `select body from public.messages where match_id = $1 order by created_at`, [MATCH]);
ok(both.rows.length === 2, 'As duas pessoas leem a conversa', both.rows.map((r) => r.body).join(' | '));

const inbox = await as(U1, `select last_message, last_from_me, unread from public.get_matches() where match_id = $1`, [MATCH]);
ok(inbox.rows[0].last_message === 'Tudo ótimo, e você?' && inbox.rows[0].last_from_me === false && inbox.rows[0].unread === 1,
  'Lista de conversas traz última mensagem e 1 não lida', JSON.stringify(inbox.rows[0]));

await as(U3, `select public.mark_read($1)`, [MATCH]);
const stillUnread = await as(U1, `select unread from public.get_matches() where match_id = $1`, [MATCH]);
ok(stillUnread.rows[0].unread === 1, 'Intruso não consegue marcar como lida');
await as(U1, `select public.mark_read($1)`, [MATCH]);
const readNow = await as(U1, `select unread from public.get_matches() where match_id = $1`, [MATCH]);
const mine = await as(U1, `select read_at from public.messages where sender_id = $1`, [U1]);
ok(readNow.rows[0].unread === 0 && mine.rows[0].read_at === null, 'mark_read marca só as recebidas');

await as(U1, `insert into public.reports (reported_id, reason, details) values ($1, 'spam', 'teste')`, [U3]);
ok(true, 'Pode enviar denúncia');
await expectError('Ninguém lê denúncias pelo app', () => as(U3, `select * from public.reports`), 'permission denied');
await expectError('Motivo de denúncia inválido é recusado',
  () => as(U1, `insert into public.reports (reported_id, reason) values ($1, 'qualquer')`, [U3]), 'check constraint');

const marianaMatch = (await as(U1, `select match_id from public.get_matches() where name = 'Mariana'`)).rows[0].match_id;
await as(U1, `insert into public.messages (match_id, body) values ($1, 'oi')`, [marianaMatch]);
await expectError('Intruso não desfaz match alheio', () => as(U3, `select public.unmatch($1)`, [marianaMatch]), 'não encontrado');
await as(U1, `select public.unmatch($1)`, [marianaMatch]);
const afterUnmatch = await db.query(`select (select count(*) from public.matches where id = $1)::int m, (select count(*) from public.messages where match_id = $1)::int msg`, [marianaMatch]);
ok(afterUnmatch.rows[0].m + afterUnmatch.rows[0].msg === 0, 'Desfazer match apaga o match e a conversa');
const backInDeck = await as(U1, `select name from public.get_deck('state')`);
ok(!backInDeck.rows.some((r) => r.name === 'Mariana'), 'Após desfazer, a pessoa não volta ao baralho');

await as(U2, `select public.delete_account()`);
const gone = await db.query(`select (select count(*) from auth.users where id = $1)::int u, (select count(*) from public.profiles where id = $1)::int p,
  (select count(*) from public.matches where $1 in (user_a, user_b))::int m`, [U2]);
ok(gone.rows[0].u + gone.rows[0].p + gone.rows[0].m === 0, 'Excluir conta apaga usuário, perfil e matches', JSON.stringify(gone.rows[0]));

// ---------------------------------------------------------------- planos
const U4 = '44444444-4444-4444-8444-444444444444'; // plano grátis
const U5 = '55555555-5555-4555-8555-555555555555'; // Platinum
const U6 = '66666666-6666-4666-8666-666666666666'; // quem vai ver o baralho
await db.exec(`insert into auth.users (id, email) values ('${U4}', 'u4@test.dev'), ('${U5}', 'u5@test.dev'), ('${U6}', 'u6@test.dev');`);
await as(U4, insertProfile, [U4, 'Livre', '1992-02-02', 'woman', 'men']);
await as(U5, insertProfile, [U5, 'Platina', '1991-01-01', 'man', 'women']);
await as(U6, insertProfile, [U6, 'Vê', '1994-04-04', 'woman', 'men']);
await db.exec(`insert into public.subscriptions values ('${U5}', 'platinum', now() + interval '30 days')`);

// 60 perfis extras para esgotar o limite de Kiss
const extra = (i) => `99999999-0000-4000-8000-${String(i).padStart(12, '0')}`;
await db.exec(`
  insert into auth.users (id, email)
  select ('99999999-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid, 'x' || g || '@test.dev' from generate_series(1, 60) g;
  insert into public.profiles (id, name, birthdate, gender, show_me, photos, city, state, country)
  select ('99999999-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid, 'Extra' || g, '1990-01-01', 'man', 'everyone',
         array['a','b'], 'Campinas', 'SP', 'Brasil' from generate_series(1, 60) g;`);
const swipeAs = (uid, target, dir) => as(uid, `select * from public.swipe($1, '${dir}')`, [target]);
const usageOf = async (uid) => (await as(uid, 'select * from public.my_usage()')).rows[0];

let usage = await usageOf(U4);
ok(usage.plan === 'free' && usage.likes_left === 50 && usage.supers_left === 1 && usage.can_rewind === false,
  'Grátis começa com 50 Kiss e 1 Super Like', JSON.stringify(usage));
for (let i = 1; i <= 50; i++) await swipeAs(U4, extra(i), 'like');
await expectError('Grátis: o 51º Kiss do dia é bloqueado', () => swipeAs(U4, extra(51), 'like'), 'Kiss de hoje');
await swipeAs(U4, extra(52), 'nope');
ok(true, 'Grátis: passar (nope) continua liberado');
await swipeAs(U4, extra(53), 'super');
await expectError('Grátis: o 2º Super Like do dia é bloqueado', () => swipeAs(U4, extra(54), 'super'), 'Super Likes de hoje');
usage = await usageOf(U4);
ok(usage.likes_left === 0 && usage.supers_left === 0, 'my_usage mostra os limites esgotados', JSON.stringify(usage));
await expectError('Grátis não pode voltar perfil', () => as(U4, 'select * from public.rewind()'), 'Kissly Plus');

// Plus: Kiss ilimitado e voltar perfil
await db.exec(`insert into public.subscriptions values ('${U4}', 'plus', now() + interval '30 days')`);
await swipeAs(U4, extra(51), 'like');
ok(true, 'Plus: Kiss liberado depois do limite grátis');
await expectError('Só volta perfis passados (o último foi Kiss)', () => as(U4, 'select * from public.rewind()'), 'que você passou');
await swipeAs(U4, extra(55), 'nope');
const rewound = await as(U4, 'select name from public.rewind()');
ok(rewound.rows[0]?.name === 'Extra55', 'Plus: voltar perfil devolve o último que passou', rewound.rows[0]?.name);
const again = await as(U4, "select name from public.get_deck('national', 50)");
ok(again.rows.some((r) => r.name === 'Extra55'), 'O perfil volta para o baralho');

await db.exec(`update public.subscriptions set expires_at = now() - interval '1 day' where user_id = '${U4}'`);
ok((await usageOf(U4)).plan === 'free', 'Assinatura vencida volta ao plano grátis');

// Super Like aparece primeiro e com selo; depois o Kiss prioritário do Platinum
await swipeAs(U5, U6, 'like');
await db.exec(`insert into public.swipes values ('${extra(59)}', '${U6}', 'super')`);
const deck = await as(U6, "select name, super_liked_you from public.get_deck('national', 50)");
ok(deck.rows[0]?.name === 'Extra59' && deck.rows[0]?.super_liked_you === true,
  'Quem deu Super Like aparece primeiro, com selo', JSON.stringify(deck.rows[0]));
ok(deck.rows[1]?.name === 'Platina' && deck.rows[1]?.super_liked_you === false,
  'Em seguida, o Kiss prioritário do Platinum', deck.rows[1]?.name);
usage = await usageOf(U5);
ok(usage.supers_left === 10 && usage.likes_left === null, 'Platinum: 10 Super Likes e Kiss ilimitado', JSON.stringify(usage));

// ------------------------------------------------------------- passaporte
// U1 (Gold) vai para Lisboa: passa a ver portugueses no Estadual e a ser visto por lá.
const U7 = '77777777-7777-4777-8777-777777777777'; // mora em Lisboa
await db.exec(`insert into auth.users (id, email) values ('${U7}', 'u7@test.dev');`);
await db.exec(`insert into public.profiles (id, name, birthdate, gender, show_me, photos, city, state, country, lat, lng)
  values ('${U7}', 'Inês', '1995-05-05', 'woman', 'men', array['a','b'], 'Lisboa', 'Lisboa', 'Portugal', 38.72, -9.14)`);
await db.exec(`update public.subscriptions set expires_at = now() + interval '30 days' where user_id = '${U1}'`);

await as(U1, `insert into public.passports (user_id, city, state, country, lat, lng) values ($1, 'Lisboa', 'Lisboa', 'Portugal', 38.7223, -9.1393)`, [U1]);
const lisbon = await as(U1, "select name, city, distance_km from public.get_deck('state', 50)");
ok(lisbon.rows.some((r) => r.name === 'Inês') && lisbon.rows.every((r) => r.city === 'Lisboa'),
  'Passaporte: no Estadual, U1 vê quem está em Lisboa', lisbon.rows.map((r) => `${r.name}(${r.distance_km}km)`).join(', '));
const seenByLisbon = await as(U7, "select name, city from public.get_deck('state', 50)");
ok(seenByLisbon.rows.some((r) => r.name === 'Jairison' && r.city === 'Lisboa'),
  'Passaporte: quem está em Lisboa vê o U1 como se ele estivesse lá', JSON.stringify(seenByLisbon.rows));
await expectError('Não dá para mexer no passaporte de outra pessoa',
  () => as(U4, `insert into public.passports (user_id, city, country, lat, lng) values ($1, 'X', 'Y', 0, 0)`, [U1]), 'row-level security');

await db.exec(`update public.subscriptions set expires_at = now() - interval '1 day' where user_id = '${U1}'`);
const noPassport = await as(U1, "select city from public.get_deck('state', 50)");
ok(noPassport.rows.every((r) => r.city !== 'Lisboa'), 'Sem Gold, o passaporte deixa de valer (volta a São Paulo)');
await db.exec(`update public.subscriptions set expires_at = now() + interval '30 days' where user_id = '${U1}'`);
await as(U1, 'delete from public.passports where user_id = $1', [U1]);

// -------------------------------------------------------------------- boost
await expectError('Boost exige Gold', () => as(U4, 'select public.activate_boost()'), 'Kissly Gold');
let boost = (await as(U5, 'select * from public.boost_status()')).rows[0];
ok(boost.left_this_month === 3 && boost.active_until === null, 'Platinum começa o mês com 3 Boosts', JSON.stringify(boost));
await as(U5, 'select public.activate_boost()');
boost = (await as(U5, 'select * from public.boost_status()')).rows[0];
ok(boost.left_this_month === 2 && boost.active_until !== null, 'Ativar Boost consome 1 e fica ativo por 30 min', JSON.stringify(boost));
await expectError('Não ativa dois Boosts ao mesmo tempo', () => as(U5, 'select public.activate_boost()'), 'já está ativo');
await expectError('Não dá para criar Boost direto na tabela',
  () => as(U5, `insert into public.boosts (user_id, ends_at) values ($1, now())`, [U5]), 'permission denied');

// Quem está com Boost aparece antes (depois só de quem deu Super Like)
const U8 = '88888888-8888-4888-8888-888888888888';
await db.exec(`insert into auth.users (id, email) values ('${U8}', 'u8@test.dev');`);
await as(U8, insertProfile, [U8, 'Observa', '1993-03-03', 'woman', 'men']);
const boostedDeck = await as(U8, "select name from public.get_deck('state', 50)");
ok(boostedDeck.rows[0]?.name === 'Platina', 'Perfil com Boost aparece primeiro', boostedDeck.rows.slice(0, 3).map((r) => r.name).join(', '));

// --------------------------------------------------------------------- push
await as(U1, "select public.register_push_token('ExponentPushToken[abc]', 'android')");
await as(U5, "select public.register_push_token('ExponentPushToken[abc]', 'ios')");
const owner = await db.query("select user_id, platform from public.push_tokens where token = 'ExponentPushToken[abc]'");
ok(owner.rows[0].user_id === U5 && owner.rows[0].platform === 'ios', 'Token de push passa para quem entrou por último no aparelho');
await expectError('Ninguém lê tokens de push pelo app', () => as(U1, 'select * from public.push_tokens'), 'permission denied');
await as(U1, "select public.unregister_push_token('ExponentPushToken[abc]')");
ok((await db.query("select count(*)::int n from public.push_tokens")).rows[0].n === 1, 'Só o dono remove o próprio token');
await as(U5, "select public.unregister_push_token('ExponentPushToken[abc]')");
ok((await db.query("select count(*)::int n from public.push_tokens")).rows[0].n === 0, 'Dono remove o token ao sair');

await as(U1, 'insert into public.notification_settings (user_id, messages) values ($1, false)', [U1]);
ok((await as(U1, 'select messages from public.notification_settings')).rows[0].messages === false, 'Preferências de notificação salvas');

// ------------------------------------------------------------- verificação
await expectError('Selfie precisa estar na própria pasta',
  () => as(U4, "insert into public.verification_requests (pose, photo_path) values ('Joinha', $1)", [`${U1}/x.jpg`]), 'row-level security');
await as(U4, "insert into public.verification_requests (pose, photo_path) values ('Faça um joinha', $1)", [`${U4}/selfie.jpg`]);
ok(true, 'Envia pedido de verificação');
await expectError('Só um pedido pendente por vez',
  () => as(U4, "insert into public.verification_requests (pose, photo_path) values ('Outra', $1)", [`${U4}/2.jpg`]), 'duplicate key');
await expectError('Ninguém se aprova sozinho',
  () => as(U4, "update public.verification_requests set status = 'approved'"), 'permission denied');
await db.exec(`update public.verification_requests set status = 'approved' where user_id = '${U4}'`);
const verified = await db.query('select verified from public.profiles where id = $1', [U4]);
const reviewed = await db.query('select reviewed_at from public.verification_requests where user_id = $1', [U4]);
ok(verified.rows[0].verified === true && reviewed.rows[0].reviewed_at !== null, 'Aprovação da moderação acende o selo de verificado');
await expectError('Selfie de verificação não vai para a pasta de outra pessoa',
  () => as(U4, `insert into storage.objects (bucket_id, name) values ('verifications', '${U1}/x.jpg')`), 'row-level security');

// ---------------------------------------------------------------- bloqueios
const B1 = 'b1b1b1b1-0000-4000-8000-000000000001'; // homem, quer mulheres
const B2 = 'b2b2b2b2-0000-4000-8000-000000000002'; // mulher, quer homens
const B3 = 'b3b3b3b3-0000-4000-8000-000000000003'; // mulher, quer homens
await db.exec(`insert into auth.users (id, email) values ('${B1}', 'b1@test.dev'), ('${B2}', 'b2@test.dev'), ('${B3}', 'b3@test.dev');`);
const placeIn = `insert into public.profiles (id, name, birthdate, gender, show_me, photos, city, state, country)
  values ($1, $2, '1994-01-01', $3, $4, array['a','b'], 'Manaus', 'AM', 'Brasil')`;
await as(B1, placeIn, [B1, 'Bruno', 'man', 'women']);
await as(B2, placeIn, [B2, 'Bia', 'woman', 'men']);
await as(B3, placeIn, [B3, 'Bel', 'woman', 'men']);

const deckNames = async (uid) => (await as(uid, "select name from public.get_deck('state', 50)")).rows.map((r) => r.name);
ok((await deckNames(B1)).includes('Bia') && (await deckNames(B2)).includes('Bruno'), 'Antes do bloqueio, Bruno e Bia se veem');

// Bia curte Bruno; Bruno bloqueia Bia direto do card (sem match)
await swipeAs(B2, B1, 'like');
await as(B1, 'select public.block_user($1)', [B2]);
ok(!(await deckNames(B1)).includes('Bia'), 'Bloqueio: Bia some do baralho de quem bloqueou');
ok(!(await deckNames(B2)).includes('Bruno'), 'Bloqueio vale nos dois sentidos: Bruno some do baralho da Bia');
ok((await as(B1, 'select public.likes_you_count() n')).rows[0].n === 0, 'A curtida de quem foi bloqueado sai de "Curtidas"');
await expectError('Bloqueado não consegue criar match curtindo de novo',
  async () => {
    const r = await swipeAs(B2, B1, 'super');
    if (!r.rows[0].matched) throw new Error('sem match, como esperado');
  },
  'sem match');

// Com match: bloquear apaga o match e a conversa
await swipeAs(B1, B3, 'like');
const m = await swipeAs(B3, B1, 'like');
ok(m.rows[0].matched === true, 'Bruno e Bel dão match');
await as(B3, 'insert into public.messages (match_id, body) values ($1, $2)', [m.rows[0].match_id, 'oi']);
await as(B3, 'select public.block_user($1)', [B1]);
const leftover = await db.query('select (select count(*) from public.matches where id = $1)::int m, (select count(*) from public.messages where match_id = $1)::int msg', [m.rows[0].match_id]);
ok(leftover.rows[0].m + leftover.rows[0].msg === 0, 'Bloquear depois do match apaga o match e a conversa');

await expectError('Não dá para gravar bloqueio direto na tabela',
  () => as(B1, 'insert into public.blocks values ($1, $2)', [B1, B3]), 'permission denied');
const seen = await as(B2, 'select count(*)::int n from public.blocks');
ok(seen.rows[0].n === 0, 'Quem foi bloqueado não vê que foi bloqueado');
await expectError('Não dá para bloquear a si mesmo', () => as(B1, 'select public.block_user($1)', [B1]), 'a si mesmo');

// ---------------------------------------------------------------- perguntas do perfil
const P1 = 'c1c1c1c1-0000-4000-8000-000000000001';
const P2 = 'c2c2c2c2-0000-4000-8000-000000000002';
await db.exec(`insert into auth.users (id, email) values ('${P1}', 'p1@test.dev'), ('${P2}', 'p2@test.dev');`);
const inRecife = `insert into public.profiles (id, name, birthdate, gender, show_me, photos, city, state, country)
  values ($1, $2, '1994-01-01', $3, $4, array['a','b'], 'Recife', 'PE', 'Brasil')`;
await as(P1, inRecife, [P1, 'Paulo', 'man', 'women']);
await as(P2, inRecife, [P2, 'Paula', 'woman', 'men']);

const good = JSON.stringify([
  { question: 'Meu domingo ideal é…', answer: 'Praia cedo e um almoço demorado.' },
  { question: 'Vou te conquistar se…', answer: 'Me levar para comer tapioca.' },
]);
await as(P2, 'update public.profiles set prompts = $1::jsonb where id = $2', [good, P2]);
ok(true, 'Salva até 3 perguntas no próprio perfil');

const tooMany = JSON.stringify(Array.from({ length: 4 }, (_, i) => ({ question: `Pergunta ${i}`, answer: 'x' })));
await expectError('Mais de 3 perguntas é recusado',
  () => as(P2, 'update public.profiles set prompts = $1::jsonb where id = $2', [tooMany, P2]), 'check constraint');
await expectError('Resposta longa demais (mais de 150 letras) é recusada',
  () => as(P2, 'update public.profiles set prompts = $1::jsonb where id = $2',
    [JSON.stringify([{ question: 'Meu domingo ideal é…', answer: 'a'.repeat(151) }]), P2]), 'check constraint');
await expectError('Resposta vazia é recusada',
  () => as(P2, 'update public.profiles set prompts = $1::jsonb where id = $2',
    [JSON.stringify([{ question: 'Meu domingo ideal é…', answer: '   ' }]), P2]), 'check constraint');
await expectError('Formato inválido é recusado',
  () => as(P2, 'update public.profiles set prompts = $1::jsonb where id = $2', ['{"oi":1}', P2]), 'check constraint');

const card = await as(P1, "select name, prompts from public.get_deck('state', 50) where name = 'Paula'");
ok(card.rows[0]?.prompts?.[0]?.answer === 'Praia cedo e um almoço demorado.', 'O baralho traz as perguntas no card', JSON.stringify(card.rows[0]?.prompts));

await swipeAs(P1, P2, 'like');
await swipeAs(P2, P1, 'like');
const paulaConv = await as(P1, "select prompts from public.get_matches() where name = 'Paula'");
ok(paulaConv.rows[0]?.prompts?.length === 2, 'O match também traz as perguntas (para o perfil completo)');

console.log(failures ? `\n${failures} FALHA(S)` : '\nTODOS OS TESTES PASSARAM');
process.exit(failures ? 1 : 0);

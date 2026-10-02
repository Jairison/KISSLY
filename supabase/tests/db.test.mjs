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

console.log(failures ? `\n${failures} FALHA(S)` : '\nTODOS OS TESTES PASSARAM');
process.exit(failures ? 1 : 0);

-- =============================================================================
-- Kissly · chat em tempo real, desfazer match e denúncias
-- =============================================================================

-- ---------------------------------------------------------------- mensagens

create table public.messages (
  -- O app gera o id, para casar a mensagem otimista com a que volta do Realtime.
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references public.matches (id) on delete cascade,
  sender_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  read_at    timestamptz
);

create index messages_match_created_idx on public.messages (match_id, created_at desc);
create index messages_unread_idx on public.messages (match_id) where read_at is null;

alter table public.messages enable row level security;

-- Só as duas pessoas do match leem e escrevem; ninguém escreve em nome de outro.
create policy "Ler mensagens dos próprios matches" on public.messages
  for select to authenticated
  using (exists (
    select 1 from public.matches m
    where m.id = match_id and (select auth.uid()) in (m.user_a, m.user_b)
  ));

create policy "Enviar mensagens nos próprios matches" on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.matches m
      where m.id = match_id and (select auth.uid()) in (m.user_a, m.user_b)
    )
  );

revoke all on public.messages from anon, authenticated;
grant select on public.messages to authenticated;
grant insert (id, match_id, sender_id, body) on public.messages to authenticated;

-- Entrega instantânea pelo Supabase Realtime (respeita as regras de RLS acima).
alter publication supabase_realtime add table public.messages, public.matches;

-- Marca como lidas as mensagens recebidas num match.
create or replace function public.mark_read(p_match uuid)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.messages msg
  set read_at = now()
  where msg.match_id = p_match
    and msg.sender_id <> auth.uid()
    and msg.read_at is null
    and exists (
      select 1 from public.matches m
      where m.id = p_match and auth.uid() in (m.user_a, m.user_b)
    );
$$;

-- ------------------------------------------------- conversas (lista de chats)
-- Substitui a get_matches da migração inicial: agora traz a última mensagem e as não lidas.

drop function if exists public.get_matches();

create function public.get_matches()
returns table (
  match_id uuid, matched_at timestamptz,
  id uuid, name text, age int, gender text, bio text, job text, interests text[], photos text[],
  city text, state text, country text, verified boolean,
  last_message text, last_message_at timestamptz, last_from_me boolean, unread int
)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.created_at,
         p.id, p.name, public.age_of(p.birthdate), p.gender, p.bio, p.job, p.interests, p.photos,
         p.city, p.state, p.country, p.verified,
         last.body, last.created_at, last.sender_id = auth.uid(),
         (select count(*)::int from public.messages u
           where u.match_id = m.id and u.sender_id <> auth.uid() and u.read_at is null)
  from public.matches m
  join public.profiles p
    on p.id = case when m.user_a = auth.uid() then m.user_b else m.user_a end
  left join lateral (
    select msg.body, msg.created_at, msg.sender_id
    from public.messages msg
    where msg.match_id = m.id
    order by msg.created_at desc
    limit 1
  ) last on true
  where auth.uid() in (m.user_a, m.user_b)
  order by coalesce(last.created_at, m.created_at) desc;
$$;

-- ------------------------------------------------------------ desfazer match
-- Apaga o match e a conversa. Os swipes continuam, então a pessoa não volta ao baralho.

create or replace function public.unmatch(p_match uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  delete from public.matches m
  where m.id = p_match and auth.uid() in (m.user_a, m.user_b);
  if not found then
    raise exception 'Match não encontrado' using errcode = 'P0002';
  end if;
end;
$$;

-- ------------------------------------------------------------------ denúncias
-- Gravadas para a moderação revisar no painel. Ninguém lê denúncias pelo app.

create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  reported_id uuid not null references public.profiles (id) on delete cascade,
  reason      text not null check (reason in ('fake', 'inappropriate_photos', 'harassment', 'spam', 'underage', 'other')),
  details     text not null default '' check (char_length(details) <= 1000),
  status      text not null default 'open' check (status in ('open', 'reviewing', 'closed')),
  created_at  timestamptz not null default now(),
  check (reporter_id <> reported_id)
);

create index reports_open_idx on public.reports (created_at) where status = 'open';

alter table public.reports enable row level security;

create policy "Enviar denúncias" on public.reports
  for insert to authenticated with check (reporter_id = (select auth.uid()));

revoke all on public.reports from anon, authenticated;
grant insert (reporter_id, reported_id, reason, details) on public.reports to authenticated;

-- ---------------------------------------------------------------- permissões

revoke execute on function public.mark_read(uuid), public.get_matches(), public.unmatch(uuid) from public, anon;
grant execute on function public.mark_read(uuid), public.get_matches(), public.unmatch(uuid) to authenticated;

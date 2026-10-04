-- Kissly · instalação completa do banco (gerado a partir de supabase/migrations, em ordem).
-- Rode UMA vez num projeto novo: Supabase → SQL Editor → New query → colar tudo → Run.

-- ============================== 20261001000000_init.sql
-- =============================================================================
-- Kissly · esquema inicial
-- Perfis, preferências, planos, swipes e matches, com Row Level Security.
--
-- Princípio de privacidade: ninguém lê a tabela `profiles` de outra pessoa.
-- Perfis alheios só saem pelas funções get_deck / get_matches / get_likes_you,
-- que devolvem a idade (nunca a data de nascimento) e nunca as coordenadas.
-- =============================================================================

-- ---------------------------------------------------------------- utilidades

create or replace function public.age_of(p_birthdate date)
returns int
language sql
stable
as $$
  select extract(year from age(current_date, p_birthdate))::int;
$$;

-- Distância em km pela fórmula de Haversine (null se faltar coordenada).
create or replace function public.distance_km(lat1 double precision, lng1 double precision,
                                              lat2 double precision, lng2 double precision)
returns double precision
language sql
immutable
as $$
  select case
    when lat1 is null or lng1 is null or lat2 is null or lng2 is null then null
    else 2 * 6371 * asin(sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
    ))
  end;
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ------------------------------------------------------------------ perfis

create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  name           text not null check (char_length(name) between 2 and 24),
  birthdate      date not null,
  gender         text not null check (gender in ('woman', 'man', 'nonbinary')),
  show_me        text not null check (show_me in ('women', 'men', 'everyone')),
  bio            text not null default '' check (char_length(bio) <= 300),
  job            text not null default '' check (char_length(job) <= 40),
  interests      text[] not null default '{}' check (cardinality(interests) <= 5),
  photos         text[] not null check (cardinality(photos) between 2 and 6),
  city           text not null check (char_length(city) between 2 and 80),
  state          text not null default '',
  country        text not null default 'Brasil',
  lat            double precision check (lat between -90 and 90),
  lng            double precision check (lng between -180 and 180),
  verified       boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);

create index profiles_location_idx on public.profiles (country, state);

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Maioridade validada no banco também (não só no app).
create or replace function public.check_adult()
returns trigger
language plpgsql
as $$
begin
  if public.age_of(new.birthdate) < 18 then
    raise exception 'O Kissly é exclusivo para maiores de 18 anos' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger profiles_adult before insert on public.profiles
  for each row execute function public.check_adult();

alter table public.profiles enable row level security;

create policy "Ler o próprio perfil" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "Criar o próprio perfil" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "Editar o próprio perfil" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Colunas que o próprio usuário pode gravar. `verified` só o servidor altera
-- e a data de nascimento não muda depois do cadastro.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant insert (id, name, birthdate, gender, show_me, bio, job, interests, photos, city, state, country, lat, lng)
  on public.profiles to authenticated;
grant update (name, gender, show_me, bio, job, interests, photos, city, state, country, lat, lng, last_active_at)
  on public.profiles to authenticated;

-- ------------------------------------------------------------ preferências

create table public.preferences (
  user_id         uuid primary key references public.profiles (id) on delete cascade,
  age_min         int not null default 18 check (age_min >= 18),
  age_max         int not null default 45 check (age_max <= 70 and age_max >= age_min),
  -- null = sem limite
  max_distance_km int check (max_distance_km between 1 and 500),
  updated_at      timestamptz not null default now()
);

create trigger preferences_touch before update on public.preferences
  for each row execute function public.touch_updated_at();

alter table public.preferences enable row level security;

create policy "Gerenciar as próprias preferências" on public.preferences
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.preferences from anon;

-- ------------------------------------------------------------------ planos
-- Escrito só pelo servidor (webhook de pagamento na Parte 5). O app apenas lê.

create table public.subscriptions (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  plan       text not null check (plan in ('free', 'plus', 'gold', 'platinum')),
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "Ler o próprio plano" on public.subscriptions
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;

create or replace function public.current_plan(p_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select s.plan from public.subscriptions s
      where s.user_id = p_user and (s.expires_at is null or s.expires_at > now())),
    'free'
  );
$$;

-- ------------------------------------------------------- swipes e matches

create table public.swipes (
  swiper_id  uuid not null references public.profiles (id) on delete cascade,
  swipee_id  uuid not null references public.profiles (id) on delete cascade,
  direction  text not null check (direction in ('like', 'nope', 'super')),
  created_at timestamptz not null default now(),
  primary key (swiper_id, swipee_id),
  check (swiper_id <> swipee_id)
);

create index swipes_received_idx on public.swipes (swipee_id) where direction <> 'nope';

alter table public.swipes enable row level security;

-- Cada um vê só os próprios swipes. Gravação apenas pela função swipe().
create policy "Ler os próprios swipes" on public.swipes
  for select to authenticated using (swiper_id = (select auth.uid()));

revoke all on public.swipes from anon, authenticated;
grant select on public.swipes to authenticated;

create table public.matches (
  id         uuid primary key default gen_random_uuid(),
  user_a     uuid not null references public.profiles (id) on delete cascade,
  user_b     uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (user_a < user_b),
  unique (user_a, user_b)
);

create index matches_user_b_idx on public.matches (user_b);

alter table public.matches enable row level security;

create policy "Ler os próprios matches" on public.matches
  for select to authenticated using ((select auth.uid()) in (user_a, user_b));

revoke all on public.matches from anon, authenticated;
grant select on public.matches to authenticated;

-- ---------------------------------------------------------------- funções

-- Baralho de descoberta: alcance, interesse mútuo, idade e distância.
create or replace function public.get_deck(p_scope text default 'state', p_limit int default 20)
returns table (
  id uuid, name text, age int, gender text, bio text, job text, interests text[], photos text[],
  city text, state text, country text, verified boolean, distance_km int
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  me      public.profiles%rowtype;
  v_min   int := 18;
  v_max   int := 70;
  v_dist  int;
begin
  select * into me from public.profiles p where p.id = auth.uid();
  if not found then
    raise exception 'Perfil não encontrado' using errcode = 'P0002';
  end if;
  if p_scope not in ('state', 'national', 'international') then
    raise exception 'Alcance inválido: %', p_scope using errcode = '22023';
  end if;
  if p_scope = 'international' and public.current_plan(me.id) not in ('gold', 'platinum') then
    raise exception 'O modo Internacional é exclusivo do Kissly Gold' using errcode = 'P0001', hint = 'premium_required';
  end if;

  select pr.age_min, pr.age_max, pr.max_distance_km into v_min, v_max, v_dist
    from public.preferences pr where pr.user_id = me.id;
  v_min := coalesce(v_min, 18);
  v_max := coalesce(v_max, 70);

  return query
  select p.id, p.name, public.age_of(p.birthdate), p.gender, p.bio, p.job, p.interests, p.photos,
         p.city, p.state, p.country, p.verified,
         round(public.distance_km(me.lat, me.lng, p.lat, p.lng))::int
  from public.profiles p
  where p.id <> me.id
    and not exists (select 1 from public.swipes s where s.swiper_id = me.id and s.swipee_id = p.id)
    -- eu quero ver o gênero dessa pessoa…
    and (me.show_me = 'everyone' or (me.show_me = 'women' and p.gender = 'woman') or (me.show_me = 'men' and p.gender = 'man'))
    -- …e ela quer ver o meu
    and (p.show_me = 'everyone' or (p.show_me = 'women' and me.gender = 'woman') or (p.show_me = 'men' and me.gender = 'man'))
    and public.age_of(p.birthdate) >= v_min
    and (v_max >= 70 or public.age_of(p.birthdate) <= v_max)
    and case p_scope
          when 'state' then p.country = me.country and p.state = me.state
          when 'national' then p.country = me.country
          else p.country <> me.country
        end
    -- distância máxima só no modo Estadual; sem coordenadas, não dá para filtrar
    and (p_scope <> 'state' or v_dist is null
         or coalesce(public.distance_km(me.lat, me.lng, p.lat, p.lng) <= v_dist, true))
  order by
    case when p_scope = 'state' then public.distance_km(me.lat, me.lng, p.lat, p.lng) end asc nulls last,
    p.last_active_at desc
  limit least(greatest(p_limit, 1), 50);
end;
$$;

-- Registra o swipe e devolve se virou match.
create or replace function public.swipe(p_target uuid, p_direction text)
returns table (matched boolean, match_id uuid)
language plpgsql
volatile
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_me    uuid := auth.uid();
  v_match uuid;
begin
  if v_me is null then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;
  if p_direction not in ('like', 'nope', 'super') then
    raise exception 'Direção inválida: %', p_direction using errcode = '22023';
  end if;
  if p_target = v_me then
    raise exception 'Não é possível curtir a si mesmo' using errcode = '22023';
  end if;

  insert into public.swipes (swiper_id, swipee_id, direction)
  values (v_me, p_target, p_direction)
  on conflict (swiper_id, swipee_id) do update set direction = excluded.direction, created_at = now();

  update public.profiles set last_active_at = now() where id = v_me;

  if p_direction <> 'nope' and exists (
    select 1 from public.swipes s
    where s.swiper_id = p_target and s.swipee_id = v_me and s.direction <> 'nope'
  ) then
    insert into public.matches (user_a, user_b)
    values (least(v_me, p_target), greatest(v_me, p_target))
    on conflict (user_a, user_b) do nothing
    returning id into v_match;

    if v_match is null then
      select m.id into v_match from public.matches m
      where m.user_a = least(v_me, p_target) and m.user_b = greatest(v_me, p_target);
    end if;
    return query select true, v_match;
  else
    return query select false, null::uuid;
  end if;
end;
$$;

create or replace function public.get_matches()
returns table (
  match_id uuid, matched_at timestamptz,
  id uuid, name text, age int, gender text, bio text, job text, interests text[], photos text[],
  city text, state text, country text, verified boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.created_at,
         p.id, p.name, public.age_of(p.birthdate), p.gender, p.bio, p.job, p.interests, p.photos,
         p.city, p.state, p.country, p.verified
  from public.matches m
  join public.profiles p
    on p.id = case when m.user_a = auth.uid() then m.user_b else m.user_a end
  where auth.uid() in (m.user_a, m.user_b)
  order by m.created_at desc;
$$;

-- Quantas pessoas curtiram você e ainda aguardam sua resposta.
create or replace function public.likes_you_count()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.swipes s
  where s.swipee_id = auth.uid()
    and s.direction <> 'nope'
    and not exists (
      select 1 from public.swipes mine where mine.swiper_id = auth.uid() and mine.swipee_id = s.swiper_id
    );
$$;

-- Quem curtiu você (recurso Gold/Platinum).
create or replace function public.get_likes_you()
returns table (
  id uuid, name text, age int, gender text, bio text, job text, interests text[], photos text[],
  city text, state text, country text, verified boolean, super_like boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if public.current_plan(auth.uid()) not in ('gold', 'platinum') then
    raise exception 'Ver quem curtiu você é exclusivo do Kissly Gold' using errcode = 'P0001', hint = 'premium_required';
  end if;

  return query
  select p.id, p.name, public.age_of(p.birthdate), p.gender, p.bio, p.job, p.interests, p.photos,
         p.city, p.state, p.country, p.verified, s.direction = 'super'
  from public.swipes s
  join public.profiles p on p.id = s.swiper_id
  where s.swipee_id = auth.uid()
    and s.direction <> 'nope'
    and not exists (
      select 1 from public.swipes mine where mine.swiper_id = auth.uid() and mine.swipee_id = s.swiper_id
    )
  order by s.direction = 'super' desc, s.created_at desc;
end;
$$;

-- Exclusão de conta (exigida pela App Store e pelo Google Play).
-- As fotos são apagadas pelo app antes, via Storage API.
create or replace function public.delete_account()
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

-- Só usuários logados chamam as funções; funções internas ficam fechadas.
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.get_deck(text, int),
  public.swipe(uuid, text),
  public.get_matches(),
  public.likes_you_count(),
  public.get_likes_you(),
  public.delete_account(),
  public.age_of(date),
  public.distance_km(double precision, double precision, double precision, double precision)
to authenticated;

-- ----------------------------------------------------------------- fotos

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Cada pessoa só envia e apaga arquivos dentro da pasta com o próprio id.
create policy "Enviar fotos na própria pasta" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "Apagar as próprias fotos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid()::text));

-- ============================== 20261002000000_chat.sql
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

-- ============================== 20261003000000_plans.sql
-- =============================================================================
-- Kissly · planos: limites diários, voltar perfil, Kiss prioritário e Super Like visível
--
--             Kiss/dia    Super Like/dia   Voltar   Quem curtiu   Internacional   Prioridade
--   free         50             1            não        não            não            não
--   plus     ilimitado          3            sim        não            não            não
--   gold     ilimitado          5            sim        sim            sim            não
--   platinum ilimitado         10            sim        sim            sim            sim
--
-- A tabela `subscriptions` é atualizada pelas Edge Functions do RevenueCat (supabase/functions).
-- =============================================================================

create or replace function public.plan_limits(p_plan text)
returns table (
  daily_likes int, daily_supers int, can_rewind boolean, see_likes boolean, international boolean, priority boolean
)
language sql
immutable
as $$
  select v.daily_likes, v.daily_supers, v.can_rewind, v.see_likes, v.international, v.priority
  from (values
    ('free',     50::int,   1, false, false, false, false),
    ('plus',     null::int, 3, true,  false, false, false),
    ('gold',     null::int, 5, true,  true,  true,  false),
    ('platinum', null::int, 10, true, true,  true,  true)
  ) as v (plan, daily_likes, daily_supers, can_rewind, see_likes, international, priority)
  where v.plan = coalesce(p_plan, 'free');
$$;

-- Os limites diários reiniciam à meia-noite de Brasília.
create or replace function public.day_start()
returns timestamptz
language sql
stable
as $$
  select date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
$$;

create or replace function public.swipes_today(p_user uuid, p_direction text)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.swipes s
  where s.swiper_id = p_user and s.direction = p_direction and s.created_at >= public.day_start();
$$;

-- Quanto ainda resta hoje (null em likes_left = ilimitado).
create or replace function public.my_usage()
returns table (plan text, likes_left int, supers_left int, resets_at timestamptz, can_rewind boolean)
language sql
stable
security definer
set search_path = public
as $$
  with me as (select auth.uid() as id, public.current_plan(auth.uid()) as plan)
  select me.plan,
         case when l.daily_likes is null then null
              else greatest(0, l.daily_likes - public.swipes_today(me.id, 'like')) end,
         greatest(0, l.daily_supers - public.swipes_today(me.id, 'super')),
         public.day_start() + interval '1 day',
         l.can_rewind
  from me cross join lateral public.plan_limits(me.plan) l;
$$;

-- ------------------------------------------------- swipe com limites do plano

create or replace function public.swipe(p_target uuid, p_direction text)
returns table (matched boolean, match_id uuid)
language plpgsql
volatile
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_me    uuid := auth.uid();
  v_match uuid;
  v_limit record;
begin
  if v_me is null then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;
  if p_direction not in ('like', 'nope', 'super') then
    raise exception 'Direção inválida: %', p_direction using errcode = '22023';
  end if;
  if p_target = v_me then
    raise exception 'Não é possível curtir a si mesmo' using errcode = '22023';
  end if;

  select * into v_limit from public.plan_limits(public.current_plan(v_me));
  if p_direction = 'like' and v_limit.daily_likes is not null
     and public.swipes_today(v_me, 'like') >= v_limit.daily_likes then
    raise exception 'Você usou todos os seus Kiss de hoje' using errcode = 'P0001', hint = 'limit_likes';
  end if;
  if p_direction = 'super' and public.swipes_today(v_me, 'super') >= v_limit.daily_supers then
    raise exception 'Você usou todos os seus Super Likes de hoje' using errcode = 'P0001', hint = 'limit_super';
  end if;

  insert into public.swipes (swiper_id, swipee_id, direction)
  values (v_me, p_target, p_direction)
  on conflict (swiper_id, swipee_id) do update set direction = excluded.direction, created_at = now();

  update public.profiles set last_active_at = now() where id = v_me;

  if p_direction <> 'nope' and exists (
    select 1 from public.swipes s
    where s.swiper_id = p_target and s.swipee_id = v_me and s.direction <> 'nope'
  ) then
    insert into public.matches (user_a, user_b)
    values (least(v_me, p_target), greatest(v_me, p_target))
    on conflict (user_a, user_b) do nothing
    returning id into v_match;

    if v_match is null then
      select m.id into v_match from public.matches m
      where m.user_a = least(v_me, p_target) and m.user_b = greatest(v_me, p_target);
    end if;
    return query select true, v_match;
  else
    return query select false, null::uuid;
  end if;
end;
$$;

-- -------------------------------------- baralho: Super Like visível + prioridade
-- Quem deu Super Like em você aparece primeiro, com um selo; depois os Kiss de assinantes Platinum.

drop function if exists public.get_deck(text, int);

create function public.get_deck(p_scope text default 'state', p_limit int default 20)
returns table (
  id uuid, name text, age int, gender text, bio text, job text, interests text[], photos text[],
  city text, state text, country text, verified boolean, distance_km int, super_liked_you boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  me      public.profiles%rowtype;
  v_min   int := 18;
  v_max   int := 70;
  v_dist  int;
begin
  select * into me from public.profiles p where p.id = auth.uid();
  if not found then
    raise exception 'Perfil não encontrado' using errcode = 'P0002';
  end if;
  if p_scope not in ('state', 'national', 'international') then
    raise exception 'Alcance inválido: %', p_scope using errcode = '22023';
  end if;
  if p_scope = 'international' and not (select l.international from public.plan_limits(public.current_plan(me.id)) l) then
    raise exception 'O modo Internacional é exclusivo do Kissly Gold' using errcode = 'P0001', hint = 'premium_required';
  end if;

  select pr.age_min, pr.age_max, pr.max_distance_km into v_min, v_max, v_dist
    from public.preferences pr where pr.user_id = me.id;
  v_min := coalesce(v_min, 18);
  v_max := coalesce(v_max, 70);

  return query
  select p.id, p.name, public.age_of(p.birthdate), p.gender, p.bio, p.job, p.interests, p.photos,
         p.city, p.state, p.country, p.verified,
         round(public.distance_km(me.lat, me.lng, p.lat, p.lng))::int,
         coalesce(liked.direction = 'super', false)
  from public.profiles p
  left join public.swipes liked
    on liked.swiper_id = p.id and liked.swipee_id = me.id and liked.direction <> 'nope'
  where p.id <> me.id
    and not exists (select 1 from public.swipes s where s.swiper_id = me.id and s.swipee_id = p.id)
    and (me.show_me = 'everyone' or (me.show_me = 'women' and p.gender = 'woman') or (me.show_me = 'men' and p.gender = 'man'))
    and (p.show_me = 'everyone' or (p.show_me = 'women' and me.gender = 'woman') or (p.show_me = 'men' and me.gender = 'man'))
    and public.age_of(p.birthdate) >= v_min
    and (v_max >= 70 or public.age_of(p.birthdate) <= v_max)
    and case p_scope
          when 'state' then p.country = me.country and p.state = me.state
          when 'national' then p.country = me.country
          else p.country <> me.country
        end
    and (p_scope <> 'state' or v_dist is null
         or coalesce(public.distance_km(me.lat, me.lng, p.lat, p.lng) <= v_dist, true))
  order by
    (liked.direction = 'super') desc nulls last,
    (liked.swiper_id is not null and (select l.priority from public.plan_limits(public.current_plan(p.id)) l)) desc nulls last,
    case when p_scope = 'state' then public.distance_km(me.lat, me.lng, p.lat, p.lng) end asc nulls last,
    p.last_active_at desc
  limit least(greatest(p_limit, 1), 50);
end;
$$;

-- ----------------------------------------------------------- voltar perfil
-- Desfaz o último "nope" (Plus ou superior) e devolve o card para mostrar de novo.

create or replace function public.rewind()
returns table (
  id uuid, name text, age int, gender text, bio text, job text, interests text[], photos text[],
  city text, state text, country text, verified boolean, distance_km int, super_liked_you boolean
)
language plpgsql
volatile
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_me   uuid := auth.uid();
  v_last public.swipes%rowtype;
begin
  if not (select l.can_rewind from public.plan_limits(public.current_plan(v_me)) l) then
    raise exception 'Voltar perfis é um recurso do Kissly Plus' using errcode = 'P0001', hint = 'premium_required';
  end if;

  select * into v_last from public.swipes s where s.swiper_id = v_me order by s.created_at desc limit 1;
  if not found then
    raise exception 'Não há nenhum perfil para voltar' using errcode = 'P0002';
  end if;
  if v_last.direction <> 'nope' then
    raise exception 'Só dá para voltar perfis que você passou' using errcode = 'P0001';
  end if;

  delete from public.swipes s where s.swiper_id = v_me and s.swipee_id = v_last.swipee_id;

  return query
  select p.id, p.name, public.age_of(p.birthdate), p.gender, p.bio, p.job, p.interests, p.photos,
         p.city, p.state, p.country, p.verified,
         round(public.distance_km(me.lat, me.lng, p.lat, p.lng))::int,
         exists (select 1 from public.swipes l where l.swiper_id = p.id and l.swipee_id = v_me and l.direction = 'super')
  from public.profiles p
  cross join (select lat, lng from public.profiles where id = v_me) me
  where p.id = v_last.swipee_id;
end;
$$;

-- ---------------------------------------------------------------- permissões

revoke execute on function
  public.plan_limits(text), public.day_start(), public.swipes_today(uuid, text),
  public.my_usage(), public.swipe(uuid, text), public.get_deck(text, int), public.rewind()
from public, anon;

grant execute on function public.my_usage(), public.swipe(uuid, text), public.get_deck(text, int), public.rewind()
to authenticated;

-- ============================== 20261004000000_extras.sql
-- =============================================================================
-- Kissly · Passaporte, Boost, notificações push e verificação de perfil
-- =============================================================================

-- --------------------------------------------------------------- Passaporte
-- Gold/Platinum escolhem uma cidade e passam a "estar" lá: veem e são vistos por quem é de lá.

create table public.passports (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  city       text not null check (char_length(city) between 2 and 80),
  state      text not null default '',
  country    text not null,
  lat        double precision not null check (lat between -90 and 90),
  lng        double precision not null check (lng between -180 and 180),
  updated_at timestamptz not null default now()
);

alter table public.passports enable row level security;

create policy "Gerenciar o próprio passaporte" on public.passports
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.passports from anon;

-- Localização que vale para a descoberta: a do passaporte (se o plano permitir) ou a real.
create or replace function public.effective_location(p_user uuid)
returns table (city text, state text, country text, lat double precision, lng double precision, via_passport boolean)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(pp.city, p.city), coalesce(pp.state, p.state), coalesce(pp.country, p.country),
         coalesce(pp.lat, p.lat), coalesce(pp.lng, p.lng), pp.user_id is not null
  from public.profiles p
  left join public.passports pp
    on pp.user_id = p.id
   and (select l.international from public.plan_limits(public.current_plan(p.id)) l)
  where p.id = p_user;
$$;

-- -------------------------------------------------------------------- Boost
-- 30 minutos no topo do baralho de quem está perto. Gold: 1 por mês; Platinum: 3.

create table public.boosts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  started_at timestamptz not null default now(),
  ends_at    timestamptz not null
);

create index boosts_user_idx on public.boosts (user_id, started_at desc);
create index boosts_active_idx on public.boosts (ends_at);

alter table public.boosts enable row level security;
create policy "Ver os próprios boosts" on public.boosts
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.boosts from anon, authenticated;
grant select on public.boosts to authenticated;

create or replace function public.monthly_boosts(p_plan text)
returns int
language sql
immutable
as $$
  select case p_plan when 'platinum' then 3 when 'gold' then 1 else 0 end;
$$;

create or replace function public.is_boosted(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.boosts b where b.user_id = p_user and now() < b.ends_at);
$$;

create or replace function public.boost_status()
returns table (active_until timestamptz, left_this_month int)
language sql
stable
security definer
set search_path = public
as $$
  select (select max(b.ends_at) from public.boosts b where b.user_id = auth.uid() and now() < b.ends_at),
         greatest(0, public.monthly_boosts(public.current_plan(auth.uid())) - (
           select count(*)::int from public.boosts b
           where b.user_id = auth.uid()
             and b.started_at >= date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'
         ));
$$;

create or replace function public.activate_boost()
returns timestamptz
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_status record;
  v_ends   timestamptz;
begin
  if public.monthly_boosts(public.current_plan(auth.uid())) = 0 then
    raise exception 'O Boost faz parte do Kissly Gold' using errcode = 'P0001', hint = 'premium_required';
  end if;
  select * into v_status from public.boost_status();
  if v_status.active_until is not null then
    raise exception 'Seu Boost já está ativo' using errcode = 'P0001';
  end if;
  if v_status.left_this_month <= 0 then
    raise exception 'Você já usou os Boosts deste mês' using errcode = 'P0001', hint = 'limit_boost';
  end if;
  insert into public.boosts (user_id, ends_at) values (auth.uid(), now() + interval '30 minutes')
  returning ends_at into v_ends;
  return v_ends;
end;
$$;

-- ---------------------------------------------- baralho com passaporte + boost

create or replace function public.get_deck(p_scope text default 'state', p_limit int default 20)
returns table (
  id uuid, name text, age int, gender text, bio text, job text, interests text[], photos text[],
  city text, state text, country text, verified boolean, distance_km int, super_liked_you boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  me      public.profiles%rowtype;
  here    record;
  v_min   int := 18;
  v_max   int := 70;
  v_dist  int;
begin
  select * into me from public.profiles p where p.id = auth.uid();
  if not found then
    raise exception 'Perfil não encontrado' using errcode = 'P0002';
  end if;
  if p_scope not in ('state', 'national', 'international') then
    raise exception 'Alcance inválido: %', p_scope using errcode = '22023';
  end if;
  if p_scope = 'international' and not (select l.international from public.plan_limits(public.current_plan(me.id)) l) then
    raise exception 'O modo Internacional é exclusivo do Kissly Gold' using errcode = 'P0001', hint = 'premium_required';
  end if;

  select * into here from public.effective_location(me.id);

  select pr.age_min, pr.age_max, pr.max_distance_km into v_min, v_max, v_dist
    from public.preferences pr where pr.user_id = me.id;
  v_min := coalesce(v_min, 18);
  v_max := coalesce(v_max, 70);

  return query
  with people as (
    select p.*, loc.city as e_city, loc.state as e_state, loc.country as e_country, loc.lat as e_lat, loc.lng as e_lng,
           public.distance_km(here.lat, here.lng, loc.lat, loc.lng) as dist
    from public.profiles p
    cross join lateral public.effective_location(p.id) loc
    where p.id <> me.id
  )
  select p.id, p.name, public.age_of(p.birthdate), p.gender, p.bio, p.job, p.interests, p.photos,
         p.e_city, p.e_state, p.e_country, p.verified,
         round(p.dist)::int,
         coalesce(liked.direction = 'super', false)
  from people p
  left join public.swipes liked
    on liked.swiper_id = p.id and liked.swipee_id = me.id and liked.direction <> 'nope'
  where not exists (select 1 from public.swipes s where s.swiper_id = me.id and s.swipee_id = p.id)
    and (me.show_me = 'everyone' or (me.show_me = 'women' and p.gender = 'woman') or (me.show_me = 'men' and p.gender = 'man'))
    and (p.show_me = 'everyone' or (p.show_me = 'women' and me.gender = 'woman') or (p.show_me = 'men' and me.gender = 'man'))
    and public.age_of(p.birthdate) >= v_min
    and (v_max >= 70 or public.age_of(p.birthdate) <= v_max)
    and case p_scope
          when 'state' then p.e_country = here.country and p.e_state = here.state
          when 'national' then p.e_country = here.country
          else p.e_country <> here.country
        end
    and (p_scope <> 'state' or v_dist is null or coalesce(p.dist <= v_dist, true))
  order by
    (liked.direction = 'super') desc nulls last,
    public.is_boosted(p.id) desc,
    (liked.swiper_id is not null and (select l.priority from public.plan_limits(public.current_plan(p.id)) l)) desc nulls last,
    case when p_scope = 'state' then p.dist end asc nulls last,
    p.last_active_at desc
  limit least(greatest(p_limit, 1), 50);
end;
$$;

-- ------------------------------------------------------- notificações push

create table public.push_tokens (
  token      text primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  platform   text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);

create index push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from anon, authenticated;

-- Um aparelho pode trocar de conta: o token passa a pertencer a quem registrou por último.
create or replace function public.register_push_token(p_token text, p_platform text)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  insert into public.push_tokens (token, user_id, platform)
  values (p_token, auth.uid(), p_platform)
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
$$;

create or replace function public.unregister_push_token(p_token text)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
$$;

create table public.notification_settings (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  new_matches boolean not null default true,
  messages    boolean not null default true,
  updated_at  timestamptz not null default now()
);

alter table public.notification_settings enable row level security;
create policy "Gerenciar as próprias notificações" on public.notification_settings
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.notification_settings from anon;

-- ---------------------------------------------------- verificação de perfil
-- A pessoa tira uma selfie imitando uma pose sorteada; a moderação compara com as fotos
-- do perfil e muda o status para "approved" no painel, o que acende o selo azul.

create table public.verification_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  pose         text not null check (char_length(pose) between 3 and 120),
  photo_path   text not null,
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewer_note text,
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz
);

create index verification_pending_idx on public.verification_requests (created_at) where status = 'pending';
-- No máximo um pedido em análise por pessoa.
create unique index verification_one_pending on public.verification_requests (user_id) where status = 'pending';

alter table public.verification_requests enable row level security;

create policy "Enviar a própria verificação" on public.verification_requests
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and photo_path like (select auth.uid()::text) || '/%'
  );
create policy "Ver as próprias verificações" on public.verification_requests
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.verification_requests from anon, authenticated;
grant select on public.verification_requests to authenticated;
grant insert (user_id, pose, photo_path) on public.verification_requests to authenticated;

create or replace function public.apply_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    new.reviewed_at := now();
    update public.profiles set verified = (new.status = 'approved') where id = new.user_id;
  end if;
  return new;
end;
$$;

create trigger verification_review before update on public.verification_requests
  for each row execute function public.apply_verification();

-- Selfies de verificação ficam num bucket PRIVADO: só a moderação vê.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('verifications', 'verifications', false, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "Enviar selfie de verificação na própria pasta" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'verifications' and (storage.foldername(name))[1] = (select auth.uid()::text));

-- ---------------------------------------------------------------- permissões

revoke execute on function
  public.effective_location(uuid), public.monthly_boosts(text), public.is_boosted(uuid),
  public.boost_status(), public.activate_boost(), public.get_deck(text, int),
  public.register_push_token(text, text), public.unregister_push_token(text), public.apply_verification()
from public, anon;

grant execute on function
  public.boost_status(), public.activate_boost(), public.get_deck(text, int),
  public.register_push_token(text, text), public.unregister_push_token(text)
to authenticated;

-- ============================== 20261005000000_storage_select.sql
-- =============================================================================
-- Kissly · correção: listar as próprias fotos
--
-- O Storage só apaga arquivos que a pessoa consegue listar. Sem esta regra, remover uma
-- foto do perfil ou excluir a conta deixava os arquivos para trás (e ainda públicos).
-- A leitura pública das fotos pela URL continua igual (o bucket "photos" é público).
-- =============================================================================

create policy "Listar as próprias fotos" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid()::text));

-- ============================== 20261006000000_blocks.sql
-- =============================================================================
-- Kissly · bloqueios
--
-- Bloquear vale nos dois sentidos: nenhum dos dois volta a ver o outro no baralho,
-- o match (e a conversa) entre eles é apagado e a curtida pendente some de "Curtidas".
-- A pessoa bloqueada não é avisada.
-- =============================================================================

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index blocks_blocked_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;

-- Cada um vê só quem ele mesmo bloqueou. Gravação apenas pela função block_user().
create policy "Ver os próprios bloqueios" on public.blocks
  for select to authenticated using (blocker_id = (select auth.uid()));

revoke all on public.blocks from anon, authenticated;
grant select on public.blocks to authenticated;

create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

create or replace function public.block_user(p_target uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;
  if p_target = v_me then
    raise exception 'Não é possível bloquear a si mesmo' using errcode = '22023';
  end if;

  insert into public.blocks (blocker_id, blocked_id) values (v_me, p_target)
  on conflict do nothing;

  -- Some do baralho de quem bloqueou (e não volta com "voltar perfil", que só desfaz o último swipe).
  insert into public.swipes (swiper_id, swipee_id, direction) values (v_me, p_target, 'nope')
  on conflict (swiper_id, swipee_id) do update set direction = 'nope';

  delete from public.matches
  where user_a = least(v_me, p_target) and user_b = greatest(v_me, p_target);
end;
$$;

-- ------------------------------------------- baralho e curtidas sem bloqueados

create or replace function public.get_deck(p_scope text default 'state', p_limit int default 20)
returns table (
  id uuid, name text, age int, gender text, bio text, job text, interests text[], photos text[],
  city text, state text, country text, verified boolean, distance_km int, super_liked_you boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  me      public.profiles%rowtype;
  here    record;
  v_min   int := 18;
  v_max   int := 70;
  v_dist  int;
begin
  select * into me from public.profiles p where p.id = auth.uid();
  if not found then
    raise exception 'Perfil não encontrado' using errcode = 'P0002';
  end if;
  if p_scope not in ('state', 'national', 'international') then
    raise exception 'Alcance inválido: %', p_scope using errcode = '22023';
  end if;
  if p_scope = 'international' and not (select l.international from public.plan_limits(public.current_plan(me.id)) l) then
    raise exception 'O modo Internacional é exclusivo do Kissly Gold' using errcode = 'P0001', hint = 'premium_required';
  end if;

  select * into here from public.effective_location(me.id);

  select pr.age_min, pr.age_max, pr.max_distance_km into v_min, v_max, v_dist
    from public.preferences pr where pr.user_id = me.id;
  v_min := coalesce(v_min, 18);
  v_max := coalesce(v_max, 70);

  return query
  with people as (
    select p.*, loc.city as e_city, loc.state as e_state, loc.country as e_country, loc.lat as e_lat, loc.lng as e_lng,
           public.distance_km(here.lat, here.lng, loc.lat, loc.lng) as dist
    from public.profiles p
    cross join lateral public.effective_location(p.id) loc
    where p.id <> me.id
  )
  select p.id, p.name, public.age_of(p.birthdate), p.gender, p.bio, p.job, p.interests, p.photos,
         p.e_city, p.e_state, p.e_country, p.verified,
         round(p.dist)::int,
         coalesce(liked.direction = 'super', false)
  from people p
  left join public.swipes liked
    on liked.swiper_id = p.id and liked.swipee_id = me.id and liked.direction <> 'nope'
  where not exists (select 1 from public.swipes s where s.swiper_id = me.id and s.swipee_id = p.id)
    and not public.is_blocked_between(me.id, p.id)
    and (me.show_me = 'everyone' or (me.show_me = 'women' and p.gender = 'woman') or (me.show_me = 'men' and p.gender = 'man'))
    and (p.show_me = 'everyone' or (p.show_me = 'women' and me.gender = 'woman') or (p.show_me = 'men' and me.gender = 'man'))
    and public.age_of(p.birthdate) >= v_min
    and (v_max >= 70 or public.age_of(p.birthdate) <= v_max)
    and case p_scope
          when 'state' then p.e_country = here.country and p.e_state = here.state
          when 'national' then p.e_country = here.country
          else p.e_country <> here.country
        end
    and (p_scope <> 'state' or v_dist is null or coalesce(p.dist <= v_dist, true))
  order by
    (liked.direction = 'super') desc nulls last,
    public.is_boosted(p.id) desc,
    (liked.swiper_id is not null and (select l.priority from public.plan_limits(public.current_plan(p.id)) l)) desc nulls last,
    case when p_scope = 'state' then p.dist end asc nulls last,
    p.last_active_at desc
  limit least(greatest(p_limit, 1), 50);
end;
$$;

create or replace function public.likes_you_count()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.swipes s
  where s.swipee_id = auth.uid()
    and s.direction <> 'nope'
    and not exists (
      select 1 from public.swipes mine where mine.swiper_id = auth.uid() and mine.swipee_id = s.swiper_id
    )
    and not public.is_blocked_between(auth.uid(), s.swiper_id);
$$;

create or replace function public.get_likes_you()
returns table (
  id uuid, name text, age int, gender text, bio text, job text, interests text[], photos text[],
  city text, state text, country text, verified boolean, super_like boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if public.current_plan(auth.uid()) not in ('gold', 'platinum') then
    raise exception 'Ver quem curtiu você é exclusivo do Kissly Gold' using errcode = 'P0001', hint = 'premium_required';
  end if;

  return query
  select p.id, p.name, public.age_of(p.birthdate), p.gender, p.bio, p.job, p.interests, p.photos,
         p.city, p.state, p.country, p.verified, s.direction = 'super'
  from public.swipes s
  join public.profiles p on p.id = s.swiper_id
  where s.swipee_id = auth.uid()
    and s.direction <> 'nope'
    and not exists (
      select 1 from public.swipes mine where mine.swiper_id = auth.uid() and mine.swipee_id = s.swiper_id
    )
    and not public.is_blocked_between(auth.uid(), s.swiper_id)
  order by s.direction = 'super' desc, s.created_at desc;
end;
$$;

-- ---------------------------------------------------------------- permissões

revoke execute on function public.is_blocked_between(uuid, uuid), public.block_user(uuid) from public, anon;
grant execute on function public.block_user(uuid) to authenticated;

-- ============================== 20261007000000_prompts.sql
-- =============================================================================
-- Kissly · perguntas do perfil ("Meu domingo ideal é…")
--
-- Até 3 perguntas por perfil, guardadas como [{ "question": "...", "answer": "..." }].
-- As funções que devolvem cards passam a incluir a coluna `prompts`.
-- =============================================================================

create or replace function public.valid_prompts(p jsonb)
returns boolean
language sql
immutable
as $$
  select jsonb_typeof(p) = 'array'
     and jsonb_array_length(p) <= 3
     and not exists (
       select 1 from jsonb_array_elements(p) e
       where jsonb_typeof(e) <> 'object'
          or jsonb_typeof(e -> 'question') <> 'string'
          or jsonb_typeof(e -> 'answer') <> 'string'
          or char_length(e ->> 'question') not between 3 and 80
          or char_length(btrim(e ->> 'answer')) not between 1 and 150
     );
$$;

alter table public.profiles
  add column prompts jsonb not null default '[]'::jsonb check (public.valid_prompts(prompts));

grant insert (prompts), update (prompts) on public.profiles to authenticated;

-- ------------------------------------------------------------ baralho

drop function if exists public.get_deck(text, int);

create function public.get_deck(p_scope text default 'state', p_limit int default 20)
returns table (
  id uuid, name text, age int, gender text, bio text, job text, interests text[], photos text[],
  city text, state text, country text, verified boolean, distance_km int, super_liked_you boolean, prompts jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  me      public.profiles%rowtype;
  here    record;
  v_min   int := 18;
  v_max   int := 70;
  v_dist  int;
begin
  select * into me from public.profiles p where p.id = auth.uid();
  if not found then
    raise exception 'Perfil não encontrado' using errcode = 'P0002';
  end if;
  if p_scope not in ('state', 'national', 'international') then
    raise exception 'Alcance inválido: %', p_scope using errcode = '22023';
  end if;
  if p_scope = 'international' and not (select l.international from public.plan_limits(public.current_plan(me.id)) l) then
    raise exception 'O modo Internacional é exclusivo do Kissly Gold' using errcode = 'P0001', hint = 'premium_required';
  end if;

  select * into here from public.effective_location(me.id);

  select pr.age_min, pr.age_max, pr.max_distance_km into v_min, v_max, v_dist
    from public.preferences pr where pr.user_id = me.id;
  v_min := coalesce(v_min, 18);
  v_max := coalesce(v_max, 70);

  return query
  with people as (
    select p.*, loc.city as e_city, loc.state as e_state, loc.country as e_country, loc.lat as e_lat, loc.lng as e_lng,
           public.distance_km(here.lat, here.lng, loc.lat, loc.lng) as dist
    from public.profiles p
    cross join lateral public.effective_location(p.id) loc
    where p.id <> me.id
  )
  select p.id, p.name, public.age_of(p.birthdate), p.gender, p.bio, p.job, p.interests, p.photos,
         p.e_city, p.e_state, p.e_country, p.verified,
         round(p.dist)::int,
         coalesce(liked.direction = 'super', false),
         p.prompts
  from people p
  left join public.swipes liked
    on liked.swiper_id = p.id and liked.swipee_id = me.id and liked.direction <> 'nope'
  where not exists (select 1 from public.swipes s where s.swiper_id = me.id and s.swipee_id = p.id)
    and not public.is_blocked_between(me.id, p.id)
    and (me.show_me = 'everyone' or (me.show_me = 'women' and p.gender = 'woman') or (me.show_me = 'men' and p.gender = 'man'))
    and (p.show_me = 'everyone' or (p.show_me = 'women' and me.gender = 'woman') or (p.show_me = 'men' and me.gender = 'man'))
    and public.age_of(p.birthdate) >= v_min
    and (v_max >= 70 or public.age_of(p.birthdate) <= v_max)
    and case p_scope
          when 'state' then p.e_country = here.country and p.e_state = here.state
          when 'national' then p.e_country = here.country
          else p.e_country <> here.country
        end
    and (p_scope <> 'state' or v_dist is null or coalesce(p.dist <= v_dist, true))
  order by
    (liked.direction = 'super') desc nulls last,
    public.is_boosted(p.id) desc,
    (liked.swiper_id is not null and (select l.priority from public.plan_limits(public.current_plan(p.id)) l)) desc nulls last,
    case when p_scope = 'state' then p.dist end asc nulls last,
    p.last_active_at desc
  limit least(greatest(p_limit, 1), 50);
end;
$$;

-- ------------------------------------------------------------ voltar perfil

drop function if exists public.rewind();

create function public.rewind()
returns table (
  id uuid, name text, age int, gender text, bio text, job text, interests text[], photos text[],
  city text, state text, country text, verified boolean, distance_km int, super_liked_you boolean, prompts jsonb
)
language plpgsql
volatile
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_me   uuid := auth.uid();
  v_last public.swipes%rowtype;
begin
  if not (select l.can_rewind from public.plan_limits(public.current_plan(v_me)) l) then
    raise exception 'Voltar perfis é um recurso do Kissly Plus' using errcode = 'P0001', hint = 'premium_required';
  end if;

  select * into v_last from public.swipes s where s.swiper_id = v_me order by s.created_at desc limit 1;
  if not found then
    raise exception 'Não há nenhum perfil para voltar' using errcode = 'P0002';
  end if;
  if v_last.direction <> 'nope' then
    raise exception 'Só dá para voltar perfis que você passou' using errcode = 'P0001';
  end if;
  -- Quem foi bloqueado não volta.
  if public.is_blocked_between(v_me, v_last.swipee_id) then
    raise exception 'Esse perfil foi bloqueado e não pode voltar' using errcode = 'P0001';
  end if;

  delete from public.swipes s where s.swiper_id = v_me and s.swipee_id = v_last.swipee_id;

  return query
  select p.id, p.name, public.age_of(p.birthdate), p.gender, p.bio, p.job, p.interests, p.photos,
         p.city, p.state, p.country, p.verified,
         round(public.distance_km(me.lat, me.lng, p.lat, p.lng))::int,
         exists (select 1 from public.swipes l where l.swiper_id = p.id and l.swipee_id = v_me and l.direction = 'super'),
         p.prompts
  from public.profiles p
  cross join (select lat, lng from public.profiles where id = v_me) me
  where p.id = v_last.swipee_id;
end;
$$;

-- ------------------------------------------------------------ conversas

drop function if exists public.get_matches();

create function public.get_matches()
returns table (
  match_id uuid, matched_at timestamptz,
  id uuid, name text, age int, gender text, bio text, job text, interests text[], photos text[],
  city text, state text, country text, verified boolean,
  last_message text, last_message_at timestamptz, last_from_me boolean, unread int, prompts jsonb
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
           where u.match_id = m.id and u.sender_id <> auth.uid() and u.read_at is null),
         p.prompts
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

-- ------------------------------------------------------------ quem curtiu

drop function if exists public.get_likes_you();

create function public.get_likes_you()
returns table (
  id uuid, name text, age int, gender text, bio text, job text, interests text[], photos text[],
  city text, state text, country text, verified boolean, super_like boolean, prompts jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if public.current_plan(auth.uid()) not in ('gold', 'platinum') then
    raise exception 'Ver quem curtiu você é exclusivo do Kissly Gold' using errcode = 'P0001', hint = 'premium_required';
  end if;

  return query
  select p.id, p.name, public.age_of(p.birthdate), p.gender, p.bio, p.job, p.interests, p.photos,
         p.city, p.state, p.country, p.verified, s.direction = 'super', p.prompts
  from public.swipes s
  join public.profiles p on p.id = s.swiper_id
  where s.swipee_id = auth.uid()
    and s.direction <> 'nope'
    and not exists (
      select 1 from public.swipes mine where mine.swiper_id = auth.uid() and mine.swipee_id = s.swiper_id
    )
    and not public.is_blocked_between(auth.uid(), s.swiper_id)
  order by s.direction = 'super' desc, s.created_at desc;
end;
$$;

-- ---------------------------------------------------------------- permissões

revoke execute on function
  public.valid_prompts(jsonb), public.get_deck(text, int), public.rewind(), public.get_matches(), public.get_likes_you()
from public, anon;
grant execute on function
  public.get_deck(text, int), public.rewind(), public.get_matches(), public.get_likes_you()
to authenticated;

-- ============================== 20261008000000_invites.sql
-- =============================================================================
-- Kissly · convites com recompensa
--
-- Cada pessoa tem um código. Quem entra com um código e completa o perfil ganha
-- 3 dias de Gold; quem convidou ganha 7 dias de Gold a cada 3 amigos.
-- Os prêmios ficam em reward_grants (separados das assinaturas da loja, que são
-- reescritas pela sincronização com o RevenueCat).
-- =============================================================================

create table public.invite_codes (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  code       text not null unique check (code ~ '^[A-Z2-9]{6}$'),
  created_at timestamptz not null default now()
);

create table public.referrals (
  invitee_id uuid primary key references public.profiles (id) on delete cascade,
  inviter_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (invitee_id <> inviter_id)
);

create index referrals_inviter_idx on public.referrals (inviter_id);

create table public.reward_grants (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  plan       text not null check (plan in ('plus', 'gold', 'platinum')),
  reason     text not null,
  starts_at  timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (expires_at > starts_at)
);

create index reward_grants_user_idx on public.reward_grants (user_id, expires_at);

alter table public.invite_codes enable row level security;
alter table public.referrals enable row level security;
alter table public.reward_grants enable row level security;

create policy "Ver o próprio código" on public.invite_codes
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Ver os próprios prêmios" on public.reward_grants
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.invite_codes, public.referrals, public.reward_grants from anon, authenticated;
grant select on public.invite_codes, public.reward_grants to authenticated;

-- ----------------------------------------------------- plano considera prêmios

create or replace function public.current_plan(p_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select x.plan from (
      select s.plan from public.subscriptions s
      where s.user_id = p_user and (s.expires_at is null or s.expires_at > now())
      union all
      select g.plan from public.reward_grants g
      where g.user_id = p_user and now() >= g.starts_at and now() < g.expires_at
    ) x
    order by case x.plan when 'platinum' then 3 when 'gold' then 2 when 'plus' then 1 else 0 end desc
    limit 1
  ), 'free');
$$;

-- O app lê o plano por aqui (a tabela subscriptions sozinha não conhece os prêmios).
create or replace function public.my_plan()
returns table (plan text, expires_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select public.current_plan(auth.uid()),
         (select max(e) from (
            select s.expires_at as e from public.subscriptions s where s.user_id = auth.uid()
            union all
            select g.expires_at from public.reward_grants g where g.user_id = auth.uid() and now() < g.expires_at
          ) t);
$$;

-- ---------------------------------------------------------------- funções

-- Concede dias de um plano, emendando com um prêmio igual que ainda esteja valendo.
create or replace function public.grant_reward(p_user uuid, p_plan text, p_days int, p_reason text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_start timestamptz := greatest(
    now(),
    coalesce((select max(g.expires_at) from public.reward_grants g where g.user_id = p_user and g.plan = p_plan), now())
  );
begin
  insert into public.reward_grants (user_id, plan, reason, starts_at, expires_at)
  values (p_user, p_plan, p_reason, v_start, v_start + make_interval(days => p_days));
end;
$$;

-- Devolve o código da pessoa (criando na primeira vez) e o progresso dos convites.
create or replace function public.my_invite()
returns table (code text, invited int, rewards_earned int, next_reward_in int)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_me    uuid := auth.uid();
  v_code  text;
  v_count int;
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
begin
  if not exists (select 1 from public.profiles where id = v_me) then
    raise exception 'Perfil não encontrado' using errcode = 'P0002';
  end if;

  select c.code into v_code from public.invite_codes c where c.user_id = v_me;
  while v_code is null loop
    v_code := (
      select string_agg(substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1), '')
      from generate_series(1, 6)
    );
    begin
      insert into public.invite_codes (user_id, code) values (v_me, v_code);
    exception when unique_violation then
      v_code := null; -- código já usado por outra pessoa: sorteia outro
    end;
  end loop;

  select count(*)::int into v_count from public.referrals r where r.inviter_id = v_me;
  return query select v_code, v_count, v_count / 3, 3 - (v_count % 3);
end;
$$;

-- Usa um código de convite (só nos primeiros 7 dias da conta, uma única vez).
create or replace function public.redeem_invite(p_code text)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_me      uuid := auth.uid();
  v_inviter uuid;
  v_created timestamptz;
  v_count   int;
begin
  select p.created_at into v_created from public.profiles p where p.id = v_me;
  if v_created is null then
    raise exception 'Complete seu perfil antes de usar um convite' using errcode = 'P0002';
  end if;

  select c.user_id into v_inviter from public.invite_codes c where c.code = upper(btrim(p_code));
  if v_inviter is null then return 'invalid'; end if;
  if v_inviter = v_me then return 'own'; end if;
  if exists (select 1 from public.referrals r where r.invitee_id = v_me) then return 'already'; end if;
  if v_created < now() - interval '7 days' then return 'expired'; end if;

  insert into public.referrals (invitee_id, inviter_id) values (v_me, v_inviter);
  perform public.grant_reward(v_me, 'gold', 3, 'convite: boas-vindas');

  select count(*)::int into v_count from public.referrals r where r.inviter_id = v_inviter;
  if v_count % 3 = 0 then
    perform public.grant_reward(v_inviter, 'gold', 7, 'convite: 3 amigos');
  end if;
  return 'ok';
end;
$$;

-- ---------------------------------------------------------------- permissões

revoke execute on function
  public.my_plan(), public.grant_reward(uuid, text, int, text), public.my_invite(), public.redeem_invite(text)
from public, anon;
grant execute on function public.my_plan(), public.my_invite(), public.redeem_invite(text) to authenticated;

-- ============================== 20261009000000_function_privileges.sql
-- =============================================================================
-- Kissly · correção de segurança: quem pode executar cada função
--
-- O Supabase dá EXECUTE em toda função nova para os papéis anon e authenticated.
-- As migrações anteriores tiravam a permissão só de anon, então qualquer pessoa logada
-- conseguia chamar funções internas — por exemplo, effective_location() (cidade e
-- coordenadas de outra pessoa), is_blocked_between() (quem bloqueou quem) e
-- grant_reward() (dar plano pago a si mesmo).
--
-- Daqui em diante: tudo fechado por padrão, e liberado só o que o app chama.
-- =============================================================================

-- O gatilho que barra menores de 18 roda com as permissões de quem cria o perfil e chama
-- age_of(), que vai ser fechada abaixo. Passa a rodar com as permissões do dono.
alter function public.check_adult() security definer set search_path = public;

revoke execute on all functions in schema public from public, anon, authenticated;

-- Funções que o app chama (supabase.rpc). Todas validam auth.uid() por dentro.
grant execute on function
  public.get_deck(text, int),
  public.swipe(uuid, text),
  public.rewind(),
  public.my_usage(),
  public.my_plan(),
  public.get_matches(),
  public.mark_read(uuid),
  public.unmatch(uuid),
  public.likes_you_count(),
  public.get_likes_you(),
  public.block_user(uuid),
  public.boost_status(),
  public.activate_boost(),
  public.register_push_token(text, text),
  public.unregister_push_token(text),
  public.my_invite(),
  public.redeem_invite(text),
  public.delete_account()
to authenticated;

-- Usada pela regra (CHECK) da coluna profiles.prompts ao salvar o perfil. Só confere formato.
grant execute on function public.valid_prompts(jsonb) to authenticated;

-- Funções novas nascem fechadas; cada migração libera explicitamente o que for do app.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ============================== 20261010000000_photo_moderation.sql
-- =============================================================================
-- Kissly · moderação automática de fotos
--
-- A Edge Function moderate-photo analisa cada foto enviada (Sightengine) e apaga
-- as que tiverem nudez explícita, violência ou símbolos de ódio. Cada recusa fica
-- registrada aqui para a equipe revisar (ex.: banir quem insiste).
-- =============================================================================

create table public.photo_moderation (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users (id) on delete set null,
  path       text not null,
  reasons    text[] not null,
  scores     jsonb,
  -- 'app': analisada no envio; 'webhook': pega pela verificação de reserva
  source     text not null default 'app' check (source in ('app', 'webhook')),
  created_at timestamptz not null default now()
);

create index photo_moderation_user_idx on public.photo_moderation (user_id, created_at desc);

-- Só a equipe (painel do Supabase) e a Edge Function (chave de serviço) acessam.
alter table public.photo_moderation enable row level security;
revoke all on public.photo_moderation from anon, authenticated;

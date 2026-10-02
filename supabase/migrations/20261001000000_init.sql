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

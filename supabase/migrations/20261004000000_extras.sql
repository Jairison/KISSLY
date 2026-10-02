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

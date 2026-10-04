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

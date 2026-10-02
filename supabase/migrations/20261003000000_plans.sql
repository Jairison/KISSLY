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

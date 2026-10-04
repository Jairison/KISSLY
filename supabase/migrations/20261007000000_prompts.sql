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

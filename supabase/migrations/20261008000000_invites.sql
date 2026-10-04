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

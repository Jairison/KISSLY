-- =============================================================================
-- Kissly · correções de privacidade
--
-- 1) Triangulação: coordenadas (perfil e Passaporte) são arredondadas no servidor para
--    uma grade de 0,01° (~1 km). Mesmo movendo a própria localização e medindo distâncias,
--    ninguém descobre mais do que o "quarteirão de 1 km" de outra pessoa.
-- 2) Fotos do perfil só podem ser arquivos do próprio armazenamento do Kissly, na pasta
--    da própria pessoa (nada de links externos que driblam a moderação ou rastreiam
--    quem abre o perfil).
-- =============================================================================

-- ------------------------------------------------------------ 1) localização

create or replace function public.snap_coordinates()
returns trigger
language plpgsql
as $$
begin
  if new.lat is not null then new.lat := round(new.lat::numeric, 2)::double precision; end if;
  if new.lng is not null then new.lng := round(new.lng::numeric, 2)::double precision; end if;
  return new;
end;
$$;

create trigger profiles_snap_location before insert or update of lat, lng on public.profiles
  for each row execute function public.snap_coordinates();
create trigger passports_snap_location before insert or update of lat, lng on public.passports
  for each row execute function public.snap_coordinates();

-- Arredonda o que já estava salvo.
update public.profiles set lat = lat, lng = lng where lat is not null or lng is not null;
update public.passports set lat = lat, lng = lng;

-- ------------------------------------------------------------ 2) fotos do perfil

-- Endereço público do Storage deste projeto, ex.: https://abcd.supabase.co
-- (preenchido na atualização; sem ele, aceita qualquer projeto *.supabase.co).
create table if not exists public.app_settings (
  key   text primary key,
  value text not null
);
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;
-- Só endereços públicos ficam aqui; quem está logado pode ler (a checagem abaixo precisa).
grant select on public.app_settings to authenticated;
create policy "Ler configurações públicas" on public.app_settings for select to authenticated using (true);

-- Roda com as permissões de quem chama: assim current_user diz se o pedido veio do app,
-- e a busca em storage.objects só enxerga as fotos da própria pessoa (regra do Storage).
create or replace function public.check_profile_photos()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_base   text := (select value from public.app_settings where key = 'storage_public_url');
  v_prefix text := '/storage/v1/object/public/photos/' || new.id || '/';
  v_url    text;
  v_name   text;
begin
  -- Só vale para pedidos vindos do app; o painel, o seed e as funções do servidor passam.
  if current_user <> 'authenticated' then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.photos is not distinct from old.photos then
    return new;
  end if;

  foreach v_url in array new.photos loop
    if v_base is not null then
      if left(v_url, length(v_base || v_prefix)) <> v_base || v_prefix then
        raise exception 'Foto inválida: envie as fotos pelo app' using errcode = '22023';
      end if;
    elsif v_url !~ ('^https://[a-z0-9-]+\.supabase\.co' || replace(v_prefix, '.', '\.') || '[^/?#]+$') then
      raise exception 'Foto inválida: envie as fotos pelo app' using errcode = '22023';
    end if;

    v_name := new.id || '/' || split_part(substr(v_url, strpos(v_url, v_prefix) + length(v_prefix)), '?', 1);
    if not exists (select 1 from storage.objects o where o.bucket_id = 'photos' and o.name = v_name) then
      raise exception 'Foto inválida: arquivo não encontrado' using errcode = '22023';
    end if;
  end loop;
  return new;
end;
$$;

create trigger profiles_check_photos before insert or update of photos on public.profiles
  for each row execute function public.check_profile_photos();

revoke execute on function public.snap_coordinates(), public.check_profile_photos() from public, anon, authenticated;

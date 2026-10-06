-- =============================================================================
-- Kissly · exclusão completa de dados
--
-- 1) Quem está no match pode apagar os arquivos da conversa (fotos e áudios) —
--    o app faz isso ao desfazer o match ou bloquear.
-- 2) Denúncias sobrevivem à exclusão de conta (de quem denunciou ou de quem foi
--    denunciado), guardando só um resumo mínimo para a moderação.
-- A limpeza dos arquivos na exclusão de conta é feita pela Edge Function delete-account.
-- =============================================================================

create policy "Apagar mídia do próprio match" on storage.objects
  for delete to authenticated
  using (bucket_id = 'chat-media' and public.is_match_member((storage.foldername(name))[1]));

-- --------------------------------------------------------------- denúncias

alter table public.reports drop constraint if exists reports_reporter_id_fkey;
alter table public.reports drop constraint if exists reports_reported_id_fkey;
alter table public.reports alter column reporter_id drop not null;
alter table public.reports alter column reported_id drop not null;
alter table public.reports
  add constraint reports_reporter_id_fkey foreign key (reporter_id) references public.profiles (id) on delete set null,
  add constraint reports_reported_id_fkey foreign key (reported_id) references public.profiles (id) on delete set null;

-- Resumo de quem foi denunciado, tirado no momento da denúncia (sem fotos nem contato).
alter table public.reports add column reported_snapshot jsonb;

create or replace function public.snapshot_reported()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select jsonb_build_object(
           'name', p.name,
           'age', public.age_of(p.birthdate),
           'gender', p.gender,
           'city', p.city,
           'state', p.state,
           'country', p.country,
           'profile_created_at', p.created_at
         )
    into new.reported_snapshot
  from public.profiles p
  where p.id = new.reported_id;
  return new;
end;
$$;

create trigger reports_snapshot before insert on public.reports
  for each row execute function public.snapshot_reported();

revoke execute on function public.snapshot_reported() from public, anon, authenticated;

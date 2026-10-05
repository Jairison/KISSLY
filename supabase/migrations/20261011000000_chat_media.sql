-- =============================================================================
-- Kissly · fotos, áudios e GIFs no chat
--
-- Fotos e áudios ficam no bucket PRIVADO "chat-media", em "<id do match>/<arquivo>":
-- só as duas pessoas do match conseguem enviar e abrir (o app usa links temporários).
-- GIFs vêm do GIPHY e guardam só o endereço do GIF.
-- =============================================================================

alter table public.messages
  add column kind text not null default 'text' check (kind in ('text', 'image', 'gif', 'audio')),
  add column media_url text,
  -- { "width": 1080, "height": 1350 } para imagem/GIF; { "durationMs": 12000 } para áudio
  add column media_meta jsonb;

alter table public.messages drop constraint if exists messages_body_check;
alter table public.messages add constraint messages_content_check check (
  char_length(body) <= 1000
  and case kind
    when 'text' then char_length(btrim(body)) >= 1 and media_url is null
    -- foto e áudio: arquivo dentro da pasta do próprio match
    when 'image' then media_url like match_id::text || '/%'
    when 'audio' then media_url like match_id::text || '/%'
    -- GIF: somente endereços do GIPHY
    when 'gif' then media_url ~ '^https://(media[0-9]*|i)\.giphy\.com/'
  end
);

grant insert (kind, media_url, media_meta) on public.messages to authenticated;

-- --------------------------------------------------------------- arquivos

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-media', 'chat-media', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac', 'audio/mpeg', 'audio/webm', 'audio/ogg']
)
on conflict (id) do nothing;

-- Quem pode ver ou enviar arquivos de um match: só as duas pessoas dele.
create or replace function public.is_match_member(p_match text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.matches m
    where m.id::text = p_match and auth.uid() in (m.user_a, m.user_b)
  );
$$;

revoke execute on function public.is_match_member(text) from public, anon;
-- Usada pelas regras do Storage, que rodam com as permissões de quem está logado.
grant execute on function public.is_match_member(text) to authenticated;

create policy "Enviar mídia no próprio match" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'chat-media' and public.is_match_member((storage.foldername(name))[1]));

create policy "Ver mídia do próprio match" on storage.objects
  for select to authenticated
  using (bucket_id = 'chat-media' and public.is_match_member((storage.foldername(name))[1]));

-- ---------------------------------------------- prévia na lista de conversas

create or replace function public.message_preview(p_kind text, p_body text)
returns text
language sql
immutable
as $$
  select case p_kind
    when 'image' then '📷 Foto'
    when 'gif' then 'GIF'
    when 'audio' then '🎤 Áudio'
    else p_body
  end;
$$;

create or replace function public.get_matches()
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
         public.message_preview(last.kind, last.body), last.created_at, last.sender_id = auth.uid(),
         (select count(*)::int from public.messages u
           where u.match_id = m.id and u.sender_id <> auth.uid() and u.read_at is null),
         p.prompts
  from public.matches m
  join public.profiles p
    on p.id = case when m.user_a = auth.uid() then m.user_b else m.user_a end
  left join lateral (
    select msg.body, msg.kind, msg.created_at, msg.sender_id
    from public.messages msg
    where msg.match_id = m.id
    order by msg.created_at desc
    limit 1
  ) last on true
  where auth.uid() in (m.user_a, m.user_b)
  order by coalesce(last.created_at, m.created_at) desc;
$$;

revoke execute on function public.message_preview(text, text) from public, anon, authenticated;
revoke execute on function public.get_matches() from public, anon;
grant execute on function public.get_matches() to authenticated;

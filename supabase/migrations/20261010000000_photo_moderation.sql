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

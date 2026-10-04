-- =============================================================================
-- Kissly · correção: listar as próprias fotos
--
-- O Storage só apaga arquivos que a pessoa consegue listar. Sem esta regra, remover uma
-- foto do perfil ou excluir a conta deixava os arquivos para trás (e ainda públicos).
-- A leitura pública das fotos pela URL continua igual (o bucket "photos" é público).
-- =============================================================================

create policy "Listar as próprias fotos" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid()::text));

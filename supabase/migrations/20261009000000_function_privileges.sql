-- =============================================================================
-- Kissly · correção de segurança: quem pode executar cada função
--
-- O Supabase dá EXECUTE em toda função nova para os papéis anon e authenticated.
-- As migrações anteriores tiravam a permissão só de anon, então qualquer pessoa logada
-- conseguia chamar funções internas — por exemplo, effective_location() (cidade e
-- coordenadas de outra pessoa), is_blocked_between() (quem bloqueou quem) e
-- grant_reward() (dar plano pago a si mesmo).
--
-- Daqui em diante: tudo fechado por padrão, e liberado só o que o app chama.
-- =============================================================================

revoke execute on all functions in schema public from public, anon, authenticated;

-- Funções que o app chama (supabase.rpc). Todas validam auth.uid() por dentro.
grant execute on function
  public.get_deck(text, int),
  public.swipe(uuid, text),
  public.rewind(),
  public.my_usage(),
  public.my_plan(),
  public.get_matches(),
  public.mark_read(uuid),
  public.unmatch(uuid),
  public.likes_you_count(),
  public.get_likes_you(),
  public.block_user(uuid),
  public.boost_status(),
  public.activate_boost(),
  public.register_push_token(text, text),
  public.unregister_push_token(text),
  public.my_invite(),
  public.redeem_invite(text),
  public.delete_account()
to authenticated;

-- Usada pela regra (CHECK) da coluna profiles.prompts ao salvar o perfil. Só confere formato.
grant execute on function public.valid_prompts(jsonb) to authenticated;

-- Funções novas nascem fechadas; cada migração libera explicitamente o que for do app.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

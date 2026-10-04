-- =============================================================================
-- Kissly · dados de DEMONSTRAÇÃO (somente desenvolvimento — não rode em produção)
--
-- Cria 16 perfis fictícios. Os marcados em demo_like_back curtem de volta
-- automaticamente qualquer pessoa que der Kiss neles, para você testar o match.
-- Para remover tudo: rode o bloco "LIMPEZA" no fim deste arquivo.
-- =============================================================================

create table if not exists public.demo_like_back (user_id uuid primary key);
alter table public.demo_like_back enable row level security;

create or replace function public.demo_auto_like_back()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.direction <> 'nope' and exists (select 1 from public.demo_like_back d where d.user_id = new.swipee_id) then
    insert into public.swipes (swiper_id, swipee_id, direction)
    values (new.swipee_id, new.swiper_id, 'like')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists swipes_demo_like_back on public.swipes;
create trigger swipes_demo_like_back after insert on public.swipes
  for each row execute function public.demo_auto_like_back();

with demo (n, name, age, gender, job, bio, interests, img, city, state, country, lat, lng, likes_back) as (
  values
  (1,  'Isabela',   26, 'woman', 'Arquiteta',          'Café coado, museus vazios e viagens sem roteiro. Me leva pra conhecer seu restaurante favorito?', array['Arquitetura','Vinho','Viagens'],         26, 'Campinas',        'SP',  'Brasil',    -22.9056, -47.0608, true),
  (2,  'Rafael',    29, 'man',   'Fotógrafo',          'Fotografo pessoas de verdade. Procuro alguém que ria alto e topa um pôr do sol no Ibirapuera.',     array['Fotografia','Jazz','Corrida'],           12, 'São Paulo',       'SP',  'Brasil',    -23.5874, -46.6576, false),
  (3,  'Sofia',     30, 'woman', 'Designer de moda',   'Lisboeta de coração. Se vier a Portugal, os pastéis de nata são por minha conta.',                  array['Moda','Fado','Gastronomia'],             36, 'Lisboa',          'Lisboa','Portugal', 38.7223,  -9.1393, true),
  (4,  'Camila',    28, 'woman', 'Médica',             'Plantão de dia, samba de noite. Quero alguém leve, que goste de praia e de conversa boa.',          array['Samba','Praia','Yoga'],                  44, 'Rio de Janeiro',  'RJ',  'Brasil',    -22.9068, -43.1729, false),
  (5,  'Thiago',    31, 'man',   'Chef de cozinha',    'Cozinho melhor do que danço, mas danço mesmo assim. Primeiro encontro: jantar feito por mim.',      array['Culinária','Vinho','Música ao vivo'],    13, 'Ribeirão Preto',  'SP',  'Brasil',    -21.1775, -47.8103, true),
  (6,  'Lucía',     27, 'woman', 'Professora de tango','Buenos Aires, livros e tango. ¿Bailamos?',                                                          array['Tango','Literatura','Teatro'],           45, 'Buenos Aires',    'BA',  'Argentina', -34.6037, -58.3816, false),
  (7,  'Luana',     25, 'woman', 'Produtora musical',  'Salvador, axé e beats. Se você tiver uma playlist boa, já ganhou pontos.',                          array['Música','Carnaval','Dança'],             16, 'Salvador',        'BA',  'Brasil',    -12.9777, -38.5016, true),
  (8,  'Diego',     32, 'man',   'Engenheiro',         'Madrid, futebol e tapas. Aprendendo português, me ajuda?',                                          array['Futebol','Idiomas','Tapas'],             68, 'Madri',           'MD',  'Espanha',    40.4168,  -3.7038, false),
  (9,  'Valentina', 24, 'woman', 'Advogada',           'Litoral, livros e cachorros. Sinceridade acima de tudo.',                                           array['Pets','Leitura','Surf'],                 47, 'Santos',          'SP',  'Brasil',    -23.9608, -46.3336, false),
  (10, 'Pedro',     27, 'man',   'Desenvolvedor',      'Curitiba, trilhas e café especial. Bora fugir pra serra no fim de semana?',                         array['Trilhas','Café','Games'],                53, 'Curitiba',        'PR',  'Brasil',    -25.4284, -49.2733, true),
  (11, 'Chloé',     28, 'woman', 'Sommelière',         'Paris, vinho e cinema francês. Je cherche quelqu''un de vrai.',                                     array['Vinho','Cinema','Arte'],                 23, 'Paris',           'IDF', 'França',     48.8566,   2.3522, false),
  (12, 'Beatriz',   29, 'woman', 'Jornalista',         'Pão de queijo, boas histórias e shows. Me conta a sua?',                                            array['Escrita','Shows','Podcasts'],            32, 'Belo Horizonte',  'MG',  'Brasil',    -19.9167, -43.9345, true),
  (13, 'Mariana',   27, 'woman', 'Psicóloga',          'Paulistana, adoro brunch e exposições. Procuro algo leve que pode virar sério.',                    array['Arte','Brunch','Pilates'],                5, 'São Paulo',       'SP',  'Brasil',    -23.5614, -46.6559, true),
  (14, 'Amara',     26, 'woman', 'Personal trainer',   'Miami sun, good vibes. Amo o Brasil, já fui ao Rio 3 vezes!',                                       array['Fitness','Praia','Viagens'],             49, 'Miami',           'FL',  'EUA',        25.7617, -80.1918, true),
  (15, 'Gabriel',   30, 'man',   'Professor',          'Recife, frevo e livros. Nerd assumido com ótimo gosto pra comida.',                                 array['Livros','Frevo','Séries'],               59, 'Recife',          'PE',  'Brasil',     -8.0476, -34.8770, false),
  (16, 'Marco',     33, 'man',   'Barbeiro',           'Milano, motos e espresso. Sempre sonhei em conhecer o Brasil.',                                     array['Motos','Café','Design'],                 11, 'Milão',           'MI',  'Itália',     45.4642,   9.1900, true)
),
ids as (
  select d.*, ('00000000-0000-4000-8000-' || lpad(d.n::text, 12, '0'))::uuid as uid from demo d
),
new_users as (
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  select uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         'demo' || n || '@kissly.dev', '', now(),
         '{"provider":"email","providers":["email"]}', '{"demo":true}', now(), now(),
         '', '', '', ''
  from ids
  on conflict (id) do nothing
  returning id
),
new_profiles as (
  insert into public.profiles (id, name, birthdate, gender, show_me, bio, job, interests, photos,
                               city, state, country, lat, lng, verified)
  select uid, name, (current_date - make_interval(years => age, days => 40 + n * 9))::date, gender, 'everyone', bio, job, interests,
         array[format('https://i.pravatar.cc/800?img=%s', img), format('https://i.pravatar.cc/800?img=%s', img)],
         city, state, country, lat, lng, n % 3 <> 0
  from ids
  where uid in (select id from new_users)
  returning id
)
insert into public.demo_like_back (user_id)
select uid from ids where likes_back and uid in (select id from new_profiles)
on conflict do nothing;

-- Perguntas do perfil em alguns perfis de demonstração
update public.profiles set prompts = '[{"question":"Meu domingo ideal é…","answer":"Feira de antiguidades de manhã e um vinho no fim da tarde."},{"question":"Vou te conquistar se…","answer":"Souber o nome do arquiteto daquele prédio bonito."}]'::jsonb where id = '00000000-0000-4000-8000-000000000001';
update public.profiles set prompts = '[{"question":"O primeiro encontro perfeito seria…","answer":"Exposição no MASP e depois um brunch sem pressa."},{"question":"Meu green flag favorito é…","answer":"Gente que pergunta \"chegou bem?\"."}]'::jsonb where id = '00000000-0000-4000-8000-000000000013';
update public.profiles set prompts = '[{"question":"Não vivo sem…","answer":"Meu cachorro, o Bento, e o mar de Santos."}]'::jsonb where id = '00000000-0000-4000-8000-000000000009';
update public.profiles set prompts = '[{"question":"Meu lugar favorito na cidade é…","answer":"O miradouro da Graça ao pôr do sol."}]'::jsonb where id = '00000000-0000-4000-8000-000000000003';
update public.profiles set prompts = '[{"question":"A música que define meu momento é…","answer":"Qualquer coisa do BaianaSystem no último volume."},{"question":"Estou procurando alguém que…","answer":"Dance comigo mesmo sem saber dançar."}]'::jsonb where id = '00000000-0000-4000-8000-000000000007';
update public.profiles set prompts = '[{"question":"Uma viagem inesquecível foi…","answer":"O Réveillon em Copacabana! Quero voltar."}]'::jsonb where id = '00000000-0000-4000-8000-000000000014';

-- ---------------------------------------------------------------- LIMPEZA
-- delete from auth.users where email like 'demo%@kissly.dev';
-- drop trigger if exists swipes_demo_like_back on public.swipes;
-- drop function if exists public.demo_auto_like_back();
-- drop table if exists public.demo_like_back;

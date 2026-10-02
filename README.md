# Kissly 💘

App de relacionamento no estilo Tinder, para conhecer pessoas do seu **estado**, do **Brasil** e do **mundo**.
Feito com Expo (React Native) para iPhone, Android e web, e backend no Supabase.

## Rodando

```bash
npm install
npx expo start          # escaneie o QR Code com o Expo Go, ou aperte "w" para abrir no navegador
```

Sem configurar nada, o app abre em **modo demonstração**: contas salvas no aparelho, 16 perfis fictícios que
respondem no chat e compras simuladas. Isso permite testar tudo, inclusive os planos pagos.

Para usar de verdade, siga os guias:

| Guia | O que configura |
| ---- | --------------- |
| [supabase/README.md](supabase/README.md) | Banco, login, fotos, chat em tempo real, push e moderação |
| [docs/PAGAMENTOS.md](docs/PAGAMENTOS.md) | Planos Plus/Gold/Platinum, App Store, Google Play e RevenueCat |
| [docs/PUBLICACAO.md](docs/PUBLICACAO.md) | Builds, textos e exigências das lojas, checklist de lançamento |

## Recursos

- **Descobrir:** cards com gestos (Kiss, Nope, Super Like), alcance Estadual/Nacional/Internacional e filtros
  de idade, distância e gênero de interesse.
- **Match e chat** em tempo real, com "digitando", confirmação de leitura, sugestões de primeira mensagem,
  desfazer match e denúncia anônima.
- **Perfil:** cadastro em 10 etapas, até 6 fotos, interesses, localização por GPS e verificação por selfie.
- **Planos:** Free, Plus, Gold e Platinum, com limites validados no servidor, voltar perfil, ver quem curtiu,
  Kiss prioritário, Passaporte e Boost.
- **Notificações push** de match e mensagem, com preferências por pessoa.
- **Privacidade e segurança:** RLS em todas as tabelas, perfis de terceiros sem data de nascimento nem
  coordenadas, exclusão de conta, Termos, Política de Privacidade (LGPD) e Dicas de segurança.

## Estrutura

```
src/app/            telas (Expo Router: cada arquivo é uma rota)
src/components/     componentes visuais (cards, botões, sliders…)
src/services/       backend (Supabase / demonstração), pagamentos e push
src/state/          sessão, estado global e hooks de tela (baralho, chat…)
src/data/           catálogos: planos, cidades, interesses, textos legais, perfis de demonstração
src/theme/          design system (cores, fontes, espaçamentos)
supabase/           migrações SQL, Edge Functions, seed de demonstração e testes do banco
scripts/            utilitários (gerar ícones)
docs/               guias de pagamentos e publicação
```

## Verificações

```bash
npx tsc --noEmit        # tipos
npm run test:db         # regras do banco num Postgres embutido (PGlite)
npm run test:plan       # conversão RevenueCat → plano
npx expo-doctor         # saúde do projeto Expo
```

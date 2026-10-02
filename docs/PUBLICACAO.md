# Publicando o Kissly na App Store e no Google Play

Este guia vai do projeto pronto até o app nas lojas. Siga na ordem. Os passos marcados com ⚖️ têm
implicações legais: vale ter apoio de um advogado.

## 0. Antes de tudo

- [ ] Supabase configurado e com todas as migrações rodadas ([supabase/README.md](../supabase/README.md)).
- [ ] **Não** rode o `seed.sql` em produção. Se rodou para testar, execute o bloco **LIMPEZA** do fim dele.
- [ ] Confirmação de e-mail **ligada** e SMTP próprio configurado no Supabase.
- [ ] Pagamentos configurados ([PAGAMENTOS.md](PAGAMENTOS.md)).
- [ ] ⚖️ Empresa aberta (CNPJ). As lojas exibem o nome do vendedor, e os pagamentos caem na conta da empresa.
- [ ] ⚖️ Preencha `COMPANY` em [src/data/legal.ts](../src/data/legal.ts) (razão social, CNPJ, endereço, e-mails)
  e peça a um advogado para revisar os Termos e a Política de Privacidade.
- [ ] Publique os Termos e a Política também num site (ex.: `kissly.app/termos` e `kissly.app/privacidade`).
  As lojas pedem esses links no cadastro do app.

## 1. Conta Expo e projeto EAS

O EAS compila o app na nuvem, então você não precisa de Mac nem do Android Studio.

```bash
npx eas-cli@latest login        # crie a conta grátis em expo.dev
npx eas-cli@latest init         # cria o projeto e preenche extra.eas.projectId no app.json
```

O `projectId` também ativa as **notificações push**.

## 2. Testar num aparelho de verdade (development build)

Recursos como compras, notificações push no Android e câmera precisam do app instalado, não do Expo Go:

```bash
npx eas-cli@latest build --profile development --platform android
npx eas-cli@latest build --profile development --platform ios     # exige conta Apple Developer
```

Instale pelo link que o EAS gerar e rode `npx expo start --dev-client`.

**Roteiro de teste com duas contas, em dois aparelhos:**
1. Cadastro e onboarding completos, com fotos e localização pelo GPS.
2. As duas contas dão Kiss uma na outra → tela "É um Match!" e notificação push.
3. Conversar → mensagens chegam na hora, com "digitando…", "Lida" e notificação.
4. Assinar Gold com conta sandbox → Internacional, Passaporte, Boost e Curtidas liberados.
5. Verificação → aprovar no painel do Supabase (passo 5 do supabase/README) → selo azul.
6. Denunciar, desfazer match e excluir conta.

## 3. Gerar a versão de produção

```bash
npx eas-cli@latest build --profile production --platform all
```

O número da versão (build) aumenta sozinho a cada build de produção (`autoIncrement`).

## 4. Google Play

1. Em [play.google.com/console](https://play.google.com/console) (US$ 25, pagamento único), crie o app "Kissly".
2. **Classificação de conteúdo:** responda o questionário (app de relacionamento → maiores de 18).
3. **Público-alvo:** somente 18 anos ou mais.
4. **Segurança dos dados:** declare o que o app coleta (veja a tabela abaixo).
5. **Exclusão de conta:** informe que ela é feita no app (Perfil → Excluir conta) e dê um link web para pedidos.
6. **Política de apps de namoro:** o Google exige denúncia, bloqueio, moderação e verificação de idade. O
   Kissly já tem todos.
7. Envie o build: `npx eas-cli@latest submit --platform android` (o primeiro envio pode exigir upload manual do `.aab`).
8. Comece pela faixa de **teste interno** ou **fechado**. Contas novas de desenvolvedor pessoal precisam de
   12 testadores por 14 dias antes de publicar em produção.

## 5. App Store

1. Em [App Store Connect](https://appstoreconnect.apple.com), crie o app com o bundle `com.kissly.app`.
2. **Classificação etária:** 18+ (marque "Encontros / relacionamentos" e conteúdo gerado por usuários).
3. **Privacidade do app ("nutrition labels"):** declare os dados da tabela abaixo.
4. **Login com Apple:** como o app oferece login com Google, a Apple exige também o "Iniciar sessão com a
   Apple". Já está no app; ative o provedor no Supabase.
5. **Conta para revisão:** crie uma conta de teste **já com perfil completo** e informe e-mail e senha no
   campo "Sign-in information". Explique que é um app de namoro com chat entre adultos.
6. Envie: `npx eas-cli@latest submit --platform ios`.

## Dados declarados nas lojas

| Dado                    | Coletado | Ligado à pessoa | Finalidade                     |
| ----------------------- | :------: | :-------------: | ------------------------------ |
| E-mail                  | ✓        | ✓               | Conta                          |
| Nome, idade, gênero     | ✓        | ✓               | Funcionamento do app           |
| Fotos                   | ✓        | ✓               | Perfil e verificação           |
| Localização aproximada  | ✓        | ✓               | Mostrar pessoas próximas       |
| Mensagens               | ✓        | ✓               | Chat                           |
| Compras                 | ✓        | ✓               | Assinaturas                    |
| Identificador do aparelho (token push) | ✓ | ✓        | Notificações                   |
| Orientação/vida sexual (inferida)      | ✓ | ✓        | Funcionamento do app           |

Nenhum dado é usado para rastreamento de publicidade.

## Textos para a página da loja

**Nome:** Kissly: Namoro e Relacionamento

**Subtítulo (iOS, 30 caracteres):** Conheça gente do Brasil e mundo

**Descrição curta (Android, 80 caracteres):**
Dê Kiss, dê match e converse com pessoas do seu estado, do Brasil e do mundo.

**Descrição completa:**

> O Kissly é o app de relacionamento para quem quer conhecer pessoas de verdade, perto ou longe.
>
> 💘 **Deslize e dê Kiss.** Curtiu? Arraste para a direita. Se for recíproco, é match!
> 📍 **Você escolhe o alcance:** pessoas do seu estado, do Brasil inteiro ou do mundo todo.
> 💬 **Converse em tempo real**, com aviso de "digitando", confirmação de leitura e ideias para puxar assunto.
> ⭐ **Super Like:** mostre que você gostou muito, e apareça primeiro para essa pessoa.
> ✈️ **Passaporte:** vai viajar? Dê match antes de chegar.
> ⚡ **Boost:** seja um dos perfis mais vistos da sua região por 30 minutos.
> 🛡️ **Segurança em primeiro lugar:** perfis verificados por selfie, denúncia anônima e moderação.
>
> **Planos Kissly Plus, Gold e Platinum** com Kiss ilimitados, voltar perfis, ver quem curtiu você, modo
> Internacional e muito mais. A assinatura renova automaticamente e pode ser cancelada a qualquer momento nas
> configurações da loja.
>
> Exclusivo para maiores de 18 anos.

**Palavras-chave (iOS):** namoro,encontros,relacionamento,paquera,match,conhecer pessoas,chat,amor,solteiros

**Capturas de tela:** o iPhone de 6,9" e o Android pedem de 3 a 8 imagens. Sugestão: Descobrir, É um Match,
Chat, Planos, Passaporte e Verificação. Use o app com o `seed.sql` num projeto de teste para ter perfis bonitos
na tela.

## Depois do lançamento

- Revise **denúncias** (`reports`) e **verificações** (`verification_requests`) todos os dias.
- Acompanhe a receita e os cancelamentos no painel do RevenueCat.
- Atualizações só de JavaScript podem ir sem nova revisão das lojas com `npx eas-cli@latest update`.
  Mudanças nativas, como novas bibliotecas ou permissões, exigem um novo build.

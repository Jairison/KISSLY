# Planos e pagamentos do Kissly

## Os planos

|                                  | Free | Plus | Gold | Platinum |
| -------------------------------- | :--: | :--: | :--: | :------: |
| Kiss por dia                     |  50  |  ∞   |  ∞   |    ∞     |
| Super Likes por dia              |  1   |  3   |  5   |    10    |
| Voltar o último perfil passado   |      |  ✓   |  ✓   |    ✓     |
| Ver quem curtiu você             |      |      |  ✓   |    ✓     |
| Modo Internacional               |      |      |  ✓   |    ✓     |
| Kiss prioritário                 |      |      |      |    ✓     |
| Boosts grátis por mês (Parte 6)  |      |      |  1   |    3     |

Os limites reiniciam à meia-noite de Brasília e são validados **no servidor** (função `plan_limits` em
`supabase/migrations/20261003000000_plans.sql`). Mudar os números exige editar essa função e
`src/data/plans.ts`.

**Preços sugeridos** (você define os valores finais nas lojas):

|          | 1 mês     | 6 meses    | 12 meses   |
| -------- | --------- | ---------- | ---------- |
| Plus     | R$ 29,90  | R$ 119,40  | R$ 179,90  |
| Gold     | R$ 49,90  | R$ 209,40  | R$ 299,90  |
| Platinum | R$ 79,90  | R$ 329,40  | R$ 479,90  |

## Como o dinheiro chega até você

```
App (tela de planos) → App Store / Google Play cobram → RevenueCat confirma
      → Edge Function grava o plano no Supabase → recursos liberados no servidor
```

A Apple e o Google **exigem** que assinaturas digitais sejam vendidas pela compra dentro do app. Eles ficam
com 15% no primeiro ano para quem fatura até US$ 1 milhão por ano (Small Business Program); acima disso, 30%.
O RevenueCat é gratuito até US$ 2.500 de receita mensal.

## Passo a passo

### 1. Contas de desenvolvedor

- **Apple Developer Program**: US$ 99 por ano. Em App Store Connect → Business, preencha os acordos,
  os impostos e a conta bancária.
- **Google Play Console**: US$ 25, pagamento único. Em Monetização, configure o perfil de pagamentos.

### 2. Criar as assinaturas nas lojas

Crie **um grupo de assinaturas** com 9 produtos (3 planos × 3 durações). Sugestão de IDs:

```
kissly_plus_monthly      kissly_plus_6m      kissly_plus_annual
kissly_gold_monthly      kissly_gold_6m      kissly_gold_annual
kissly_platinum_monthly  kissly_platinum_6m  kissly_platinum_annual
```

Na Apple, coloque os três planos no **mesmo grupo**, ordenados Platinum > Gold > Plus, para que upgrade e
downgrade funcionem automaticamente.

### 3. Configurar o RevenueCat

1. Crie uma conta em [revenuecat.com](https://www.revenuecat.com) e um projeto "Kissly". Conecte o app iOS e o
   app Android, seguindo as instruções do painel.
2. **Entitlements** (direitos): crie exatamente `plus`, `gold` e `platinum`, e associe a cada um os 3
   produtos daquele plano.
3. **Offerings**: crie três, com os identificadores `plus`, `gold` e `platinum`. Em cada uma, adicione os
   pacotes **Monthly**, **Six Month** e **Annual** com os produtos correspondentes.
4. Em **Project settings → API keys**, copie as chaves públicas e coloque no `.env`:
   ```
   EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_...
   EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=goog_...
   ```
5. Copie também a **Secret API key** (`sk_...`). Ela vai **só no servidor**, no passo 4.

### 4. Publicar as funções no Supabase

Instale a [CLI do Supabase](https://supabase.com/docs/guides/cli) e, na pasta do projeto, rode:

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase secrets set REVENUECAT_SECRET_API_KEY=sk_... REVENUECAT_WEBHOOK_AUTH="uma-senha-longa-que-voce-inventar"
npx supabase functions deploy revenuecat-webhook --no-verify-jwt
npx supabase functions deploy sync-subscription
```

O `SEU_PROJECT_REF` é o trecho `xxxx` de `https://xxxx.supabase.co`.

### 5. Ligar o webhook

No RevenueCat, abra **Integrations → Webhooks → Add**:
- **URL:** `https://SEU_PROJECT_REF.supabase.co/functions/v1/revenuecat-webhook`
- **Authorization header value:** a mesma senha usada em `REVENUECAT_WEBHOOK_AUTH`.

Clique em **Send test event**. A resposta deve ser `200`.

### 6. Testar compras

Compras reais **não funcionam no Expo Go**: lá o RevenueCat roda em modo de prévia. Gere um development build:

```bash
npx eas-cli@latest build --profile development --platform android   # ou ios
```

Teste com contas de teste: **Sandbox** na Apple e **License testers** no Google Play. As renovações são
aceleradas e nada é cobrado.

## Os três modos do app

| Situação                                    | O que a tela de planos faz                         |
| ------------------------------------------- | -------------------------------------------------- |
| Sem Supabase (modo demonstração)            | Compra **simulada**, salva no aparelho             |
| Supabase ligado, sem chaves do RevenueCat   | Mostra os preços, mas não deixa comprar            |
| Supabase + RevenueCat, no celular           | Assinatura real pela App Store / Google Play       |
| Navegador (web)                             | Mostra os preços e pede para assinar pelo celular  |

## Exigências das lojas (já atendidas na tela)

- Preço, duração e renovação automática visíveis antes da compra.
- Texto sobre cancelamento até 24 h antes da renovação.
- Botão **Restaurar compras**.
- Atalho para **gerenciar ou cancelar** a assinatura (Perfil → Gerenciar assinatura).
- **Pendente para a Parte 6:** links reais para os Termos de Uso e a Política de Privacidade.

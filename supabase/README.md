# Conectando o Kissly ao Supabase

Enquanto o Supabase não estiver configurado, o app roda em **modo demonstração**: tudo fica salvo só no
aparelho e os perfis são fictícios. Siga os passos abaixo para ativar contas reais, fotos na nuvem e
matches entre pessoas de verdade. Leva uns 10 minutos.

## 1. Criar o projeto

1. Crie uma conta gratuita em [supabase.com](https://supabase.com) e clique em **New project**.
2. Dê o nome `kissly`, crie uma senha forte para o banco (guarde-a) e escolha a região
   **South America (São Paulo)**, que fica mais perto dos seus usuários.
3. Aguarde 1 ou 2 minutos até o projeto ficar pronto.

## 2. Criar as tabelas

1. No menu lateral, abra **SQL Editor** e clique em **New query**.
2. Copie todo o conteúdo de [`migrations/20261001000000_init.sql`](migrations/20261001000000_init.sql),
   cole no editor e clique em **Run**. Deve aparecer `Success. No rows returned`.

Isso cria os perfis, as preferências, os planos, os swipes e os matches, com as regras de segurança
(Row Level Security) e o espaço para as fotos.

### Opcional: perfis de demonstração

Para testar sem precisar de outras pessoas reais, rode também [`seed.sql`](seed.sql) numa nova query.
Ele cria 16 perfis fictícios. Estes **curtem de volta** quem der Kiss neles, então geram match na hora:
Isabela, Sofia, Thiago, Luana, Pedro, Beatriz, Mariana, Amara e Marco.

No fim do arquivo há um bloco **LIMPEZA** para apagar tudo antes de lançar o app.

## 3. Ligar o app ao projeto

1. Abra **Project Settings → API Keys** e copie:
   - a **Project URL** (`https://xxxx.supabase.co`), que também aparece em **Project Settings → Data API**;
   - a **Publishable key** (começa com `sb_publishable_`).
2. Na pasta do projeto, copie `.env.example` para um arquivo novo chamado `.env` e cole os valores:

   ```
   EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxx
   ```

3. Reinicie o app **limpando o cache**, senão as variáveis novas não são lidas:

   ```
   npx expo start --clear
   ```

   O selo "Modo demonstração" some da tela de boas-vindas quando a conexão está ativa.

> ⚠️ Nunca coloque a **Secret key** (`sb_secret_...`) no app nem no `.env`. Ela dá acesso total ao banco e
> só deve ser usada em servidores.

## 4. Configurar o login

Em **Authentication → URL Configuration**, adicione em **Redirect URLs**:

```
kissly://**
exp://**
http://localhost:8081/**
```

Esses endereços são usados pelo link de confirmação de e-mail, pela recuperação de senha e pelo login com
Google e Apple. `exp://**` serve para testar no Expo Go.

**Confirmação de e-mail:** vem ligada por padrão, ou seja, o usuário precisa clicar no link do e-mail antes
do primeiro login. Para agilizar os testes, você pode desligar em
**Authentication → Sign In / Providers → Email → Confirm email**. Religue antes de lançar o app.

**E-mails em produção:** o servidor de e-mail grátis do Supabase envia poucos e-mails por hora. Antes de
lançar, configure um SMTP próprio (Resend, SendGrid, Amazon SES…) em **Authentication → Emails → SMTP Settings**.

## 5. Login com Google e Apple (pode ficar para depois)

- **Google:** crie um "OAuth Client ID" do tipo *Web application* no
  [Google Cloud Console](https://console.cloud.google.com/apis/credentials). Use como *Authorized redirect URI*
  o endereço que o Supabase mostra em **Authentication → Sign In / Providers → Google**. Depois cole lá o
  Client ID e o Client Secret.
- **Apple:** exige uma conta no Apple Developer Program (US$ 99 por ano). O passo a passo está em
  **Authentication → Sign In / Providers → Apple**.

Enquanto um provedor não estiver ativado, o botão correspondente mostra um aviso de erro no app.

## Como os dados ficam protegidos

- Cada pessoa só lê e edita o **próprio** perfil. Perfis de outras pessoas chegam ao app apenas pelas
  funções do servidor, que mostram a **idade** (nunca a data de nascimento) e a **distância** (nunca as
  coordenadas).
- Swipes e matches são gravados só pelo servidor. Ninguém consegue fabricar um match nem descobrir quem
  curtiu sem ter o plano Gold.
- O plano de cada pessoa fica numa tabela que o app não consegue alterar. Na Parte 5, ela será atualizada
  pelo sistema de pagamentos.
- Cada pessoa só envia e apaga fotos na própria pasta.
- **Excluir conta** (no Perfil) apaga as fotos, o perfil, os matches e o login. A App Store e o Google Play
  exigem essa opção.

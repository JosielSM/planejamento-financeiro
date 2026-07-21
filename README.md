# Planejamento Financeiro

Sistema para acompanhar ganhos diarios, despesas mensais fixas e gastos do dia a dia, com meta diaria de ganhos e suporte a PostgreSQL.

## Funcionalidades

- Registra ganhos, despesas do dia, despesas eventuais e despesas mensais fixas.
- Mostra ganhos, gastos, saldo e media diaria do mes escolhido.
- Permite editar uma meta diaria de ganhos.
- Mostra uma barra de progresso da meta com base nos ganhos de hoje.
- Permite criar metas para comprar ou realizar algo, como TV, celular, viagem ou reserva.
- Registra depositos em cada meta e mostra quanto falta para completar.
- Mantem despesas mensais fixas nos meses seguintes automaticamente.
- Mostra o resumo de despesas por categoria.
- Salva no PostgreSQL quando `DATABASE_URL` esta configurado.
- Usa Firebase Authentication para login com Google ou email/senha, verificacao de email e recuperacao de senha.
- Mantem os dados financeiros separados por usuario no PostgreSQL/Neon.
- Permite exportar e importar um arquivo `.json` com registros e configuracoes.

## Rodar localmente

Instale as dependencias:

```powershell
npm install
```

Crie um arquivo `.env` baseado no `.env.example` e configure PostgreSQL e Firebase.

Rode o sistema:

```powershell
npm start
```

Depois acesse:

```text
http://127.0.0.1:5500
```

## Estrutura do projeto

```text
public/
  css/                 Estilos separados por area da interface
  js/                  Modulos do navegador em ordem de carregamento
src/
  server.mjs           Servidor, seguranca e API
  views/
    auth/              Login, cadastro e verificacao
    screens/           Painel, metas, movimentacoes e registros
    modals/             Formularios e dialogos sobrepostos
    partials/           Cabecalho e dependencias compartilhadas
scripts/                Utilitarios administrativos
schema.sql              Referencia do banco PostgreSQL
```

O servidor monta a pagina a partir das telas em `src/views`. Dessa forma, cada funcionalidade pode ser mantida separadamente sem duplicar a estrutura principal da aplicacao.

## Banco PostgreSQL

O servidor cria as tabelas automaticamente ao iniciar. O arquivo `schema.sql` tambem fica no projeto como referencia.

Variavel obrigatoria para salvar online:

```text
DATABASE_URL=postgres://usuario:senha@host:5432/banco
```

## Firebase Authentication

1. Crie um projeto no [console do Firebase](https://console.firebase.google.com/).
2. Em **Authentication > Sign-in method**, ative **Email/Password** e **Google**. No provedor Google, selecione o email de suporte do projeto.
3. Em **Authentication > Settings > Authorized domains**, adicione o dominio da aplicacao publicada.
4. Nas configuracoes do projeto, crie um aplicativo Web e copie `apiKey`, `authDomain`, `projectId` e `appId`.
5. Em **Project settings > Service accounts**, gere as credenciais usadas somente pelo servidor.

Configure estas variaveis sem salvar credenciais reais no Git:

```text
FIREBASE_PROJECT_ID=seu-projeto-firebase
FIREBASE_API_KEY=sua-chave-publica-web
FIREBASE_AUTH_DOMAIN=seu-projeto-firebase.firebaseapp.com
FIREBASE_APP_ID=seu-app-id-web
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@seu-projeto-firebase.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

`FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID` e `FIREBASE_APP_ID` identificam o aplicativo Web e podem ser enviados ao navegador. `FIREBASE_CLIENT_EMAIL` e `FIREBASE_PRIVATE_KEY` sao credenciais administrativas e devem existir somente nas variaveis protegidas do servidor.

O servidor libera dados somente para tokens Firebase validos e contas com email confirmado. A primeira requisicao autenticada associa o `firebase_uid` ao usuario correspondente no Neon.

### Migrar usuarios existentes

O script abaixo importa os hashes bcrypt atuais para o Firebase sem conhecer ou expor as senhas. Primeiro execute a simulacao:

```powershell
npm run migrate:firebase-users
```

Depois de revisar o resultado, confirme uma unica vez:

```powershell
npm run migrate:firebase-users -- --apply
```

O script ignora contas ja vinculadas, evita duplicar emails existentes no Firebase, atualiza `users.firebase_uid` no Neon e remove do Neon o hash antigo depois de confirmar a importacao. Os usuarios importados usam a senha atual e devem confirmar o email no primeiro acesso.

## Subir online

Opcoes simples:

- Render: crie um Web Service para este repositorio e um PostgreSQL Database.
- Railway: crie um projeto Node.js e adicione um PostgreSQL.

Configure no painel da plataforma:

```text
Build Command: npm install
Start Command: npm start
Environment: DATABASE_URL e todas as variaveis FIREBASE_ listadas acima
```

Quando publicar, a plataforma vai gerar um link publico para acessar o sistema.

# Planejamento Financeiro

Aplicação web para controle financeiro pessoal, com autenticação individual, movimentações, metas de economia, análises mensais e exportação de relatórios.

## Principais recursos

- Login com Google ou e-mail e senha pelo Firebase Authentication.
- Separação completa dos dados de cada usuário.
- Registro de ganhos e despesas diárias, mensais fixas ou eventuais.
- Resumo mensal de ganhos, despesas, saldo e médias diárias.
- Meta diária de ganhos.
- Metas financeiras com depósitos, progresso e histórico de conclusões.
- Categorias padrão e categorias personalizadas.
- Análise das despesas por categoria.
- Exportação de relatórios em PDF e Excel.
- Tema claro e escuro.
- Feedback temporário para ações concluídas e falhas de sincronização.
- Aplicativo Android nativo com Capacitor, interface empacotada e abertura independente do servidor.
- PWA instalável no iPhone pelo Safari, com ícone, tela de abertura e cache do aplicativo.
- Botão adaptável: baixa o APK no Android e ensina a instalação na Tela de Início no iPhone.
- Verificação de versão no Android, com aviso e download quando existe um APK mais recente.
- Download direto do APK pelo botão “Baixar para Android” no site.
- Cache local separado por usuário e fila de sincronização automática para alterações feitas sem conexão.
- Persistência no PostgreSQL/Neon por meio de uma API Express executada em Cloudflare Workers.
- Hyperdrive entre a Cloudflare e o Neon para conexões PostgreSQL estáveis e eficientes.
- Hospedagem principal na Cloudflare, sem hibernação do antigo servidor gratuito do Render.

## Documentação completa

Consulte [DOCUMENTAÇÃO.md](DOCUMENTAÇÃO.md) para conhecer detalhadamente a arquitetura, cada tela, os fluxos de autenticação, as regras financeiras, o banco de dados, todos os endpoints, a organização dos arquivos, a segurança, a implantação e os procedimentos de manutenção.

Para assinatura, versionamento, Firebase Android e Play Store, consulte [RELEASE_ANDROID.md](RELEASE_ANDROID.md).

## Início rápido

Requisitos:

- Node.js 22 ou superior.
- PostgreSQL local ou banco Neon.
- Projeto no Firebase com os provedores E-mail/Senha e Google habilitados.

Instale as dependências:

```powershell
npm install
```

Use `.env.example` como referência e disponibilize as variáveis no ambiente do processo. O servidor atual não carrega `.env` automaticamente. Depois execute:

```powershell
npm start
```

Acesse `http://127.0.0.1:5500`.

## Comandos

| Comando | Finalidade |
|---|---|
| `npm start` | Inicia o servidor principal. |
| `npm run dev` | Inicia o mesmo servidor para desenvolvimento local. |
| `npm run dev:cloudflare` | Gera os arquivos estáticos e inicia o Worker local. |
| `npm run cloudflare:types` | Atualiza os tipos dos bindings declarados no Wrangler. |
| `npm run deploy:cloudflare:check` | Valida o pacote Cloudflare sem publicar. |
| `npm run deploy:cloudflare` | Gera os arquivos e publica o Worker. |
| `npm run build:mobile` | Gera a interface estática do aplicativo em `dist/`. |
| `npm run cap:sync` | Gera a interface e sincroniza o projeto Android. |
| `npm run cap:open` | Abre o projeto no Android Studio. |
| `npm run test:offline` | Valida isolamento do cache por usuário e reenvio da fila offline. |
| `npm test` | Executa os testes offline, de segurança e de sintaxe. |
| `npm run android:debug` | Gera um APK de desenvolvimento para testes. |
| `npm run android:release` | Testa e gera APK/AAB assinados; exige credenciais externas. |
| `npm run migrate:firebase-users` | Simula a migração de usuários antigos para o Firebase. |
| `npm run migrate:firebase-users -- --apply` | Executa a migração após a revisão da simulação. |

## Estrutura resumida

```text
public/                 CSS, JavaScript e ícones compartilhados pelo site e aplicativo
android/                Projeto Android nativo gerado pelo Capacitor
capacitor.config.json   Identidade e configuração do aplicativo Android
dist/                   Build móvel gerado; não é versionado
src/server.mjs          Servidor Express, API e migrações automáticas
worker/index.mjs        Entrada Cloudflare Worker e roteamento de API/assets
src/views/              Telas, modais e partes HTML
scripts/                Utilitários administrativos
schema.sql              Esquema de referência do PostgreSQL
wrangler.jsonc          Configuração do Worker, assets e Hyperdrive
render.yaml             Configuração legada usada como opção temporária de retorno
.env.example            Modelo das variáveis de ambiente
.dev.vars.example       Modelo dos segredos para desenvolvimento local do Worker
```

## Segurança

Nunca envie `.env`, `.dev.vars`, credenciais administrativas do Firebase ou a conexão real do Neon ao GitHub. Os segredos de produção ficam criptografados na Cloudflare; o Worker recebe o PostgreSQL exclusivamente pelo binding Hyperdrive.

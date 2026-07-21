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
- Instalação como PWA pelo botão “Instalar app”, com suporte a Android, iPhone, iPad e computadores compatíveis.
- Persistência no PostgreSQL/Neon por meio de uma API Express.
- Hospedagem preparada para o Render.

## Documentação completa

Consulte [DOCUMENTAÇÃO.md](DOCUMENTAÇÃO.md) para conhecer detalhadamente a arquitetura, cada tela, os fluxos de autenticação, as regras financeiras, o banco de dados, todos os endpoints, a organização dos arquivos, a segurança, a implantação e os procedimentos de manutenção.

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
| `npm run migrate:firebase-users` | Simula a migração de usuários antigos para o Firebase. |
| `npm run migrate:firebase-users -- --apply` | Executa a migração após a revisão da simulação. |

## Estrutura resumida

```text
public/                 CSS, JavaScript, PWA e ícones enviados ao navegador
src/server.mjs          Servidor Express, API e migrações automáticas
src/views/              Telas, modais e partes HTML
scripts/                Utilitários administrativos
schema.sql              Esquema de referência do PostgreSQL
render.yaml             Configuração de implantação no Render
.env.example            Modelo das variáveis de ambiente
```

## Segurança

Nunca envie `.env`, credenciais administrativas do Firebase ou a conexão real do Neon ao GitHub. As chaves privadas devem existir somente nas variáveis protegidas do ambiente local ou do Render.

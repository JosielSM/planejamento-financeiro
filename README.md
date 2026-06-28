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
- Usa `localStorage` como fallback enquanto o banco ainda nao estiver configurado.
- Permite exportar e importar um arquivo `.json` com registros e configuracoes.

## Rodar localmente

Instale as dependencias:

```powershell
npm install
```

Crie um arquivo `.env` baseado no `.env.example` se quiser usar PostgreSQL local.

Rode o sistema:

```powershell
npm start
```

Depois acesse:

```text
http://127.0.0.1:5500
```

## Banco PostgreSQL

O servidor cria as tabelas automaticamente ao iniciar. O arquivo `schema.sql` tambem fica no projeto como referencia.

Variavel obrigatoria para salvar online:

```text
DATABASE_URL=postgres://usuario:senha@host:5432/banco
```

## Subir online

Opcoes simples:

- Render: crie um Web Service para este repositorio e um PostgreSQL Database.
- Railway: crie um projeto Node.js e adicione um PostgreSQL.

Configure no painel da plataforma:

```text
Build Command: npm install
Start Command: npm start
Environment: DATABASE_URL=<url do postgres>
```

Quando publicar, a plataforma vai gerar um link publico para acessar o sistema.

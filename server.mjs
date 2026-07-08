import express from "express";
import pg from "pg";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 5500);
const databaseUrl = process.env.DATABASE_URL;

const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    })
  : null;

app.use(express.json());
app.use(express.static(__dirname, {
  extensions: ["html"],
  setHeaders(response) {
    response.setHeader("Cache-Control", "no-store");
  },
}));

function requireDatabase(response) {
  if (pool) return true;
  response.status(503).json({ error: "DATABASE_URL nao configurado" });
  return false;
}

async function migrate() {
  if (!pool) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id UUID PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
      description TEXT NOT NULL,
      amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
      date DATE NOT NULL,
      category TEXT NOT NULL,
      frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'monthly', 'occasional')),
      note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS savings_goals (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      target_amount NUMERIC(12, 2) NOT NULL CHECK (target_amount > 0),
      note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS savings_deposits (
      id UUID PRIMARY KEY,
      goal_id UUID NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
      amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
      date DATE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

function mapTransaction(row) {
  return {
    id: row.id,
    type: row.type,
    description: row.description,
    amount: Number(row.amount),
    date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date).slice(0, 10),
    category: row.category,
    frequency: row.frequency,
    note: row.note || "",
  };
}

function mapSavingsGoal(row) {
  return {
    id: row.id,
    name: row.name,
    targetAmount: Number(row.target_amount),
    savedAmount: Number(row.saved_amount || 0),
    note: row.note || "",
    deposits: row.deposits || [],
  };
}

async function findSavingsGoal(id) {
  const result = await pool.query(
    `SELECT
      goal.id,
      goal.name,
      goal.target_amount,
      goal.note,
      COALESCE(SUM(deposit.amount), 0) AS saved_amount,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', deposit.id,
            'amount', deposit.amount,
            'date', deposit.date
          )
          ORDER BY deposit.date DESC, deposit.created_at DESC
        ) FILTER (WHERE deposit.id IS NOT NULL),
        '[]'
      ) AS deposits
    FROM savings_goals goal
    LEFT JOIN savings_deposits deposit ON deposit.goal_id = goal.id
    WHERE goal.id = $1
    GROUP BY goal.id`,
    [id],
  );

  return result.rows[0] ? mapSavingsGoal(result.rows[0]) : null;
}

app.get("/api/health", async (_request, response) => {
  if (!pool) {
    response.json({ ok: true, database: "not_configured" });
    return;
  }

  await pool.query("SELECT 1");
  response.json({ ok: true, database: "connected" });
});

app.get("/api/transactions", async (_request, response) => {
  if (!requireDatabase(response)) return;
  const result = await pool.query("SELECT * FROM transactions ORDER BY date DESC, created_at DESC");
  response.json(result.rows.map(mapTransaction));
});

app.post("/api/transactions", async (request, response) => {
  if (!requireDatabase(response)) return;
  const { id, type, description, amount, date, category, frequency, note = "" } = request.body;

  if (!id || !type || !description || !amount || !date || !category || !frequency) {
    response.status(400).json({ error: "Campos obrigatorios faltando" });
    return;
  }

  const result = await pool.query(
    `INSERT INTO transactions (id, type, description, amount, date, category, frequency, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [id, type, description, amount, date, category, frequency, note],
  );

  response.status(201).json(mapTransaction(result.rows[0]));
});

app.delete("/api/transactions/:id", async (request, response) => {
  if (!requireDatabase(response)) return;
  await pool.query("DELETE FROM transactions WHERE id = $1", [request.params.id]);
  response.status(204).end();
});

app.get("/api/savings-goals", async (_request, response) => {
  if (!requireDatabase(response)) return;
  const result = await pool.query(`
    SELECT
      goal.id,
      goal.name,
      goal.target_amount,
      goal.note,
      COALESCE(SUM(deposit.amount), 0) AS saved_amount,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', deposit.id,
            'amount', deposit.amount,
            'date', deposit.date
          )
          ORDER BY deposit.date DESC, deposit.created_at DESC
        ) FILTER (WHERE deposit.id IS NOT NULL),
        '[]'
      ) AS deposits
    FROM savings_goals goal
    LEFT JOIN savings_deposits deposit ON deposit.goal_id = goal.id
    GROUP BY goal.id
    ORDER BY goal.created_at DESC
  `);
  response.json(result.rows.map(mapSavingsGoal));
});

app.post("/api/savings-goals", async (request, response) => {
  if (!requireDatabase(response)) return;
  const { id, name, targetAmount, note = "" } = request.body;

  if (!id || !name || !targetAmount) {
    response.status(400).json({ error: "Campos obrigatorios faltando" });
    return;
  }

  const result = await pool.query(
    `INSERT INTO savings_goals (id, name, target_amount, note)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, target_amount, note, 0 AS saved_amount, '[]'::json AS deposits`,
    [id, name, targetAmount, note],
  );

  response.status(201).json(mapSavingsGoal(result.rows[0]));
});

app.put("/api/savings-goals/:id", async (request, response) => {
  if (!requireDatabase(response)) return;
  const { name, targetAmount, note = "" } = request.body;

  if (!name || !targetAmount) {
    response.status(400).json({ error: "Campos obrigatorios faltando" });
    return;
  }

  const result = await pool.query(
    `UPDATE savings_goals
     SET name = $1, target_amount = $2, note = $3
     WHERE id = $4
     RETURNING id`,
    [name, targetAmount, note, request.params.id],
  );

  if (!result.rowCount) {
    response.status(404).json({ error: "Meta nao encontrada" });
    return;
  }

  response.json(await findSavingsGoal(request.params.id));
});

app.post("/api/savings-goals/:id/deposits", async (request, response) => {
  if (!requireDatabase(response)) return;
  const { id, amount, date } = request.body;

  if (!id || !amount || !date) {
    response.status(400).json({ error: "Campos obrigatorios faltando" });
    return;
  }

  await pool.query(
    `INSERT INTO savings_deposits (id, goal_id, amount, date)
     VALUES ($1, $2, $3, $4)`,
    [id, request.params.id, amount, date],
  );

  const result = await pool.query(
    `SELECT
      goal.id,
      goal.name,
      goal.target_amount,
      goal.note,
      COALESCE(SUM(deposit.amount), 0) AS saved_amount,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', deposit.id,
            'amount', deposit.amount,
            'date', deposit.date
          )
          ORDER BY deposit.date DESC, deposit.created_at DESC
        ) FILTER (WHERE deposit.id IS NOT NULL),
        '[]'
      ) AS deposits
    FROM savings_goals goal
    LEFT JOIN savings_deposits deposit ON deposit.goal_id = goal.id
    WHERE goal.id = $1
    GROUP BY goal.id`,
    [request.params.id],
  );

  response.status(201).json(mapSavingsGoal(result.rows[0]));
});

app.delete("/api/savings-goals/:id", async (request, response) => {
  if (!requireDatabase(response)) return;
  await pool.query("DELETE FROM savings_goals WHERE id = $1", [request.params.id]);
  response.status(204).end();
});

app.get("/api/settings", async (_request, response) => {
  if (!requireDatabase(response)) return;
  const result = await pool.query("SELECT key, value FROM settings");
  response.json(Object.fromEntries(result.rows.map((row) => [row.key, row.value])));
});

app.put("/api/settings/:key", async (request, response) => {
  if (!requireDatabase(response)) return;
  const value = String(request.body.value ?? "");
  const result = await pool.query(
    `INSERT INTO settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key)
     DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
     RETURNING key, value`,
    [request.params.key, value],
  );
  response.json(result.rows[0]);
});

app.get("*", (_request, response) => {
  response.sendFile(join(__dirname, "index.html"));
});

migrate()
  .then(() => {
    app.listen(port, "0.0.0.0", () => {
      console.log(`Planejamento Financeiro em http://127.0.0.1:${port}`);
    });
  })
  .catch((error) => {
    console.error("Erro ao iniciar banco de dados:", error);
    process.exit(1);
  });

import express from "express";
import bcrypt from "bcryptjs";
import pg from "pg";
import crypto from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 5500);
const databaseUrl = process.env.DATABASE_URL;
const sessionSecret = process.env.SESSION_SECRET || "planejamento-financeiro-dev-secret";
const sessionCookieName = "pf_session";

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

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function sign(value) {
  return crypto.createHmac("sha256", sessionSecret).update(value).digest("base64url");
}

function createSessionToken(user) {
  const payload = base64url(JSON.stringify({
    id: user.id,
    email: user.email,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 30,
  }));
  return `${payload}.${sign(payload)}`;
}

function parseCookies(request) {
  return Object.fromEntries(
    String(request.headers.cookie || "")
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const index = item.indexOf("=");
        return [item.slice(0, index), decodeURIComponent(item.slice(index + 1))];
      }),
  );
}

function readSession(request) {
  const token = parseCookies(request)[sessionCookieName];
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || sign(payload) !== signature) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!session.id || Date.now() > session.exp) return null;
    return session;
  } catch {
    return null;
  }
}

function setSessionCookie(response, user) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.setHeader(
    "Set-Cookie",
    `${sessionCookieName}=${encodeURIComponent(createSessionToken(user))}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 30}${secure}`,
  );
}

function clearSessionCookie(response) {
  response.setHeader("Set-Cookie", `${sessionCookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

function requireDatabase(response) {
  if (pool) return true;
  response.status(503).json({ error: "DATABASE_URL nao configurado" });
  return false;
}

async function migrate() {
  if (!pool) return;

  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

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

  await pool.query(`ALTER TABLE settings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;`);
  await pool.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;`);
  await pool.query(`ALTER TABLE savings_goals ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;`);

  await pool.query(`
    DO $$
    DECLARE constraint_name TEXT;
    BEGIN
      SELECT conname INTO constraint_name
      FROM pg_constraint
      WHERE conrelid = 'settings'::regclass AND contype = 'p';

      IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE settings DROP CONSTRAINT %I', constraint_name);
      END IF;
    END $$;
  `);

  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS settings_user_key_idx ON settings(user_id, key);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS transactions_user_id_idx ON transactions(user_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS savings_goals_user_id_idx ON savings_goals(user_id);`);
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

function mapUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
  };
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function claimLegacyData(userId) {
  await pool.query("UPDATE transactions SET user_id = $1 WHERE user_id IS NULL", [userId]);
  await pool.query("UPDATE savings_goals SET user_id = $1 WHERE user_id IS NULL", [userId]);
  await pool.query("UPDATE settings SET user_id = $1 WHERE user_id IS NULL", [userId]);
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

async function requireAuth(request, response) {
  if (!requireDatabase(response)) return null;
  const session = readSession(request);
  if (!session) {
    response.status(401).json({ error: "Login necessario" });
    return null;
  }

  const result = await pool.query("SELECT id, name, email FROM users WHERE id = $1", [session.id]);
  if (!result.rows[0]) {
    clearSessionCookie(response);
    response.status(401).json({ error: "Login necessario" });
    return null;
  }
  return result.rows[0];
}

async function findSavingsGoal(id, userId) {
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
    WHERE goal.id = $1 AND goal.user_id = $2
    GROUP BY goal.id`,
    [id, userId],
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

app.get("/api/auth/me", async (request, response) => {
  const user = await requireAuth(request, response);
  if (!user) return;
  response.json({ user: mapUser(user) });
});

app.post("/api/auth/signup", async (request, response) => {
  if (!requireDatabase(response)) return;
  const name = String(request.body.name || "").trim();
  const email = normalizeEmail(request.body.email);
  const password = String(request.body.password || "");

  if (!name || !email || password.length < 6) {
    response.status(400).json({ error: "Informe nome, email e uma senha com pelo menos 6 caracteres" });
    return;
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email`,
      [name, email, passwordHash],
    );
    const user = result.rows[0];
    const count = await pool.query("SELECT COUNT(*)::int AS count FROM users");
    if (count.rows[0].count === 1) {
      await claimLegacyData(user.id);
    }
    setSessionCookie(response, user);
    response.status(201).json({ user: mapUser(user) });
  } catch (error) {
    if (error.code === "23505") {
      response.status(409).json({ error: "Esse email ja esta cadastrado" });
      return;
    }
    throw error;
  }
});

app.post("/api/auth/login", async (request, response) => {
  if (!requireDatabase(response)) return;
  const email = normalizeEmail(request.body.email);
  const password = String(request.body.password || "");
  const result = await pool.query("SELECT id, name, email, password_hash FROM users WHERE email = $1", [email]);
  const user = result.rows[0];

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    response.status(401).json({ error: "Email ou senha invalidos" });
    return;
  }

  setSessionCookie(response, user);
  response.json({ user: mapUser(user) });
});

app.post("/api/auth/logout", (_request, response) => {
  clearSessionCookie(response);
  response.status(204).end();
});

app.get("/api/transactions", async (request, response) => {
  const user = await requireAuth(request, response);
  if (!user) return;
  const result = await pool.query("SELECT * FROM transactions WHERE user_id = $1 ORDER BY date DESC, created_at DESC", [user.id]);
  response.json(result.rows.map(mapTransaction));
});

app.post("/api/transactions", async (request, response) => {
  const user = await requireAuth(request, response);
  if (!user) return;
  const { id, type, description, amount, date, category, frequency, note = "" } = request.body;

  if (!id || !type || !description || !amount || !date || !category || !frequency) {
    response.status(400).json({ error: "Campos obrigatorios faltando" });
    return;
  }

  const result = await pool.query(
    `INSERT INTO transactions (id, user_id, type, description, amount, date, category, frequency, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [id, user.id, type, description, amount, date, category, frequency, note],
  );

  response.status(201).json(mapTransaction(result.rows[0]));
});

app.delete("/api/transactions/:id", async (request, response) => {
  const user = await requireAuth(request, response);
  if (!user) return;
  await pool.query("DELETE FROM transactions WHERE id = $1 AND user_id = $2", [request.params.id, user.id]);
  response.status(204).end();
});

app.get("/api/savings-goals", async (request, response) => {
  const user = await requireAuth(request, response);
  if (!user) return;
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
    WHERE goal.user_id = $1
    GROUP BY goal.id
    ORDER BY goal.created_at DESC
  `, [user.id]);
  response.json(result.rows.map(mapSavingsGoal));
});

app.post("/api/savings-goals", async (request, response) => {
  const user = await requireAuth(request, response);
  if (!user) return;
  const { id, name, targetAmount, note = "" } = request.body;

  if (!id || !name || !targetAmount) {
    response.status(400).json({ error: "Campos obrigatorios faltando" });
    return;
  }

  const result = await pool.query(
    `INSERT INTO savings_goals (id, user_id, name, target_amount, note)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, target_amount, note, 0 AS saved_amount, '[]'::json AS deposits`,
    [id, user.id, name, targetAmount, note],
  );

  response.status(201).json(mapSavingsGoal(result.rows[0]));
});

app.put("/api/savings-goals/:id", async (request, response) => {
  const user = await requireAuth(request, response);
  if (!user) return;
  const { name, targetAmount, note = "" } = request.body;

  if (!name || !targetAmount) {
    response.status(400).json({ error: "Campos obrigatorios faltando" });
    return;
  }

  const result = await pool.query(
    `UPDATE savings_goals
     SET name = $1, target_amount = $2, note = $3
     WHERE id = $4 AND user_id = $5
     RETURNING id`,
    [name, targetAmount, note, request.params.id, user.id],
  );

  if (!result.rowCount) {
    response.status(404).json({ error: "Meta nao encontrada" });
    return;
  }

  response.json(await findSavingsGoal(request.params.id, user.id));
});

app.post("/api/savings-goals/:id/deposits", async (request, response) => {
  const user = await requireAuth(request, response);
  if (!user) return;
  const { id, amount, date } = request.body;

  if (!id || !amount || !date) {
    response.status(400).json({ error: "Campos obrigatorios faltando" });
    return;
  }

  const goal = await pool.query("SELECT id FROM savings_goals WHERE id = $1 AND user_id = $2", [request.params.id, user.id]);
  if (!goal.rowCount) {
    response.status(404).json({ error: "Meta nao encontrada" });
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
    WHERE goal.id = $1 AND goal.user_id = $2
    GROUP BY goal.id`,
    [request.params.id, user.id],
  );

  response.status(201).json(mapSavingsGoal(result.rows[0]));
});

app.delete("/api/savings-goals/:id", async (request, response) => {
  const user = await requireAuth(request, response);
  if (!user) return;
  await pool.query("DELETE FROM savings_goals WHERE id = $1 AND user_id = $2", [request.params.id, user.id]);
  response.status(204).end();
});

app.get("/api/settings", async (request, response) => {
  const user = await requireAuth(request, response);
  if (!user) return;
  const result = await pool.query("SELECT key, value FROM settings WHERE user_id = $1", [user.id]);
  response.json(Object.fromEntries(result.rows.map((row) => [row.key, row.value])));
});

app.put("/api/settings/:key", async (request, response) => {
  const user = await requireAuth(request, response);
  if (!user) return;
  const value = String(request.body.value ?? "");
  const result = await pool.query(
    `INSERT INTO settings (user_id, key, value, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id, key)
     DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
     RETURNING key, value`,
    [user.id, request.params.key, value],
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

import express from "express";
import rateLimit from "express-rate-limit";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import helmet from "helmet";
import pg from "pg";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const publicDirectory = join(projectRoot, "public");
const viewsDirectory = join(__dirname, "views");
const androidApkPath = join(projectRoot, "downloads", "planejamento-financeiro.apk");

function loadView(relativePath) {
  return readFileSync(join(viewsDirectory, relativePath), "utf8").trim();
}

const indexDocument = Object.entries({
  topbar: "partials/topbar.html",
  auth: "auth/index.html",
  navigation: "screens/navigation.html",
  dashboard: "screens/dashboard.html",
  goals: "screens/goals.html",
  transactions: "screens/transactions.html",
  insights: "screens/insights.html",
  records: "screens/records.html",
  goalModal: "modals/goal.html",
  transactionModal: "modals/transaction.html",
  exportModal: "modals/export.html",
  profileModal: "modals/profile.html",
  systemDialog: "modals/system-dialog.html",
  scripts: "partials/scripts.html",
}).reduce(
  (document, [placeholder, relativePath]) => document.replace(`{{${placeholder}}}`, loadView(relativePath)),
  loadView("layout.html"),
);
const app = express();
if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);
const port = Number(process.env.PORT || 5500);
const databaseUrl = process.env.DATABASE_URL;
const firebaseProjectId = process.env.FIREBASE_PROJECT_ID;
const firebaseClientConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: firebaseProjectId,
  appId: process.env.FIREBASE_APP_ID,
};
const firebaseClientConfigured = Object.values(firebaseClientConfig).every(Boolean);

function initializeFirebaseAdmin() {
  if (!firebaseProjectId) return null;
  if (getApps().length) return getAuth();

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const credential = clientEmail && privateKey
    ? cert({ projectId: firebaseProjectId, clientEmail, privateKey })
    : applicationDefault();

  initializeApp({ credential, projectId: firebaseProjectId });
  return getAuth();
}

const firebaseAdminAuth = initializeFirebaseAdmin();

const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    })
  : null;

app.disable("x-powered-by");
app.use((request, response, next) => {
  const requestId = request.get("X-Request-ID") || randomUUID();
  response.setHeader("X-Request-ID", requestId);
  const startedAt = Date.now();
  response.on("finish", () => {
    if (request.path.startsWith("/api/")) {
      console.log(JSON.stringify({ requestId, method: request.method, path: request.path, status: response.statusCode, durationMs: Date.now() - startedAt }));
    }
  });
  next();
});
app.use(helmet({
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  contentSecurityPolicy: {
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'"],
      "style-src": ["'self'", "'unsafe-inline'"],
      "img-src": ["'self'", "data:", "blob:"],
      "connect-src": ["'self'", "https://*.googleapis.com", "https://securetoken.googleapis.com", "https://identitytoolkit.googleapis.com"],
      "frame-src": ["'self'", "https://*.firebaseapp.com"],
      "font-src": ["'self'", "data:"],
      "object-src": ["'none'"],
      "base-uri": ["'self'"],
      "form-action": ["'self'"],
      "frame-ancestors": ["'none'"],
    },
  },
  frameguard: { action: "deny" },
  referrerPolicy: { policy: "no-referrer" },
}));
app.use(express.json({ limit: "100kb" }));
const capacitorOrigins = new Set(["https://localhost", "http://localhost", "capacitor://localhost"]);
app.use("/api", (request, response, next) => {
  const origin = request.get("Origin");
  if (origin && capacitorOrigins.has(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
    response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  }
  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }
  next();
});
app.use("/api", rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Muitas solicitacoes. Aguarde alguns minutos e tente novamente." },
}));
app.use("/vendor/firebase", express.static(join(projectRoot, "node_modules", "firebase"), {
  fallthrough: false,
  setHeaders(response) {
    response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  },
}));
app.use("/vendor/lucide", express.static(join(projectRoot, "node_modules", "lucide", "dist", "umd")));
app.use("/vendor/jspdf", express.static(join(projectRoot, "node_modules", "jspdf", "dist")));
app.use("/vendor/jspdf-autotable", express.static(join(projectRoot, "node_modules", "jspdf-autotable", "dist")));
app.use("/vendor/exceljs", express.static(join(projectRoot, "node_modules", "exceljs", "dist")));
app.use(express.static(publicDirectory, {
  extensions: ["html"],
  setHeaders(response, filePath) {
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

  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      firebase_uid TEXT UNIQUE,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS firebase_uid TEXT;`);
  await pool.query(`ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS users_firebase_uid_idx ON users(firebase_uid) WHERE firebase_uid IS NOT NULL;`);

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
      completed_at TIMESTAMPTZ,
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS custom_categories (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
      name TEXT NOT NULL CHECK (CHAR_LENGTH(name) BETWEEN 2 AND 40),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`ALTER TABLE settings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;`);
  await pool.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;`);
  await pool.query(`ALTER TABLE savings_goals ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;`);
  await pool.query(`ALTER TABLE savings_goals ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;`);

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
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS custom_categories_user_type_name_idx ON custom_categories(user_id, type, LOWER(name));`);
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

function mapSavingsGoal(row) {
  return {
    id: row.id,
    name: row.name,
    targetAmount: Number(row.target_amount),
    savedAmount: Number(row.saved_amount || 0),
    note: row.note || "",
    completedAt: row.completed_at || null,
    deposits: row.deposits || [],
  };
}

async function requireAuth(request, response) {
  if (!requireDatabase(response)) return null;
  if (!firebaseAdminAuth) {
    response.status(503).json({ error: "Firebase Admin nao configurado" });
    return null;
  }

  const authorization = String(request.headers.authorization || "");
  const idToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!idToken) {
    response.status(401).json({ error: "Login necessario" });
    return null;
  }

  let firebaseUser;
  try {
    firebaseUser = await firebaseAdminAuth.verifyIdToken(idToken);
  } catch {
    response.status(401).json({ error: "Login necessario" });
    return null;
  }

  if (!firebaseUser.email || !firebaseUser.email_verified) {
    response.status(403).json({ error: "Confirme seu email antes de acessar seus dados" });
    return null;
  }

  const email = firebaseUser.email.trim().toLowerCase();
  const existingByFirebase = await pool.query(
    "SELECT id, name, email, firebase_uid FROM users WHERE firebase_uid = $1",
    [firebaseUser.uid],
  );
  if (existingByFirebase.rows[0]) return existingByFirebase.rows[0];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existingByEmail = await client.query(
      "SELECT id, name, email FROM users WHERE LOWER(email) = $1 FOR UPDATE",
      [email],
    );

    let user;
    if (existingByEmail.rows[0]) {
      const linked = await client.query(
        `UPDATE users
         SET firebase_uid = $1, name = COALESCE(NULLIF($2, ''), name), email = $3
         WHERE id = $4
         RETURNING id, name, email, firebase_uid`,
        [firebaseUser.uid, firebaseUser.name || "", email, existingByEmail.rows[0].id],
      );
      user = linked.rows[0];
    } else {
      const created = await client.query(
        `INSERT INTO users (firebase_uid, name, email, password_hash)
         VALUES ($1, $2, $3, NULL)
         RETURNING id, name, email, firebase_uid`,
        [firebaseUser.uid, firebaseUser.name || email.split("@")[0], email],
      );
      user = created.rows[0];
    }

    await client.query("COMMIT");
    return user;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function findSavingsGoal(id, userId) {
  const result = await pool.query(
    `SELECT
      goal.id,
      goal.name,
      goal.target_amount,
      goal.note,
      goal.completed_at,
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
    response.json({ ok: true, database: "not_configured", firebase: firebaseAdminAuth ? "configured" : "not_configured" });
    return;
  }

  try {
    await pool.query("SELECT 1");
    response.json({ ok: true, database: "connected", firebase: firebaseAdminAuth ? "configured" : "not_configured" });
  } catch (error) {
    console.error("Erro ao verificar conexao com o banco:", error);
    response.status(503).json({ error: "Banco de dados temporariamente indisponivel" });
  }
});

app.get("/api/config/firebase", (_request, response) => {
  if (!firebaseClientConfigured) {
    response.status(503).json({ error: "Firebase Web nao configurado" });
    return;
  }
  response.json(firebaseClientConfig);
});

app.get("/api/auth/me", async (request, response) => {
  try {
    const user = await requireAuth(request, response);
    if (!user) return;
    response.json({ user: mapUser(user) });
  } catch (error) {
    console.error("Erro ao carregar usuario autenticado:", error);
    if (!response.headersSent) {
      response.status(500).json({ error: "Nao foi possivel carregar sua conta" });
    }
  }
});

app.delete("/api/account", async (request, response) => {
  try {
    const user = await requireAuth(request, response);
    if (!user) return;
    await pool.query("DELETE FROM users WHERE id = $1", [user.id]);
    if (user.firebase_uid) await firebaseAdminAuth.deleteUser(user.firebase_uid);
    response.status(204).end();
  } catch (error) {
    console.error("Erro ao excluir conta:", error);
    if (!response.headersSent) response.status(500).json({ error: "Não foi possível excluir a conta" });
  }
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
     ON CONFLICT (id) DO NOTHING
     RETURNING *`,
    [id, user.id, type, description, amount, date, category, frequency, note],
  );

  if (result.rows[0]) {
    response.status(201).json(mapTransaction(result.rows[0]));
    return;
  }
  const existing = await pool.query("SELECT * FROM transactions WHERE id = $1 AND user_id = $2", [id, user.id]);
  if (!existing.rows[0]) {
    response.status(409).json({ error: "Identificador de registro em uso" });
    return;
  }
  response.json(mapTransaction(existing.rows[0]));
});

app.get("/api/categories", async (request, response) => {
  const user = await requireAuth(request, response);
  if (!user) return;
  const result = await pool.query(
    "SELECT id, type, name FROM custom_categories WHERE user_id = $1 ORDER BY type, LOWER(name)",
    [user.id],
  );
  response.json(result.rows);
});

app.post("/api/categories", async (request, response) => {
  const user = await requireAuth(request, response);
  if (!user) return;
  const id = String(request.body.id || "");
  const type = String(request.body.type || "");
  const name = String(request.body.name || "").trim();

  if (!id || !["income", "expense"].includes(type) || name.length < 2 || name.length > 40) {
    response.status(400).json({ error: "Informe uma categoria entre 2 e 40 caracteres" });
    return;
  }

  try {
    const result = await pool.query(
      `INSERT INTO custom_categories (id, user_id, type, name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, type, name`,
      [id, user.id, type, name],
    );
    response.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      response.status(409).json({ error: "Esta categoria ja existe" });
      return;
    }
    throw error;
  }
});

app.put("/api/categories/:id", async (request, response) => {
  const user = await requireAuth(request, response);
  if (!user) return;
  const name = String(request.body.name || "").trim();
  if (name.length < 2 || name.length > 40) {
    response.status(400).json({ error: "Informe uma categoria entre 2 e 40 caracteres" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      "SELECT id, type, name FROM custom_categories WHERE id = $1 AND user_id = $2 FOR UPDATE",
      [request.params.id, user.id],
    );
    if (!existing.rows[0]) {
      await client.query("ROLLBACK");
      response.status(404).json({ error: "Categoria nao encontrada" });
      return;
    }

    const category = existing.rows[0];
    const updated = await client.query(
      "UPDATE custom_categories SET name = $1 WHERE id = $2 RETURNING id, type, name",
      [name, category.id],
    );
    await client.query(
      "UPDATE transactions SET category = $1 WHERE user_id = $2 AND type = $3 AND category = $4",
      [name, user.id, category.type, category.name],
    );
    await client.query("COMMIT");
    response.json(updated.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") {
      response.status(409).json({ error: "Esta categoria ja existe" });
      return;
    }
    throw error;
  } finally {
    client.release();
  }
});

app.delete("/api/categories/:id", async (request, response) => {
  const user = await requireAuth(request, response);
  if (!user) return;
  const categoryResult = await pool.query(
    "SELECT id, type, name FROM custom_categories WHERE id = $1 AND user_id = $2",
    [request.params.id, user.id],
  );
  const category = categoryResult.rows[0];
  if (!category) {
    response.status(404).json({ error: "Categoria nao encontrada" });
    return;
  }

  const usage = await pool.query(
    "SELECT COUNT(*)::int AS total FROM transactions WHERE user_id = $1 AND type = $2 AND category = $3",
    [user.id, category.type, category.name],
  );
  if (usage.rows[0].total > 0) {
    response.status(409).json({ error: `Esta categoria esta sendo usada em ${usage.rows[0].total} registro(s)` });
    return;
  }

  await pool.query("DELETE FROM custom_categories WHERE id = $1 AND user_id = $2", [category.id, user.id]);
  response.status(204).end();
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
      goal.completed_at,
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
     ON CONFLICT (id) DO NOTHING
     RETURNING id, name, target_amount, note, completed_at, 0 AS saved_amount, '[]'::json AS deposits`,
    [id, user.id, name, targetAmount, note],
  );

  if (result.rows[0]) {
    response.status(201).json(mapSavingsGoal(result.rows[0]));
    return;
  }
  const existing = await findSavingsGoal(id, user.id);
  if (!existing) {
    response.status(409).json({ error: "Identificador de meta em uso" });
    return;
  }
  response.json(existing);
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
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO NOTHING`,
    [id, request.params.id, amount, date],
  );

  const result = await pool.query(
    `SELECT
      goal.id,
      goal.name,
      goal.target_amount,
      goal.note,
      goal.completed_at,
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

app.post("/api/savings-goals/:id/complete", async (request, response) => {
  const user = await requireAuth(request, response);
  if (!user) return;
  const result = await pool.query(
    `UPDATE savings_goals goal
     SET completed_at = NOW()
     WHERE goal.id = $1
       AND goal.user_id = $2
       AND goal.completed_at IS NULL
       AND (SELECT COALESCE(SUM(amount), 0) FROM savings_deposits WHERE goal_id = goal.id) >= goal.target_amount
     RETURNING goal.id`,
    [request.params.id, user.id],
  );

  if (!result.rowCount) {
    response.status(400).json({ error: "A meta ainda nao atingiu o valor total ou ja foi concluida" });
    return;
  }

  response.json(await findSavingsGoal(request.params.id, user.id));
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

app.get("/download/android", (_request, response, next) => {
  response.type("application/vnd.android.package-archive");
  response.download(androidApkPath, "Planejamento-Financeiro.apk", (error) => {
    if (error && !response.headersSent) next(error);
  });
});

app.get("*", (_request, response) => {
  response.type("html").send(indexDocument);
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

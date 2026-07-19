import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import pg from "pg";

const { Pool } = pg;
const applyMigration = process.argv.includes("--apply");
const databaseUrl = process.env.DATABASE_URL;
const projectId = process.env.FIREBASE_PROJECT_ID;

if (!databaseUrl || !projectId) {
  console.error("Configure DATABASE_URL e FIREBASE_PROJECT_ID antes de executar a migracao.");
  process.exit(1);
}

const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
const credential = clientEmail && privateKey
  ? cert({ projectId, clientEmail, privateKey })
  : applicationDefault();

if (!getApps().length) initializeApp({ credential, projectId });
const firebaseAuth = getAuth();
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

function maskEmail(email) {
  const [name, domain] = String(email).split("@");
  return `${name.slice(0, 2)}***@${domain || ""}`;
}

try {
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS firebase_uid TEXT");
  await pool.query("ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL");
  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS users_firebase_uid_idx ON users(firebase_uid) WHERE firebase_uid IS NOT NULL");

  const result = await pool.query(
    `SELECT id, name, LOWER(email) AS email, password_hash, firebase_uid
     FROM users
     ORDER BY created_at ASC`,
  );

  const candidates = [];
  for (const user of result.rows) {
    if (user.firebase_uid) continue;

    try {
      const existingFirebaseUser = await firebaseAuth.getUserByEmail(user.email);
      if (applyMigration) {
        await pool.query("UPDATE users SET firebase_uid = $1, password_hash = NULL WHERE id = $2", [existingFirebaseUser.uid, user.id]);
      }
      console.log(`${maskEmail(user.email)}: conta Firebase existente${applyMigration ? " e vinculada" : ""}.`);
      continue;
    } catch (error) {
      if (error.code !== "auth/user-not-found") throw error;
    }

    if (!user.password_hash) {
      console.warn(`${maskEmail(user.email)}: sem hash antigo; sera necessario criar a conta ou recuperar a senha.`);
      continue;
    }
    candidates.push(user);
  }

  console.log(`${candidates.length} usuario(s) pronto(s) para importar.`);
  if (!applyMigration) {
    console.log("Simulacao concluida. Execute novamente com --apply para confirmar a importacao.");
    process.exitCode = 0;
  } else if (candidates.length) {
    const importResult = await firebaseAuth.importUsers(
      candidates.map((user) => ({
        uid: user.id,
        email: user.email,
        displayName: user.name,
        emailVerified: false,
        passwordHash: Buffer.from(user.password_hash),
      })),
      { hash: { algorithm: "BCRYPT" } },
    );

    const failedIndexes = new Set(importResult.errors.map((item) => item.index));
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const [index, user] of candidates.entries()) {
        if (failedIndexes.has(index)) continue;
        await client.query("UPDATE users SET firebase_uid = $1, password_hash = NULL WHERE id = $2", [user.id, user.id]);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    importResult.errors.forEach(({ index, error }) => {
      console.error(`${maskEmail(candidates[index].email)}: ${error.code}`);
    });
    console.log(`${importResult.successCount} usuario(s) importado(s); ${importResult.failureCount} falha(s).`);
    console.log("Os usuarios importados devem confirmar o email no primeiro acesso.");
  }
} finally {
  await pool.end();
}

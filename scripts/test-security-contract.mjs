import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const server = await readFile(new URL("../src/server.mjs", import.meta.url), "utf8");
const manifest = await readFile(new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url), "utf8");
const gradle = await readFile(new URL("../android/app/build.gradle", import.meta.url), "utf8");
const privacy = await readFile(new URL("../public/privacidade.html", import.meta.url), "utf8");
const activity = await readFile(new URL("../android/app/src/main/java/com/planejamentofinanceiro/app/MainActivity.java", import.meta.url), "utf8");

assert.match(server, /app\.delete\("\/api\/account"/);
assert.match(server, /DELETE FROM users WHERE id = \$1/);
assert.match(server, /firebaseAdminAuth\.deleteUser/);
assert.match(server, /X-Request-ID/);
assert.match(manifest, /android:allowBackup="false"/);
assert.match(manifest, /android:usesCleartextTraffic="false"/);
assert.match(gradle, /PF_RELEASE_STORE_FILE/);
assert.match(gradle, /minifyEnabled true/);
assert.match(privacy, /Excluir conta e dados/);
assert.match(activity, /FLAG_SECURE/);
console.log("Contrato de segurança, privacidade e release validado.");

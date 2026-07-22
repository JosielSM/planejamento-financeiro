import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const required = ["PF_RELEASE_STORE_FILE", "PF_RELEASE_STORE_PASSWORD", "PF_RELEASE_KEY_ALIAS", "PF_RELEASE_KEY_PASSWORD"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Release cancelado: configure ${missing.join(", ")}. Nenhuma chave deve ser salva no Git.`);
  process.exit(1);
}

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status || 1);
}

run("npm", ["test"]);
run("npm", ["run", "cap:sync"]);
run(process.platform === "win32" ? "gradlew.bat" : "./gradlew", ["assembleRelease", "bundleRelease"], join(root, "android"));

const packageData = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const sourceApk = join(root, "android", "app", "build", "outputs", "apk", "release", "app-release.apk");
const publishedApk = join(root, "downloads", "planejamento-financeiro.apk");
await mkdir(dirname(publishedApk), { recursive: true });
await copyFile(sourceApk, publishedApk);
const bytes = await readFile(publishedApk);
const metadata = {
  version: packageData.version,
  sha256: createHash("sha256").update(bytes).digest("hex"),
  bytes: bytes.length,
  generatedAt: new Date().toISOString(),
};
await writeFile(join(root, "downloads", "release.json"), `${JSON.stringify(metadata, null, 2)}\n`);
console.log(`Release ${metadata.version} assinada, testada e publicada em downloads/.`);

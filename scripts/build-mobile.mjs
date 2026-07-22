import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const viewsDirectory = join(projectRoot, "src", "views");
const outputDirectory = join(projectRoot, "dist");

async function loadView(relativePath) {
  return (await readFile(join(viewsDirectory, relativePath), "utf8")).trim();
}

const parts = {
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
  scripts: "partials/scripts.html"
};

let document = await loadView("layout.html");
for (const [placeholder, relativePath] of Object.entries(parts)) {
  document = document.replace(`{{${placeholder}}}`, await loadView(relativePath));
}

await rm(outputDirectory, { recursive: true, force: true });
await cp(join(projectRoot, "public"), outputDirectory, { recursive: true });
await writeFile(join(outputDirectory, "index.html"), document, "utf8");

const vendorFiles = [
  ["node_modules/firebase/firebase-app-compat.js", "vendor/firebase/firebase-app-compat.js"],
  ["node_modules/firebase/firebase-auth-compat.js", "vendor/firebase/firebase-auth-compat.js"],
  ["node_modules/lucide/dist/umd/lucide.min.js", "vendor/lucide/lucide.min.js"],
  ["node_modules/jspdf/dist/jspdf.umd.min.js", "vendor/jspdf/jspdf.umd.min.js"],
  ["node_modules/jspdf-autotable/dist/jspdf.plugin.autotable.min.js", "vendor/jspdf-autotable/jspdf.plugin.autotable.min.js"],
  ["node_modules/exceljs/dist/exceljs.min.js", "vendor/exceljs/exceljs.min.js"]
];

for (const [source, destination] of vendorFiles) {
  const outputPath = join(outputDirectory, destination);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, await readFile(join(projectRoot, source)));
}

console.log("Aplicativo mobile gerado em dist/.");

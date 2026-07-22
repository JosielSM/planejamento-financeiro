import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { webcrypto } from "node:crypto";

const storage = new Map();
const context = vm.createContext({
  console,
  crypto: webcrypto,
  navigator: { onLine: false },
  setTimeout: () => 0,
  syncStatusButton: null,
  syncStatusText: null,
  syncPendingCount: null,
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
  },
  firebaseAuth: { currentUser: { uid: "usuario-a" } },
  TRANSACTIONS_KEY: "transactions",
  SETTINGS_KEY: "settings",
  SAVINGS_GOALS_KEY: "goals",
  transactions: [],
  settings: { dailyGoal: 0, includeSundays: false },
  savingsGoals: [],
  customCategories: [],
  authRequired: true,
  showToast: () => {},
  showAuth: () => {},
  showApp: () => {},
  loadCachedAccount: () => ({ name: "Teste", email: "teste@example.com" }),
  render: () => {},
  refreshIcons: () => {},
  parseAmount: Number,
  todayISO: () => "2026-07-21",
  api: { request: async () => { throw new TypeError("offline"); } },
});

context.loadJSON = (key, fallback) => {
  try {
    return JSON.parse(context.localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
};

const source = await readFile(new URL("../public/js/02-data.js", import.meta.url), "utf8");
vm.runInContext(source, context);

const transaction = {
  id: "11111111-1111-4111-8111-111111111111",
  type: "income",
  description: "Teste offline",
  amount: 100,
  date: "2026-07-21",
  category: "Trabalho",
  frequency: "occasional",
  note: "",
  createdAt: "2026-07-21T14:00:00.000Z",
};

assert.equal(await vm.runInContext(`createTransaction(${JSON.stringify(transaction)})`, context), true);
assert.equal(vm.runInContext("loadSyncQueue().length", context), 1);
assert.equal(vm.runInContext("loadTransactions().length", context), 1);

await vm.runInContext(`createTransaction(${JSON.stringify({ ...transaction, id: "22222222-2222-4222-8222-222222222222" })})`, context);
assert.equal(vm.runInContext("loadTransactions().length", context), 2, "cada envio deve gerar somente um registro local");
assert.equal(vm.runInContext("loadSyncQueue().length", context), 2, "cada registro deve gerar somente uma operação pendente");

await vm.runInContext(`createTransaction(${JSON.stringify(transaction)})`, context);
assert.equal(vm.runInContext("loadTransactions().length", context), 2, "reenvio do mesmo identificador não pode duplicar o registro");
assert.equal(vm.runInContext("loadSyncQueue().length", context), 2, "reenvio idêntico não pode duplicar a fila");

context.firebaseAuth.currentUser.uid = "usuario-b";
assert.equal(vm.runInContext("loadTransactions().length", context), 0, "o cache deve ser isolado por UID");

context.firebaseAuth.currentUser.uid = "usuario-a";
context.api.request = async () => ({ ok: true });
assert.equal(await vm.runInContext("flushSyncQueue()", context), 2);
assert.equal(vm.runInContext("loadSyncQueue().length", context), 0);

context.api.request = async () => {
  const error = new Error("Categoria inválida");
  error.status = 400;
  throw error;
};
vm.runInContext(`queueMutation("/api/settings/test", { method: "PUT", body: "{}" })`, context);
assert.equal(await vm.runInContext("flushSyncQueue()", context), 0);
assert.equal(vm.runInContext("loadSyncQueue().length", context), 1, "falhas definitivas não podem ser descartadas");
assert.equal(vm.runInContext("loadSyncQueue()[0].lastStatus", context), 400);

vm.runInContext("saveSyncQueue([])", context);
vm.runInContext(`queueMutation("/api/settings/dailyGoal", { method: "PUT", body: JSON.stringify({ value: 100 }) })`, context);
vm.runInContext(`queueMutation("/api/settings/dailyGoal", { method: "PUT", body: JSON.stringify({ value: 200 }) })`, context);
assert.equal(vm.runInContext("loadSyncQueue().length", context), 1, "atualizações pendentes devem manter somente o valor mais recente");
assert.equal(vm.runInContext("JSON.parse(loadSyncQueue()[0].body).value", context), 200);

console.log("Cache por usuario e fila offline validados.");

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { webcrypto } from "node:crypto";

const storage = new Map();
const context = vm.createContext({
  console,
  crypto: webcrypto,
  navigator: { onLine: false },
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
};

assert.equal(await vm.runInContext(`createTransaction(${JSON.stringify(transaction)})`, context), true);
assert.equal(vm.runInContext("loadSyncQueue().length", context), 1);
assert.equal(vm.runInContext("loadTransactions().length", context), 1);

context.firebaseAuth.currentUser.uid = "usuario-b";
assert.equal(vm.runInContext("loadTransactions().length", context), 0, "o cache deve ser isolado por UID");

context.firebaseAuth.currentUser.uid = "usuario-a";
context.api.request = async () => ({ ok: true });
assert.equal(await vm.runInContext("flushSyncQueue()", context), 1);
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

console.log("Cache por usuario e fila offline validados.");

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const context = vm.createContext({
  transactions: [
    { type: "income", amount: 1000, date: "2026-05-10", frequency: "occasional" },
    { type: "expense", amount: 200, date: "2026-05-20", frequency: "occasional" },
    { type: "income", amount: 100, date: "2026-05-01", frequency: "monthly" },
    { type: "expense", amount: 50, date: "2026-06-15", frequency: "occasional" },
    { type: "income", amount: 999, date: "2026-08-01", frequency: "occasional" },
  ],
  monthFilter: { value: "2026-07" },
});

const source = await readFile(new URL("../public/js/03-dashboard.js", import.meta.url), "utf8");
vm.runInContext(source, context);

assert.equal(
  vm.runInContext('getAccumulatedBalance("2026-05")', context),
  900,
  "o primeiro mes deve considerar seu resultado e uma parcela do registro mensal",
);
assert.equal(
  vm.runInContext('getAccumulatedBalance("2026-06")', context),
  950,
  "o saldo anterior deve continuar no mes seguinte",
);
assert.equal(
  vm.runInContext('getAccumulatedBalance("2026-07")', context),
  1050,
  "um mes sem registros ocasionais nao pode zerar o saldo acumulado",
);

console.log("Saldo acumulado entre meses validado.");

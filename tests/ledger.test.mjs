// Budget guard tests. Run with `npm test` (node's built-in runner; TypeScript is stripped natively).
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { BudgetExceededError, Ledger, estimateChatUsd, settleChatUsd } from "../src/lib/ai/ledger.ts";

const fresh = () => {
  const dir = mkdtempSync(join(tmpdir(), "ledger-"));
  return { dir, file: join(dir, "ledger.json") };
};

test("estimates round up and apply the margin", () => {
  const usd = estimateChatUsd("muse-spark-1.3", 10_000, 1000, 1);
  // prompt tokens = 10000/2.5 + 1 image × 2000 + 64 = 6064; (6064 × 1.25 + 1000 × 4.25) / 1e6 × 1.5 = 0.017745 → 0.0178
  assert.equal(usd, 0.0178);
  assert.ok(estimateChatUsd("totally-unknown-model", 1000, 100) > estimateChatUsd("muse-ember-1.0", 1000, 100), "unknown models are priced at the most expensive tier");
  const s = settleChatUsd("muse-ember-1.0", { prompt_tokens: 1000, completion_tokens: 200, prompt_tokens_details: { cached_tokens: 400 } });
  assert.equal(s.cached, 400);
  assert.equal(s.usd, 0.0003); // (600*0.1 + 400*0.004 + 200*0.5)/1e6*1.5 = 0.0002424 → 0.0003
});

test("refuses a live call once the ledger is full", () => {
  const { dir, file } = fresh();
  const l = new Ledger({ file, budgetUsd: 1, reserveUsd: 0 });
  const id = l.reserve({ task: "t", model: "muse-spark-1.3", kind: "text", reservedUsd: 0.9 });
  l.settle(id, { costUsd: 0.95 });
  assert.equal(l.totals().spentUsd, 0.95);
  assert.throws(() => l.reserve({ task: "t", model: "muse-spark-1.3", kind: "text", reservedUsd: 0.1 }), BudgetExceededError);
  // a smaller call that still fits is allowed
  assert.ok(l.reserve({ task: "t", model: "muse-spark-1.3", kind: "text", reservedUsd: 0.04 }));
  rmSync(dir, { recursive: true, force: true });
});

test("pending reservations and failed calls count against the budget", () => {
  const { dir, file } = fresh();
  const l = new Ledger({ file, budgetUsd: 1, reserveUsd: 0 });
  l.reserve({ task: "t", model: "muse-ember-1.0", kind: "tools", reservedUsd: 0.5 }); // never settled: in flight
  const failed = l.reserve({ task: "t", model: "muse-ember-1.0", kind: "tools", reservedUsd: 0.4 });
  l.fail(failed, "ETIMEDOUT");
  const t = l.totals();
  assert.equal(t.pendingUsd, 0.5);
  assert.equal(t.spentUsd, 0.4, "a failed call books its worst-case estimate");
  assert.equal(t.errors, 1);
  assert.throws(() => l.reserve({ task: "t", model: "muse-ember-1.0", kind: "tools", reservedUsd: 0.2 }), BudgetExceededError);
  rmSync(dir, { recursive: true, force: true });
});

test("the reserve is only spendable in final mode", () => {
  const { dir, file } = fresh();
  const normal = new Ledger({ file, budgetUsd: 50, reserveUsd: 10, final: false });
  const final = new Ledger({ file, budgetUsd: 50, reserveUsd: 10, final: true });
  assert.equal(normal.limitUsd, 40);
  assert.equal(final.limitUsd, 50);
  const id = normal.reserve({ task: "t", model: "muse-spark-1.3", kind: "text", reservedUsd: 39.99 });
  normal.settle(id, { costUsd: 39.99 });
  assert.throws(() => normal.reserve({ task: "t", model: "muse-spark-1.3", kind: "text", reservedUsd: 0.05 }), BudgetExceededError);
  assert.ok(final.reserve({ task: "t", model: "muse-spark-1.3", kind: "text", reservedUsd: 0.05 }));
  rmSync(dir, { recursive: true, force: true });
});

test("parallel reservations from many processes never overshoot", async () => {
  const { dir, file } = fresh();
  const { spawn } = await import("node:child_process");
  const script = `
    import { Ledger } from ${JSON.stringify(new URL("../src/lib/ai/ledger.ts", import.meta.url).pathname)};
    const l = new Ledger({ file: process.argv[1], budgetUsd: 1, reserveUsd: 0 });
    let ok = 0;
    for (let i = 0; i < 20; i++) { try { l.reserve({ task: "p", model: "muse-ember-1.0", kind: "text", reservedUsd: 0.03 }); ok++; } catch {} }
    process.stdout.write(String(ok));
  `;
  const runs = Array.from({ length: 4 }, () =>
    new Promise((resolve, reject) => {
      const p = spawn(process.execPath, ["--input-type=module", "-e", script, file], { stdio: ["ignore", "pipe", "inherit"] });
      let out = "";
      p.stdout.on("data", (d) => (out += d));
      p.on("exit", (code) => (code === 0 ? resolve(Number(out)) : reject(new Error("child failed"))));
    }),
  );
  const granted = (await Promise.all(runs)).reduce((a, b) => a + b, 0);
  const l = new Ledger({ file, budgetUsd: 1, reserveUsd: 0 });
  assert.equal(granted, 33, "4 procs × 20 attempts at $0.03 against $1 → exactly 33 fit");
  assert.ok(l.totals().committedUsd <= 1);
  rmSync(dir, { recursive: true, force: true });
});

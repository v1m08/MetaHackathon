// Print the Muse spend ledger: `npm run ledger`
import { Ledger, MARGIN } from "../src/lib/ai/ledger.ts";
const l = new Ledger();
const t = l.totals();
const byTask = {};
for (const e of l.read().entries) byTask[e.task] = (byTask[e.task] ?? 0) + (e.status === "pending" ? e.reservedUsd : e.costUsd);
console.log(`Muse spend (with ${MARGIN}x margin): $${t.spentUsd.toFixed(4)} booked + $${t.pendingUsd.toFixed(4)} in flight = $${t.committedUsd.toFixed(4)} of $${t.limitUsd} limit ($${t.budgetUsd} budget, $${t.reserveUsd} reserve) — ${t.calls} calls, ${t.errors} errors`);
console.log("by model:", Object.fromEntries(Object.entries(t.byModel).map(([k, v]) => [k, "$" + v.toFixed(4)])));
console.log("by task:", Object.fromEntries(Object.entries(byTask).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, "$" + v.toFixed(4)])));

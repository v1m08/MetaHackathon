// Final QA: ten inputs typed the way a judge might, including a tiny budget and a thin weekend.
// Every result must be believable or decline gracefully with a reason. Prints a table; writes eval/qa-inputs.json.
//   node scripts/qa-inputs.mjs [--user maya]
import { writeFileSync } from "node:fs";
const BASE = process.env.EVAL_BASE ?? "http://localhost:3000";
const args = process.argv.slice(2);
const user = args.includes("--user") ? args[args.indexOf("--user") + 1] : "maya";
const opts = await (await fetch(`${BASE}/api/travel/options`, { headers: { "x-user-id": user } })).json();
const W = (n) => opts.weekends[n - 1];
const INPUTS = [
  { label: "typical", w: 4, budget: 100 },
  { label: "tiny budget", w: 4, budget: 25 },
  { label: "odd number", w: 3, budget: 137 },
  { label: "rich", w: 5, budget: 900 },
  { label: "thanksgiving", w: 2, budget: 80 },
  { label: "far out", w: 8, budget: 150 },
  { label: "with hint: no flights", w: 3, budget: 200, hint: "no flights, I hate airports" },
  { label: "with hint: somewhere I can run", w: 5, budget: 150, hint: "somewhere I can run outside" },
  { label: "one night", w: 4, budget: 60, oneNight: true },
  { label: "week-long", w: 6, budget: 300, week: true },
];
const rows = [];
for (const inp of INPUTS) {
  const wk = W(inp.w);
  const start = wk.start;
  const end = inp.oneNight ? (() => { const d = new Date(start + "T12:00:00"); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })() : inp.week ? (() => { const d = new Date(start + "T12:00:00"); d.setDate(d.getDate() + 6); return d.toISOString().slice(0, 10); })() : wk.end;
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/travel/discover`, { method: "POST", headers: { "content-type": "application/json", "x-user-id": user }, body: JSON.stringify({ start, end, budget: inp.budget, hint: inp.hint }) });
  const text = await res.text();
  let result, error;
  for (const chunk of text.split("\n\n")) {
    const ev = chunk.match(/^event: (.+)$/m)?.[1];
    const data = chunk.match(/^data: (.+)$/m)?.[1];
    if (ev === "result") result = JSON.parse(data);
    if (ev === "error") error = JSON.parse(data).message;
    if (!ev && text.startsWith("{")) error = JSON.parse(text).error;
  }
  const row = { ...inp, start, end, ms: Date.now() - t0, mode: result?.mode, error, trips: result?.trips.map((t) => `${t.cityName} $${t.prices.ifYes.total}/${t.prices.otherwise.total}${t.fitsBudget ? "" : " (over)"}${t.host ? ` · ${t.host.name.split(" ")[0]} hosts` : ""}${t.ride ? ` · ${t.ride.driver.name.split(" ")[0]} drives` : ""}`), decline: result?.declineReason };
  rows.push(row);
  console.log(`${inp.label.padEnd(30)} ${start}→${end} $${String(inp.budget).padEnd(4)} ${row.mode ?? "ERR"} ${(row.ms / 1000).toFixed(1)}s  ${error ? "ERROR " + error : row.trips?.length ? row.trips.join(" | ") : "declined: " + row.decline}`);
}
writeFileSync("eval/qa-inputs.json", JSON.stringify({ ranAt: new Date().toISOString(), user, rows }, null, 2));
const bad = rows.filter((r) => r.error || (!r.trips?.length && !r.decline));
console.log(`\n${rows.length - bad.length}/${rows.length} believable or gracefully declined${bad.length ? "; problems: " + bad.map((b) => b.label).join(", ") : ""}`);

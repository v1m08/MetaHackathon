// Final QA: N consecutive full demo runs from reset (Discover → Guide → Coordinate → approve one draft → recipient
// sees it), each must succeed. node scripts/qa-demo-runs.mjs [--n 5] [--budget 110]
import { writeFileSync } from "node:fs";
const BASE = process.env.EVAL_BASE ?? "http://localhost:3000";
const args = process.argv.slice(2);
const N = args.includes("--n") ? Number(args[args.indexOf("--n") + 1]) : 5;
const budget = args.includes("--budget") ? Number(args[args.indexOf("--budget") + 1]) : 110;
const vary = args.includes("--vary"); // different budget each run so every run is a live Muse call, not a cache hit
const H = (u) => ({ "content-type": "application/json", "x-user-id": u });
const post = (p, b, u) => fetch(`${BASE}${p}`, { method: "POST", headers: H(u), body: JSON.stringify(b) }).then((r) => r.json());
const get = (p, u) => fetch(`${BASE}${p}`, { headers: H(u) }).then((r) => r.json());
async function sse(p, b, u) {
  const text = await (await fetch(`${BASE}${p}`, { method: "POST", headers: H(u), body: JSON.stringify(b) })).text();
  let result, error, steps = 0;
  for (const chunk of text.split("\n\n")) {
    const ev = chunk.match(/^event: (.+)$/m)?.[1];
    const data = chunk.match(/^data: (.+)$/m)?.[1];
    if (ev === "step") steps++;
    if (ev === "result") result = JSON.parse(data);
    if (ev === "error") error = JSON.parse(data).message;
  }
  return { result, error, steps };
}
const opts = await get("/api/travel/options", "maya");
const wk = opts.weekends[3];
const results = [];
for (let i = 1; i <= N; i++) {
  const t0 = Date.now();
  const log = { run: i };
  try {
    await post("/api/admin/reset", {}, "maya");
    const d = await sse("/api/travel/discover", { start: wk.start, end: wk.end, budget: vary ? budget + i * 7 : budget }, "maya");
    if (d.error || !d.result?.trips?.length) throw new Error("discover: " + (d.error ?? "no trips"));
    log.discover = { mode: d.result.mode, ms: d.result.latencyMs, trips: d.result.trips.map((t) => t.cityName), steps: d.steps };
    const trip = d.result.trips[0];
    const g = await sse("/api/travel/guide", { tripId: trip.id }, "maya");
    if (g.error || !g.result?.items?.length) throw new Error("guide: " + (g.error ?? "no items"));
    log.guide = { mode: g.result.mode, ms: g.result.latencyMs, items: g.result.items.length, looked: g.result.looked.length };
    const c = await post("/api/travel/coordinate", { tripId: trip.id }, "maya");
    if (!c.drafts?.length) throw new Error("coordinate: no drafts (" + (c.error ?? c.mode) + ")");
    log.coordinate = { mode: c.mode, drafts: c.drafts.length, allFree: c.dates.allFree };
    const first = c.drafts[0];
    const a = await post(`/api/travel/drafts/${first.id}`, { action: "approve" }, "maya");
    if (!a.ok) throw new Error("approve failed: " + JSON.stringify(a));
    const inbox = await get("/api/conversations", first.to.id);
    const seen = inbox.find((x) => x.id === a.conversationId);
    if (!seen || seen.last?.text !== first.text) throw new Error("recipient did not see the approved message");
    const others = c.drafts.slice(1).map((dr) => dr.to.id);
    for (const o of others) {
      const ib = await get("/api/conversations", o);
      if (ib.some((x) => x.participants.some((p) => p.id === "maya") && x.last?.status === "draft")) throw new Error("a draft leaked to " + o);
    }
    log.approved = { to: first.to.name, recipientSaw: true };
    log.ok = true;
  } catch (e) {
    log.ok = false;
    log.error = e.message;
  }
  log.ms = Date.now() - t0;
  results.push(log);
  console.log(`run ${i}: ${log.ok ? "OK" : "FAIL " + log.error} · ${(log.ms / 1000).toFixed(0)}s · discover ${log.discover?.mode ?? "-"} ${log.discover?.trips?.join(",") ?? ""} · guide ${log.guide?.items ?? "-"} items · drafts ${log.coordinate?.drafts ?? "-"} · approved → ${log.approved?.to ?? "-"}`);
}
writeFileSync("eval/qa-demo-runs.json", JSON.stringify({ ranAt: new Date().toISOString(), budget, weekend: wk, results }, null, 2));
console.log(`${results.filter((r) => r.ok).length}/${N} consecutive demo runs passed`);

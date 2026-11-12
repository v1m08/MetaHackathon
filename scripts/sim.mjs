// Persona simulation: simulated young adults (each played by a cheap Muse agent) use the REAL feature through the
// same endpoints the UI calls, then give a structured verdict. Facts are checked by code (/api/admin/audit).
//   npm run sim                 all personas in sim/personas.json
//   npm run sim -- --only maya  one persona (measure cost first)
//   npm run sim -- --limit 6
// Writes sim/<persona>.json (full trace) and sim/summary.json. Budget: ~$0.10 per persona live.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const BASE = process.env.SIM_BASE ?? "http://localhost:3000";
const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const limit = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : Infinity;
const tag = args.includes("--tag") ? args[args.indexOf("--tag") + 1] : "run";

const personas = JSON.parse(readFileSync("sim/personas.json", "utf8")).personas.filter((p) => !only || p.id === only).slice(0, limit);
const H = (u) => ({ "content-type": "application/json", "x-user-id": u });
const post = (path, body, u) => fetch(`${BASE}${path}`, { method: "POST", headers: H(u), body: JSON.stringify(body) }).then((r) => r.json());
const get = (path, u) => fetch(`${BASE}${path}`, { headers: H(u) }).then((r) => r.json());
async function sse(path, body, u) {
  const text = await (await fetch(`${BASE}${path}`, { method: "POST", headers: H(u), body: JSON.stringify(body) })).text();
  let result, error;
  const steps = [];
  for (const chunk of text.split("\n\n")) {
    const ev = chunk.match(/^event: (.+)$/m)?.[1];
    const data = chunk.match(/^data: (.+)$/m)?.[1];
    if (!ev || !data) continue;
    const d = JSON.parse(data);
    if (ev === "step") steps.push(d);
    else if (ev === "result") result = d;
    else if (ev === "error") error = d.message;
  }
  return { result, error, steps };
}

mkdirSync("sim", { recursive: true });
const summary = [];
for (const p of personas) {
  const t0 = Date.now();
  const opts = await get("/api/travel/options", p.id);
  const wk = opts.weekends[p.weekend - 1];
  process.stdout.write(`▶ ${p.id} ${wk.label} $${p.budget} … `);
  const trace = { persona: p, weekend: wk, startedAt: new Date().toISOString(), stages: {}, cost: 0 };
  // 1) Discover
  const d = await sse("/api/travel/discover", { start: wk.start, end: wk.end, budget: p.budget }, p.id);
  trace.stages.discover = { steps: d.steps, result: d.result, error: d.error };
  if (d.error || !d.result) {
    console.log(`discover ERROR ${d.error}`);
    trace.verdict = { broken: true, error: d.error };
    writeFileSync(`sim/${p.id}.json`, JSON.stringify(trace, null, 1));
    summary.push({ id: p.id, error: d.error });
    continue;
  }
  trace.cost += d.result.costUsd;
  trace.stages.audit = await get(`/api/admin/audit?runId=${d.result.runId}`, p.id);
  // 2) Persona reads the trips
  const tripsForPersona = d.result.trips.map((t, i) => ({ i, city: t.cityName, title: t.title, pitch: t.pitch, reasons: t.reasons, ifYes: t.prices.ifYes.total, otherwise: t.prices.otherwise.total, conditions: t.prices.conditions, host: t.host ? { name: t.host.name, connection: t.host.connection, via: t.host.via?.name, note: t.host.hostingNote } : null, ride: t.ride ? { driver: t.ride.driver.name, connection: t.ride.driver.connection, via: t.ride.driver.via?.name, seats: t.ride.seatsOpen } : null, event: t.event?.title, people: t.people.map((x) => `${x.name} (${x.connection})`), overBudget: !t.fitsBudget }));
  const v = await post("/api/sim/persona", { persona: p.persona, stage: "trips", trips: tripsForPersona.length ? tripsForPersona : { declined: true, reason: d.result.declineReason }, budget: p.budget, weekend: wk.label }, p.id);
  trace.cost += v.costUsd ?? 0;
  trace.verdict = v.verdict;
  trace.verdictMode = v.mode;
  const pick = d.result.trips[v.verdict?.pickTripIndex ?? -1];
  // 3) Guide + Coordinate on the picked trip, persona decides on drafts
  if (pick) {
    const g = await sse("/api/travel/guide", { tripId: pick.id }, p.id);
    trace.stages.guide = { steps: g.steps, result: g.result, error: g.error };
    trace.cost += g.result?.costUsd ?? 0;
    const c = await post("/api/travel/coordinate", { tripId: pick.id }, p.id);
    trace.stages.coordinate = c;
    trace.cost += c.costUsd ?? 0;
    const guideForPersona = g.result ? { intro: g.result.intro, items: g.result.items.map((it) => ({ title: it.title, what: it.what, whyYou: it.whyYou, from: `${it.credit.name} (${it.credit.connection})`, price: it.priceHint })) } : null;
    const draftsForPersona = (c.drafts ?? []).map((x) => ({ draftId: x.id, to: `${x.to.name} (${x.to.connection})`, about: x.about?.name, text: x.text }));
    const dd = await post("/api/sim/persona", { persona: p.persona, stage: "drafts", guide: guideForPersona, drafts: draftsForPersona }, p.id);
    trace.cost += dd.costUsd ?? 0;
    trace.draftDecisions = dd.decisions;
    // apply the persona's decisions through the real approval endpoint
    const applied = [];
    for (const dec of dd.decisions?.decisions ?? []) {
      const r = await post(`/api/travel/drafts/${dec.draftId}`, { action: dec.action, text: dec.text }, p.id);
      applied.push({ ...dec, result: r });
    }
    trace.applied = applied;
  }
  trace.latencyMs = Date.now() - t0;
  trace.finishedAt = new Date().toISOString();
  writeFileSync(`sim/${p.id}.json`, JSON.stringify(trace, null, 1));
  const a = trace.stages.audit;
  const violations = a.trips.reduce((n, t) => n + t.renderedViolations, 0);
  const row = { id: p.id, weekend: wk.label, budget: p.budget, mode: d.result.mode, trips: d.result.trips.length, declined: !d.result.trips.length, declineReason: d.result.declineReason, picked: pick ? pick.cityName : null, wouldTake: !!trace.verdict?.wouldTake, surprising: trace.verdict?.surprising, trustworthy: trace.verdict?.trustworthy, objections: trace.verdict?.objections ?? [], looksBroken: trace.verdict?.looksBroken ?? [], reason: trace.verdict?.reason, renderedViolations: violations, rawGrounding: a.raw, fitsBudget: a.trips.filter((t) => t.fitsBudget).length, drafts: (trace.stages.coordinate?.drafts ?? []).length, approved: (trace.applied ?? []).filter((x) => x.action === "approve").length, edited: (trace.applied ?? []).filter((x) => x.action === "edit").length, discarded: (trace.applied ?? []).filter((x) => x.action === "discard").length, guideFeedback: trace.draftDecisions?.guideFeedback, costUsd: Math.round(trace.cost * 1000) / 1000, latencyMs: trace.latencyMs };
  summary.push(row);
  console.log(`${row.mode} ${(row.latencyMs / 1000).toFixed(0)}s $${row.costUsd} → ${row.trips ? row.trips + " trips" : "declined"}, picked ${row.picked ?? "none"}, take=${row.wouldTake} surprise=${row.surprising} trust=${row.trustworthy}, violations=${violations}, drafts ${row.approved}✓ ${row.edited}✎ ${row.discarded}✗${row.looksBroken.length ? " BROKEN: " + row.looksBroken.join(" | ") : ""}`);
}
writeFileSync(`sim/summary-${tag}.json`, JSON.stringify({ ranAt: new Date().toISOString(), rows: summary }, null, 1));
const ok = summary.filter((r) => !r.error);
const avg = (k) => (ok.length ? (ok.reduce((n, r) => n + (r[k] ?? 0), 0) / ok.length).toFixed(1) : "n/a");
console.log(`\n${ok.length} personas · would take: ${ok.filter((r) => r.wouldTake).length} · surprising ${avg("surprising")}/5 · trustworthy ${avg("trustworthy")}/5 · rendered violations ${ok.reduce((n, r) => n + r.renderedViolations, 0)} · declines ${ok.filter((r) => r.declined).length} · drafts approved ${ok.reduce((n, r) => n + r.approved, 0)} edited ${ok.reduce((n, r) => n + r.edited, 0)} discarded ${ok.reduce((n, r) => n + r.discarded, 0)} · spend $${ok.reduce((n, r) => n + r.costUsd, 0).toFixed(2)}`);
console.log(`summary → sim/summary-${tag}.json`);

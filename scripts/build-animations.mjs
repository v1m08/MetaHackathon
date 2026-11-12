// Builds the two pitch animations from REAL data: a recorded Discover run (src/data/recordings.json) and the
// persona traces (sim/). Images are inlined as data URIs so the files are self-contained.
//   node scripts/build-animations.mjs [--run <runId>] [--sim sim/summary-after.json] [--before sim/summary-before.json]
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";

const BASE = process.env.APP_BASE ?? "http://localhost:3000";
const args = process.argv.slice(2);
const arg = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);

const rec = JSON.parse(readFileSync("src/data/recordings.json", "utf8"));
const users = await (await fetch(`${BASE}/api/admin/dump?what=users`)).json();
const cities = (await (await fetch(`${BASE}/api/users/maya`)).json()) && JSON.parse(readFileSync("src/data/cities.ts", "utf8").match(/export const cities[^=]*=\s*(\[[\s\S]*?\]);/)[1].replace(/(\w+):/g, '"$1":').replace(/,\s*]/g, "]").replace(/,\s*}/g, "}"));
const userName = (id) => users.find((u) => u.id === id)?.name ?? id;

// pick the run: --run, else the richest (has ride + host + event), else the latest
let run = arg("--run") ? rec.discover.find((r) => r.id === arg("--run")) : undefined;
if (!run) run = [...rec.discover].sort((a, b) => score(b) - score(a))[0];
function score(r) {
  const t = r.trips[0];
  return (t ? (t.host ? 3 : 0) + (t.ride ? 3 : 0) + (t.event ? 2 : 0) + t.people.length * 0.2 : -10) + (r.steps.some((s) => s.tool === "scan_network") ? 2 : 0);
}
if (!run) throw new Error("no recorded discover run; run the app and `npm run record` first");

// inline images as data URIs
const cache = new Map();
async function inline(url) {
  if (!url) return "";
  if (cache.has(url)) return cache.get(url);
  try {
    const r = await fetch(`${BASE}${url}`);
    const buf = Buffer.from(await r.arrayBuffer());
    const type = r.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
    const d = `data:${type};base64,${buf.toString("base64")}`;
    cache.set(url, d);
    return d;
  } catch {
    return "";
  }
}
const t0 = run.trips[0];
if (t0) {
  if (t0.evidence?.[0]) t0.evidence[0].image = await inline(t0.evidence[0].image);
  if (t0.host) t0.host.avatar = await inline(t0.host.avatar);
  if (t0.ride) t0.ride.driver.avatar = await inline(t0.ride.driver.avatar);
  for (const p of t0.people.slice(0, 2)) p.avatar = await inline(p.avatar);
}
const agentData = { base: "", run: { ...run, viewerName: userName(run.viewerId), repairs: run.trips.flatMap((t) => t.repairs), trips: run.trips.map((t) => ({ ...t, evidence: t.evidence.slice(0, 1), people: t.people.slice(0, 2) })) }, users: users.map((u) => ({ id: u.id, name: u.name, city: u.city, openToHosting: u.openToHosting })), cities };
const agentTpl = readFileSync("pitch/animations/_agent.template.html", "utf8");
writeFileSync("pitch/animations/agent.html", agentTpl.replace("/*__DATA__*/null", JSON.stringify(agentData)));
console.log(`agent.html ← run ${run.id} (${run.viewerId}, ${run.input.start}, $${run.input.budget}): ${run.trips.map((t) => t.cityName).join(", ")}`);

// swarm
const simFile = arg("--sim") ?? (existsSync("sim/summary-after.json") ? "sim/summary-after.json" : existsSync("sim/summary-run.json") ? "sim/summary-run.json" : undefined);
if (simFile) {
  const sim = JSON.parse(readFileSync(simFile, "utf8"));
  const beforeFile = arg("--before") ?? (existsSync("sim/summary-before.json") ? "sim/summary-before.json" : undefined);
  const beforeRows = beforeFile ? JSON.parse(readFileSync(beforeFile, "utf8")).rows.filter((r) => !r.error) : null;
  const before = beforeRows ? { n: beforeRows.length, take: beforeRows.filter((r) => r.wouldTake).length, trustworthy: (beforeRows.reduce((s, r) => s + (r.trustworthy || 0), 0) / Math.max(1, beforeRows.length)).toFixed(1) } : null;
  const fixes = existsSync("PERSONAS.md") ? [...readFileSync("PERSONAS.md", "utf8").matchAll(/^- \*\*Fix:\*\* (.+)$/gm)].map((m) => m[1]) : [];
  const rows = [];
  for (const r of sim.rows) {
    const u = users.find((x) => x.id === r.id);
    let ticks = [];
    try {
      const tr = JSON.parse(readFileSync(`sim/${r.id}.json`, "utf8"));
      ticks = (tr.stages?.discover?.steps ?? []).filter((s) => s.kind === "tool").map((s) => s.tool);
    } catch {
      /* no trace */
    }
    rows.push({ id: r.id, name: u?.name?.split(" ")[0] ?? r.id, avatar: await inline(u?.avatar ?? ""), weekend: r.weekend, budget: r.budget, latencyMs: r.latencyMs, declined: r.declined, wouldTake: r.wouldTake, surprising: r.surprising, trustworthy: r.trustworthy, renderedViolations: r.renderedViolations, reason: r.reason, error: r.error, ticks });
  }
  // avatars for the swarm come from /api/admin/dump?what=users which has no avatar; fetch cards
  for (const row of rows) if (!row.avatar) row.avatar = await inline((await (await fetch(`${BASE}/api/users/${row.id}`)).json()).avatar);
  const swarmTpl = readFileSync("pitch/animations/_swarm.template.html", "utf8");
  writeFileSync("pitch/animations/swarm.html", swarmTpl.replace("/*__DATA__*/null", JSON.stringify({ base: "", rows, before, fixes })));
  console.log(`swarm.html ← ${simFile} (${rows.length} personas${before ? `, before: ${beforeFile}` : ""}, ${fixes.length} fixes)`);
} else console.log("swarm.html skipped: no sim summary yet");
void readdirSync;

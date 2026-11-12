// Renders the results tables for PERSONAS.md from sim summaries: node scripts/personas-md.mjs sim/summary-before.json sim/summary-after.json
// Prints Markdown to stdout; PERSONAS.md pastes it between the markers.
import { readFileSync } from "node:fs";

const [beforeFile, afterFile] = process.argv.slice(2);
const load = (f) => (f ? JSON.parse(readFileSync(f, "utf8")).rows : null);
const before = load(beforeFile);
const after = load(afterFile);
const personas = Object.fromEntries(JSON.parse(readFileSync("sim/personas.json", "utf8")).personas.map((p) => [p.id, p]));

function agg(rows) {
  const ok = rows.filter((r) => !r.error);
  const n = ok.length;
  const mean = (k) => (ok.filter((r) => r[k] != null).reduce((s, r) => s + r[k], 0) / Math.max(1, ok.filter((r) => r[k] != null).length)).toFixed(1);
  return { n, take: ok.filter((r) => r.wouldTake).length, declined: ok.filter((r) => r.declined).length, surprising: mean("surprising"), trustworthy: mean("trustworthy"), violations: ok.reduce((s, r) => s + (r.renderedViolations || 0), 0), broken: ok.filter((r) => r.looksBroken?.length).length, approved: ok.reduce((s, r) => s + (r.approved || 0), 0), edited: ok.reduce((s, r) => s + (r.edited || 0), 0), discarded: ok.reduce((s, r) => s + (r.discarded || 0), 0), cost: ok.reduce((s, r) => s + (r.costUsd || 0), 0).toFixed(2), errors: rows.length - n };
}
const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");

let out = "";
if (before && after) {
  const a = agg(before), b = agg(after);
  out += `| | Before fixes | After fixes |\n|---|---|---|\n`;
  out += `| Personas run | ${a.n}${a.errors ? ` (+${a.errors} errored)` : ""} | ${b.n}${b.errors ? ` (+${b.errors} errored)` : ""} |\n`;
  out += `| Would take the trip | ${a.take}/${a.n} | ${b.take}/${b.n} |\n`;
  out += `| Graceful declines | ${a.declined} | ${b.declined} |\n`;
  out += `| Surprising (1–5, mean) | ${a.surprising} | ${b.surprising} |\n`;
  out += `| Trustworthy (1–5, mean) | ${a.trustworthy} | ${b.trustworthy} |\n`;
  out += `| Personas who flagged something as broken | ${a.broken} | ${b.broken} |\n`;
  out += `| Privacy violations rendered (code-checked) | ${a.violations} | ${b.violations} |\n`;
  out += `| Drafts approved / edited / discarded | ${a.approved} / ${a.edited} / ${a.discarded} | ${b.approved} / ${b.edited} / ${b.discarded} |\n`;
  out += `| Muse spend | $${a.cost} | $${b.cost} |\n\n`;
}
const rows = after ?? before;
out += `| Persona | Ask | Result | Picked | Take? | ✨ | 🛡 | Drafts | In their words |\n|---|---|---|---|---|---|---|---|---|\n`;
for (const r of rows) {
  const p = personas[r.id];
  if (r.error) {
    out += `| **${r.id}** | | error: ${esc(r.error)} | | | | | | |\n`;
    continue;
  }
  out += `| **${r.id}** | ${r.weekend}, $${r.budget}${p?.car ? ", car" : ""} | ${r.declined ? `declined: ${esc(r.declineReason)}` : `${r.trips} trip${r.trips === 1 ? "" : "s"}`} | ${r.picked ?? "—"} | ${r.declined ? "—" : r.wouldTake ? "yes" : "no"} | ${r.surprising ?? ""} | ${r.trustworthy ?? ""} | ${r.drafts ? `${r.approved}✓ ${r.edited}✎ ${r.discarded}✗` : "—"} | ${esc(r.reason)} |\n`;
}
out += `\n### Objections and "looks broken", verbatim\n\n`;
for (const r of rows) {
  if (r.error) continue;
  const items = [...(r.objections || []).map((o) => `objection: ${o}`), ...(r.looksBroken || []).map((o) => `broken: ${o}`)];
  if (!items.length) continue;
  out += `- **${r.id}** — ${items.map(esc).join(" · ")}\n`;
}
process.stdout.write(out);

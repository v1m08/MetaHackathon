// Copies real recorded runs from the gitignored .ai-runs/ into src/data/recordings.json (committed), so replay
// mode and the pitch animations have real data. Keeps the latest live run per (viewer, weekend) and the latest
// live guide per city.   node scripts/record.mjs
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const RUNS = ".ai-runs/discover.jsonl";
const GUIDES = ".ai-runs/guides.jsonl";
const OUT = "src/data/recordings.json";

const lines = (f) => (existsSync(f) ? readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const runs = lines(RUNS).filter((r) => r.mode === "live" && r.trips.length);
const guides = lines(GUIDES).filter((g) => g.mode === "live" && g.items?.length);

const byKey = new Map();
for (const r of runs) byKey.set(`${r.viewerId}|${r.input.start}|${r.input.budget}`, r);
const gByCity = new Map();
for (const g of guides) gByCity.set(`${g.city}|${g.viewerId}`, g);

const out = { recordedAt: new Date().toISOString(), discover: [...byKey.values()].slice(-24), guides: [...gByCity.values()].slice(-24) };
writeFileSync(OUT, JSON.stringify(out));
console.log(`recorded ${out.discover.length} discover runs and ${out.guides.length} guides → ${OUT} (${Math.round(readFileSync(OUT).length / 1024)} KB)`);
for (const r of out.discover) console.log(`  discover ${r.viewerId} ${r.input.start} $${r.input.budget}: ${r.trips.map((t) => t.cityName).join(", ")} (${(r.latencyMs / 1000).toFixed(1)}s, $${r.costUsd.toFixed(3)})`);
for (const g of out.guides) console.log(`  guide ${g.viewerId} ${g.city}: ${g.items.length} items`);

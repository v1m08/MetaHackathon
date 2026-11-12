// npm run memory:rebuild [-- --live | --cached] [--no-record]
// Rebuilds every friend's memory file (A: Muse Ember) and critter design (E: Muse Wonder) into
// data/hangout/memory.json. Blocked friends are never processed. Restart or reset the dev server after.
import { existsSync } from "node:fs";
for (const f of [".env.local", ".env"]) if (existsSync(f)) process.loadEnvFile(f);

import { hasKey, museModelId, type HangMode } from "@/server/hangout/muse";
import { rebuildAllMemory } from "@/server/hangout/pipeline";
import { MEMORY_FILE } from "@/server/hangout/store";

const args = process.argv.slice(2);
const mode: HangMode = args.includes("--cached") ? "cached" : args.includes("--live") || hasKey() ? "live" : "cached";

async function main() {
  console.log(`\nRebuilding memory files · ${mode === "live" ? `live · ${museModelId("ember")} + ${museModelId("wonder")}` : "cached"}\n`);
  const runs = await rebuildAllMemory({ mode, fallbackToCache: false, record: !args.includes("--no-record") });
  for (const r of runs) {
    const ms = r.steps.filter((s) => s.muse).map((s) => s.muse!.latencyMs).reduce((a, b) => a + b, 0);
    console.log(`${r.ok ? "✓" : "✗"} ${r.label.replace("Rebuild memory: ", "").padEnd(8)} ${String(ms).padStart(5)}ms  ${r.outcome}`);
    for (const s of r.steps.filter((s) => s.status === "fail" || s.status === "info")) console.log(`    ${s.name}: ${s.detail}`);
  }
  console.log(`\nWrote ${MEMORY_FILE}\n`);
  process.exit(runs.every((r) => r.ok || r.outcome === "skipped") ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

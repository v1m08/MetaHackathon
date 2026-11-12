// npm run eval:moments [-- --live | --cached] [--no-record]
// Runs every friend moment through the why-now detector (C) and guardrail filter (D) and prints pass/fail.
// Live by default when a key is set. Live responses that pass are saved for cached mode unless --no-record.
import { existsSync } from "node:fs";
for (const f of [".env.local", ".env"]) if (existsSync(f)) process.loadEnvFile(f);

import { SCENARIOS } from "@/data/hangout/scenarios";
import { grade, runWhyNow, type WhyNowResult } from "@/server/hangout/pipeline";
import { hasKey, museModelId, type HangMode } from "@/server/hangout/muse";
import { hang, resetHang } from "@/server/hangout/store";

const args = process.argv.slice(2);
const mode: HangMode = args.includes("--cached") ? "cached" : args.includes("--live") || hasKey() ? "live" : "cached";
const record = !args.includes("--no-record");
const c = { green: (s: string) => `\x1b[32m${s}\x1b[0m`, red: (s: string) => `\x1b[31m${s}\x1b[0m`, dim: (s: string) => `\x1b[2m${s}\x1b[0m`, bold: (s: string) => `\x1b[1m${s}\x1b[0m` };

const museMs = (r: WhyNowResult) => r.run.steps.find((s) => s.muse)?.muse?.latencyMs;

async function main() {
  console.log(c.bold("\nHang Again · eval:moments"));
  console.log(mode === "live" ? `mode: live · why-now model ${museModelId("wonder")}` : c.dim("mode: cached · replaying recorded runs + hand-written fixtures. This checks the code paths, not the model."));
  if (mode === "live" && !hasKey()) console.log(c.red("No META_MODEL_API_KEY in .env.local: every live call will fail safe."));
  console.log("");

  const rows: { label: string; pass: boolean; note: string; ms?: number }[] = [];
  const order = ["maya_ramen", "dev_goose", "jess_moved", "priya_lunch", "chris_meme", "alex_barton", "jordan_torchys"];
  for (const id of order) {
    const sc = SCENARIOS.find((s) => s.id === id)!;
    resetHang(true);
    hang().aiMode = mode;
    const r = await runWhyNow(id, { mode, fallbackToCache: false, record });
    rows.push({ label: sc.label, ...grade(sc, r), ms: museMs(r) });
  }

  // Inject a fake evidence ID into Maya's model output: the code check must reject it.
  resetHang(true);
  const tampered = await runWhyNow("maya_ramen", { mode, fallbackToCache: false, record: false, tamper: (w) => ({ ...w, nudge: true, type: w.type ?? "place", action: w.action ?? "say_hi", reason: w.reason || "test", evidenceIds: [...w.evidenceIds, "ph_fake_999"] }) });
  const fakeModelFailed = tampered.outcome === "failed";
  rows.push({
    label: "Fake evidence ID injected",
    pass: tampered.outcome === "rejected",
    note: tampered.outcome === "rejected" ? `rejected: ${tampered.reason}` : fakeModelFailed ? `couldn't run: model call failed (${tampered.reason})` : `not rejected (${tampered.outcome})`,
    ms: museMs(tampered),
  });

  const w = Math.max(...rows.map((r) => r.label.length));
  for (const r of rows) console.log(`${r.pass ? c.green("PASS") : c.red("FAIL")}  ${r.label.padEnd(w)}  ${c.dim(r.ms !== undefined ? `${String(r.ms).padStart(5)}ms` : "    —  ")}  ${r.note}`);

  const first5 = rows.slice(0, 5).filter((r) => r.pass).length;
  const all = rows.filter((r) => r.pass).length;
  const ok = first5 >= 4;
  console.log(`\nFirst 5 (the model's judgment): ${first5}/5 ${ok ? c.green("✓ target met (≥4)") : c.red("✗ below target (≥4)")}`);
  console.log(`All checks: ${all}/${rows.length}`);
  if (mode === "live" && record && rows.some((r) => r.pass && r.ms)) console.log(c.dim("Passing live responses were saved to data/hangout/recorded.json for cached mode."));
  console.log("");
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

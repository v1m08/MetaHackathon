// Loads .env.local / .env from the repo root (inline `# comments` stripped). Existing env vars win.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const ROOT = join(__dirname, "..", "..");

for (const f of [".env.local", ".env"]) {
  const p = join(ROOT, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    let v = m[2].replace(/\s+#.*$/, "").trim();
    if (/^(["']).*\1$/.test(v)) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}

export const env = {
  key: process.env.META_API_KEY || process.env.MODEL_API_KEY || "",
  base: (process.env.MODEL_API_BASE_URL || "https://api.meta.ai/v1").replace(/\/$/, ""),
  model: process.env.SIDEQUEST_MODEL || process.env.MODEL_TEXT || "muse-spark-1.3",
  timeoutMs: Number(process.env.SIDEQUEST_TIMEOUT_MS) || 25000,
  mode: process.env.AI_MODE || "auto",
  budgetUsd: Number(process.env.MODEL_BUDGET_USD) || 50,
  reserveUsd: Number(process.env.MODEL_BUDGET_RESERVE_USD) || 10,
};
export const liveEnabled = () => env.mode !== "mock" && !!env.key;

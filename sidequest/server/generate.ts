// interest → GameConfig. Cache → Muse Spark (one repair retry) → sanitize → fallback. Never throws.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeInterest, sanitizeConfig, type GameConfig } from "../shared/schema";
import { env, liveEnabled } from "./env";
import { fallbackConfig } from "./fallback";
import { chatJSON, extractJson, type Message } from "./llm";
import { SYSTEM_PROMPT, userPrompt } from "./prompt";

export interface GenResult {
  config: GameConfig;
  source: "cache" | "llm" | "llm-retry" | "fallback";
  ms: number;
  costUsd: number;
  note?: string;
}

const CACHE_DIR = join(__dirname, "..", ".cache");
const CACHE_FILE = join(CACHE_DIR, "configs.json");
const cache = new Map<string, GameConfig>();
try {
  if (existsSync(CACHE_FILE)) for (const [k, v] of Object.entries(JSON.parse(readFileSync(CACHE_FILE, "utf8")))) cache.set(k, sanitizeConfig(v, k));
} catch {
  /* corrupt cache: start empty */
}
function persist() {
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(Object.fromEntries(cache), null, 1));
  } catch {
    /* read-only fs: memory cache only */
  }
}

export const cacheKey = (interest: string) => interest.toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}\p{Extended_Pictographic}]+/gu, " ").trim();

export async function generate(rawInterest: string, opts: { fresh?: boolean; offline?: boolean } = {}): Promise<GenResult> {
  const t0 = performance.now();
  const interest = normalizeInterest(rawInterest);
  const done = (r: Omit<GenResult, "ms">): GenResult => ({ ...r, ms: Math.round(performance.now() - t0) });
  if (!interest) return done({ config: fallbackConfig("fun"), source: "fallback", costUsd: 0, note: "empty input" });

  const key = cacheKey(interest);
  if (!opts.fresh && cache.has(key)) return done({ config: { ...cache.get(key)!, interest }, source: "cache", costUsd: 0 });
  if (opts.offline || !liveEnabled()) return done({ config: fallbackConfig(interest), source: "fallback", costUsd: 0, note: "no API key / offline" });

  const messages: Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt(interest) },
  ];
  let cost = 0;
  let lastErr = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const r = await chatJSON(messages);
      cost += r.costUsd;
      let parsed: unknown;
      try {
        parsed = extractJson(r.text);
      } catch (err) {
        lastErr = (err as Error).message;
        messages.push({ role: "assistant", content: r.text.slice(0, 4000) }, { role: "user", content: `That was not valid JSON (${lastErr}). Reply with only the JSON object.` });
        continue;
      }
      const config = sanitizeConfig({ ...(parsed as object), interest }, interest);
      cache.set(key, config);
      persist();
      return done({ config, source: attempt === 1 ? "llm" : "llm-retry", costUsd: cost });
    } catch (err) {
      lastErr = (err as Error).message;
      break; // timeout / API error: no point retrying inside the latency budget
    }
  }
  return done({ config: fallbackConfig(interest), source: "fallback", costUsd: cost, note: lastErr || `model ${env.model} failed` });
}

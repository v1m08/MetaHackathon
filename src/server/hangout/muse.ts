// Muse calls for Hang Again, on top of the shared AI layer (so every call shows up in /dev/ai).
//   - routes to Muse Ember (high volume) or Muse Wonder by env var, never hardcoded
//   - live: validate with zod, retry once on invalid output, then fail safe (data: null)
//   - cached: replay a recorded good run (data/hangout/recorded.json), else the hand-written fixtures
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { ai, aiStatus, type AIMessage } from "@/lib/ai";
import { softenDashes } from "@/lib/hangout/schemas";
import { FIXTURES } from "./fixtures";

export type HangMode = "live" | "cached";
export type MuseModel = "ember" | "wonder";

export function museModelId(m: MuseModel) {
  return m === "ember" ? process.env.MUSE_EMBER_MODEL || process.env.MODEL_TEXT || "muse-ember" : process.env.MUSE_WONDER_MODEL || process.env.MODEL_TEXT || "muse-wonder";
}
export const hasKey = () => aiStatus().hasKey;

// ---------- recorded responses ----------
export const DATA_DIR = join(process.cwd(), "data", "hangout");
const RECORDED = join(DATA_DIR, "recorded.json");
type Recorded = Record<string, { response: unknown; model: string; latencyMs: number; recordedAt: string }>;

export function readJsonFile<T>(file: string, fallback: T): T {
  try {
    return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function writeJsonFile(file: string, data: unknown) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
}

export function cachedResponse(key: string): { response: unknown; source: "recorded" | "fixture" } | null {
  const rec = readJsonFile<Recorded>(RECORDED, {})[key];
  if (rec) return { response: rec.response, source: "recorded" };
  if (key in FIXTURES) return { response: FIXTURES[key], source: "fixture" };
  return null;
}
export function recordResponse(key: string, response: unknown, meta: { model: string; latencyMs: number }) {
  const all = readJsonFile<Recorded>(RECORDED, {});
  all[key] = { response, ...meta, recordedAt: new Date().toISOString() };
  writeJsonFile(RECORDED, all);
}
export const recordedKeys = () => Object.keys(readJsonFile<Recorded>(RECORDED, {}));

// ---------- the call ----------
export interface MuseLog {
  task: string;
  cacheKey: string;
  model: MuseModel;
  modelId: string;
  mode: HangMode | "live→cached";
  source?: "recorded" | "fixture";
  latencyMs: number;
  attempts: { raw: unknown; issues?: string[] }[];
  ok: boolean;
  error?: string;
  traceIds: string[];
}

export interface MuseCall<T> {
  task: string;
  model: MuseModel;
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  cacheKey: string;
  mode: HangMode;
  /** Live call failed (network, no key)? Replay the cache instead of failing. Off for evals. */
  fallbackToCache?: boolean;
  temperature?: number;
  /** Muse Ember/Wonder are reasoning models: thinking tokens count against this, so keep it generous. */
  maxTokens?: number;
}

const MAX_TOKENS = 4096;
const isEmpty = (raw: unknown) => !!raw && typeof raw === "object" && !Array.isArray(raw) && Object.keys(raw).length === 0;

const toJsonSchema = (schema: z.ZodType) => {
  const { $schema: _drop, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  void _drop;
  return rest;
};

export async function museJson<T>(c: MuseCall<T>): Promise<{ data: T | null; raw: unknown; log: MuseLog }> {
  const modelId = museModelId(c.model);
  const schema = toJsonSchema(c.schema);
  const log: MuseLog = { task: c.task, cacheKey: c.cacheKey, model: c.model, modelId, mode: c.mode, latencyMs: 0, attempts: [], ok: false, traceIds: [] };
  const t0 = performance.now();
  const done = (data: T | null, raw: unknown) => {
    log.latencyMs = Math.round(performance.now() - t0);
    log.ok = data !== null;
    return { data, raw, log };
  };
  const check = (raw: unknown) => {
    const r = c.schema.safeParse(softenDashes(raw));
    if (r.success) return { data: r.data, issues: undefined };
    return { data: null, issues: r.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`) };
  };

  const replay = async () => {
    const hit = cachedResponse(c.cacheKey);
    if (!hit) {
      log.error = [log.error, `no cached response for ${c.cacheKey}`].filter(Boolean).join("; ");
      return done(null, null);
    }
    log.source = hit.source;
    const { data: raw, trace } = await ai.json(c.prompt, { task: c.task, model: modelId, schema, system: c.system, mode: "mock", mock: () => structuredClone(hit.response) });
    log.traceIds.push(trace.id);
    const v = check(raw);
    log.attempts.push({ raw, issues: v.issues });
    if (!v.data) log.error = "cached response failed validation";
    return done(v.data, raw);
  };

  if (c.mode === "cached") return replay();

  if (!hasKey()) {
    log.error = "no META_MODEL_API_KEY set";
    if (c.fallbackToCache) {
      log.mode = "live→cached";
      return replay();
    }
    return done(null, null);
  }

  let messages: AIMessage[] = [{ role: "user", content: c.prompt }];
  let maxTokens = c.maxTokens ?? MAX_TOKENS;
  for (let attempt = 0; attempt < 2; attempt++) {
    let raw: unknown;
    try {
      const r = await ai.json(messages, { task: attempt ? `${c.task}.retry` : c.task, model: modelId, schema, system: c.system, mode: "live", temperature: c.temperature ?? 0.3, maxTokens });
      log.traceIds.push(r.trace.id);
      raw = r.data;
    } catch (err) {
      if (err instanceof SyntaxError) {
        // Unparseable even after the AI layer's repair pass: counts as an invalid attempt.
        log.attempts.push({ raw: null, issues: ["not valid JSON"] });
        messages = [...messages, { role: "user", content: "That was not valid JSON. Return only the JSON object." }];
        continue;
      }
      log.error = (err as Error).message;
      if (c.fallbackToCache) {
        log.mode = "live→cached";
        return replay();
      }
      return done(null, null);
    }
    // An empty object means the model used its whole budget thinking and never answered: retry with more room.
    if (isEmpty(raw)) {
      log.attempts.push({ raw, issues: [`empty response (reasoning used all ${maxTokens} tokens)`] });
      maxTokens *= 2;
      continue;
    }
    const v = check(raw);
    log.attempts.push({ raw, issues: v.issues });
    if (v.data) return done(v.data, raw);
    messages = [...messages, { role: "assistant", content: JSON.stringify(raw) }, { role: "user", content: `That failed validation: ${v.issues!.join("; ")}. Return the corrected JSON object only.` }];
  }
  log.error = "invalid output twice, failing safe";
  return done(null, log.attempts.at(-1)?.raw ?? null);
}

// The one Meta Model API call. OpenAI-compatible /chat/completions with JSON output. Every live call is
// booked in the repo's shared budget ledger (.ai-ledger.json) and refused once the budget is reached.
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { env, ROOT } from "./env";

const LEDGER = join(ROOT, ".ai-ledger.json");
// USD / 1M tokens, third-party reported (same table as the repo's old ledger), unconfirmed.
const PRICES: Record<string, { input: number; cached: number; output: number }> = {
  "muse-ember-1.0": { input: 0.1, cached: 0.004, output: 0.5 },
  "muse-spark": { input: 1.25, cached: 0.15, output: 4.25 },
};
PRICES["muse-wonder"] = { input: 4, cached: 0.2, output: 20 };
const priceFor = (model: string) => (model.startsWith("muse-ember") ? PRICES["muse-ember-1.0"] : model.startsWith("muse-wonder") ? PRICES["muse-wonder"] : PRICES["muse-spark"]);
const MARGIN = 1.5;

export class LLMError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

interface Usage {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
}
interface Completion {
  choices?: { message?: { content?: string }; finish_reason?: string }[];
  usage?: Usage;
}
export interface Message {
  role: "system" | "user" | "assistant";
  /** Text, or text + images (OpenAI-style parts) for vision models. */
  content: string | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[];
}

type Entry = { costUsd: number; status: string; reservedUsd: number; [k: string]: unknown };
function readLedger(): { entries: Entry[] } {
  try {
    return existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, "utf8")) : { entries: [] };
  } catch {
    return { entries: [] };
  }
}
function book(e: Entry) {
  const l = readLedger();
  l.entries.push(e);
  const tmp = LEDGER + ".tmp-" + process.pid;
  writeFileSync(tmp, JSON.stringify(l, null, 2));
  renameSync(tmp, LEDGER);
}
export function spentUsd() {
  return readLedger().entries.reduce((s, e) => s + (e.status === "pending" ? e.reservedUsd : e.costUsd || 0), 0);
}

export interface ChatOpts {
  maxTokens?: number;
  task?: string;
  /** JSON mode (default true). Set false for code or prose. */
  json?: boolean;
  model?: string;
  timeoutMs?: number;
  reasoning?: "low" | "medium" | "high";
  temperature?: number;
}

export async function chatJSON(messages: Message[], opts: ChatOpts = {}): Promise<{ text: string; ms: number; costUsd: number; finish?: string }> {
  const maxTokens = opts.maxTokens ?? 3000;
  const model = opts.model ?? env.model;
  const timeoutMs = opts.timeoutMs ?? env.timeoutMs;
  const PRICE = priceFor(model);
  const limit = env.budgetUsd - env.reserveUsd;
  if (spentUsd() >= limit) throw new LLMError(`budget guard: $${spentUsd().toFixed(2)} of $${limit} spent`);

  const body = {
    model,
    messages,
    max_tokens: maxTokens,
    reasoning_effort: opts.reasoning ?? "low",
    temperature: opts.temperature ?? 0.8,
    ...(opts.json === false ? {} : { response_format: { type: "json_object" } }),
  };
  const t0 = performance.now();
  let res: Response;
  try {
    const deadline = Date.now() + timeoutMs;
    for (let attempt = 0; ; attempt++) {
      try {
        res = await fetch(`${env.base}/chat/completions`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${env.key}` },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(Math.max(1000, deadline - Date.now())),
        });
        break;
      } catch (err) {
        // Connection-level failures (DNS, reset before a response) never reached the model: retry a couple of times.
        if ((err as Error).name === "TimeoutError" || attempt >= 2 || Date.now() > deadline - 2000) throw err;
        console.error(`[llm] ${(err as Error).message}; retrying (${attempt + 1}/2)`);
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
      }
    }
  } catch (err) {
    const name = (err as Error).name;
    // The request may still be billed: book a worst-case estimate.
    const est = ((JSON.stringify(messages).length / 2.5) * PRICE.input + maxTokens * PRICE.output) / 1e6 * MARGIN;
    book({ id: `sq-${Date.now().toString(36)}`, ts: new Date().toISOString(), task: opts.task ?? "sidequest.generate", model, kind: opts.json === false ? "text" : "json", status: "error", reservedUsd: est, costUsd: est, note: name });
    throw new LLMError(name === "TimeoutError" ? `timeout after ${timeoutMs}ms` : `network: ${(err as Error).message}`);
  }
  const raw = await res.text();
  const ms = Math.round(performance.now() - t0);
  let data: Completion & { error?: { message?: string } } = {};
  try {
    data = JSON.parse(raw);
  } catch {
    /* non-JSON error body */
  }
  const u = data.usage ?? {};
  const cached = u.prompt_tokens_details?.cached_tokens ?? 0;
  const costUsd = u.prompt_tokens
    ? (((u.prompt_tokens - cached) * PRICE.input + cached * PRICE.cached + (u.completion_tokens ?? 0) * PRICE.output) / 1e6) * MARGIN
    : ((JSON.stringify(messages).length / 2.5) * PRICE.input + maxTokens * PRICE.output) / 1e6 * MARGIN;
  book({
    id: `sq-${Date.now().toString(36)}`,
    ts: new Date().toISOString(),
    task: opts.task ?? "sidequest.generate",
    model,
    kind: opts.json === false ? "text" : "json",
    status: res.ok ? "ok" : "error",
    reservedUsd: costUsd,
    costUsd,
    promptTokens: u.prompt_tokens,
    cachedTokens: cached,
    completionTokens: u.completion_tokens,
    note: `${ms}ms`,
  });
  if (!res.ok) throw new LLMError(data.error?.message ?? `Model API ${res.status}: ${raw.slice(0, 200)}`, res.status);
  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text.trim()) throw new LLMError(`empty completion (finish_reason=${data.choices?.[0]?.finish_reason})`);
  return { text, ms, costUsd, finish: data.choices?.[0]?.finish_reason };
}

/** Pull the first JSON object out of a completion (tolerates ```json fences or stray prose). */
export function extractJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
  try {
    return JSON.parse(t);
  } catch {
    const a = t.indexOf("{"), b = t.lastIndexOf("}");
    if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
    throw new SyntaxError("no JSON object in completion");
  }
}

const IMAGE_USD = 0.15; // per image, deliberately high (same estimate as the app's ledger)
/** One generated image (PNG bytes) from the Meta image model. Booked in the ledger like text calls. */
export async function generateImage(prompt: string, opts: { size?: string; task?: string; timeoutMs?: number } = {}): Promise<Buffer> {
  const model = process.env.SIDEQUEST_IMAGE_MODEL || process.env.MODEL_IMAGE || "muse-image-1.0";
  const limit = env.budgetUsd - env.reserveUsd;
  if (spentUsd() + IMAGE_USD >= limit) throw new LLMError(`budget guard: $${spentUsd().toFixed(2)} of $${limit} spent`);
  const t0 = performance.now();
  let res: Response | undefined;
  for (let attempt = 0; !res; attempt++) {
    try {
      res = await fetch(`${env.base}/images/generations`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${env.key}` },
        body: JSON.stringify({ model, prompt, n: 1, size: opts.size ?? "1024x1024", response_format: "b64_json" }),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 120000),
      });
    } catch (err) {
      // connection failures never reached the model: retry; a timeout may have, so stop
      if ((err as Error).name === "TimeoutError" || attempt >= 2) throw new LLMError(`image: ${(err as Error).message}`);
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
  }
  const raw = await res.text();
  const ms = Math.round(performance.now() - t0);
  book({ id: `sq-${Date.now().toString(36)}`, ts: new Date().toISOString(), task: opts.task ?? "sidequest.image", model, kind: "image", status: res.ok ? "ok" : "error", reservedUsd: IMAGE_USD, costUsd: res.ok ? IMAGE_USD : 0, images: 1, note: `${ms}ms` });
  let data: { data?: { b64_json?: string; url?: string }[]; error?: { message?: string } } = {};
  try {
    data = JSON.parse(raw);
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok) throw new LLMError(data.error?.message ?? `Image API ${res.status}: ${raw.slice(0, 200)}`, res.status);
  const d = data.data?.[0];
  if (d?.b64_json) return Buffer.from(d.b64_json, "base64");
  if (d?.url) return Buffer.from(await (await fetch(d.url)).arrayBuffer());
  throw new LLMError("image: empty response");
}

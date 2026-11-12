// The AI layer. Server-only. OpenAI-compatible transport against the Meta Model API (Muse), with:
//   ai.text(...)   plain completion (optionally with images as input)
//   ai.json(...)   structured output validated against a JSON schema (with a repair retry)
//   ai.image(...)  image generation
//   ai.tools(...)  tool-calling loop over server-side tools, with an onStep callback for streaming UIs
// Every call is traced for the Inspector, cached on disk when identical, and goes through the budget
// ledger: a worst-case cost is reserved before the request and settled to real usage after. When the
// budget is full (or the API is down) calls fall back to mock and say so in the trace.
import { cacheGet, cacheKey, cacheSet } from "./cache";
import { BudgetExceededError, estimateChatUsd, IMAGE_GEN_USD, ledger, settleChatUsd } from "./ledger";
import { mockFromSchema, mockImage, mockLatency, mockText, mockToolCalls } from "./mock";
import { pushTrace, traceId } from "./trace";
import type { AIMessage, AIMode, CallKind, CallOptions, ContentPart, ImageResult, JSONSchema, JsonResult, TextResult, ToolCall, ToolDef, ToolsResult, Trace, TraceMode, TraceStep, Usage } from "./types";
import { cacheImage } from "@/server/images";

export * from "./types";
export { traces, clearTraces, traceStats } from "./trace";
export { BudgetExceededError, ledger } from "./ledger";

const env = () => ({
  key: process.env.MODEL_API_KEY ?? "",
  base: (process.env.MODEL_API_BASE_URL ?? "https://api.meta.ai/v1").replace(/\/$/, ""),
  text: process.env.MODEL_TEXT ?? "muse-spark-1.3",
  vision: process.env.MODEL_VISION ?? "muse-ember-1.0",
  fast: process.env.MODEL_FAST ?? "muse-ember-1.0",
  image: process.env.MODEL_IMAGE ?? "muse-image-1.0",
  mode: (process.env.AI_MODE ?? "auto") as "auto" | AIMode,
});

export function aiMode(override?: AIMode): AIMode {
  if (override) return override;
  const e = env();
  if (e.mode === "live" || e.mode === "mock") return e.mode;
  return e.key ? "live" : "mock";
}
export function aiStatus() {
  const e = env();
  const budget = ledger().totals();
  return { mode: aiMode(), hasKey: !!e.key, baseUrl: e.base, textModel: e.text, visionModel: e.vision, fastModel: e.fast, imageModel: e.image, configuredMode: e.mode, budget };
}
/** Model ids by role, so features never hardcode an id. */
export const models = { agent: () => env().text, vision: () => env().vision, fast: () => env().fast, image: () => env().image };

export class AIError extends Error {
  constructor(message: string, public status?: number, public body?: unknown) {
    super(message);
  }
}

interface ChatCompletion {
  choices: { message: AIMessage; finish_reason: string }[];
  usage?: Usage;
}
interface ChatBody {
  model: string;
  messages: AIMessage[];
  temperature?: number;
  max_tokens?: number;
  reasoning_effort?: string;
  tools?: unknown[];
  tool_choice?: string;
  response_format?: unknown;
}

const RETRYABLE = (status?: number) => status === undefined || status === 429 || (status >= 500 && status < 600);

async function rawPost<T>(path: string, body: unknown): Promise<T> {
  const e = env();
  let res: Response;
  try {
    res = await fetch(`${e.base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${e.key}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    });
  } catch (err) {
    const cause = (err as { cause?: { code?: string; message?: string } }).cause;
    throw new AIError(`network: ${cause?.code ?? cause?.message ?? (err as Error).message}`);
  }
  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = (data as { error?: { message?: string } })?.error?.message ?? `Model API ${res.status}`;
    throw new AIError(msg, res.status, data);
  }
  return data as T;
}

const promptChars = (body: ChatBody) => JSON.stringify(body.messages).length + JSON.stringify(body.tools ?? "").length + JSON.stringify(body.response_format ?? "").length;
const countImages = (messages: AIMessage[]) => messages.reduce((n, m) => n + (Array.isArray(m.content) ? m.content.filter((p) => p.type === "image_url").length : 0), 0);

/**
 * The one path every chat completion takes: cache → budget reservation → request (one retry on 429/5xx/network)
 * → settle. Returns the completion plus how it was answered and what it cost.
 */
async function chat(body: ChatBody, meta: { task: string; kind: CallKind; cache: boolean }): Promise<{ r: ChatCompletion; mode: TraceMode; costUsd: number }> {
  const key = cacheKey(body);
  if (meta.cache) {
    const hit = cacheGet<ChatCompletion>(key);
    if (hit) return { r: hit, mode: "cached", costUsd: 0 };
  }
  const images = countImages(body.messages);
  const est = estimateChatUsd(body.model, promptChars(body), body.max_tokens ?? 1024, images);
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    // Throws BudgetExceededError when the ledger is full; callers turn that into a mock fallback.
    const id = ledger().reserve({ task: meta.task, model: body.model, kind: meta.kind, reservedUsd: est, images, attempt });
    try {
      const r = await rawPost<ChatCompletion>("/chat/completions", body);
      const settled = r.usage ? settleChatUsd(body.model, r.usage) : { usd: est, cached: 0 };
      ledger().settle(id, { costUsd: settled.usd, promptTokens: r.usage?.prompt_tokens, cachedTokens: settled.cached, completionTokens: r.usage?.completion_tokens, note: r.usage ? undefined : "no usage in response; booked the estimate" });
      if (meta.cache && r.choices?.length) cacheSet(key, r);
      return { r, mode: "live", costUsd: settled.usd };
    } catch (err) {
      lastErr = err;
      ledger().fail(id, (err as Error).message);
      const status = (err as AIError).status;
      if (attempt < 3 && RETRYABLE(status)) {
        await new Promise((res) => setTimeout(res, 700 * attempt));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

/** GET /v1/models, so the Inspector can show which model IDs this key can use. */
export async function listModels(): Promise<string[]> {
  const e = env();
  const res = await fetch(`${e.base}/models`, { headers: { authorization: `Bearer ${e.key}` } });
  if (!res.ok) throw new AIError(`Model API ${res.status}: ${await res.text()}`, res.status);
  const data = (await res.json()) as { data?: { id: string }[] };
  return (data.data ?? []).map((m) => m.id);
}

function begin(kind: CallKind, opts: CallOptions, request: Trace["request"], model: string): Trace {
  return { id: traceId(), task: opts.task, kind, mode: aiMode(opts.mode), model, userId: opts.userId, startedAt: new Date().toISOString(), latencyMs: 0, request };
}
function finish(t: Trace, start: number, patch: Partial<Trace>) {
  t.latencyMs = Math.round(performance.now() - start);
  Object.assign(t, patch);
  pushTrace(t);
  return t;
}
/** Live was wanted but is impossible (budget full, API down): answer with mock and label it. */
function shouldFallback(err: unknown) {
  if (err instanceof BudgetExceededError) return "budget";
  const status = (err as AIError).status;
  if (status === undefined || status === 429 || status >= 500) return "api-unavailable";
  return null;
}

const asMessages = (input: string | AIMessage[], system?: string): AIMessage[] => {
  const msgs: AIMessage[] = typeof input === "string" ? [{ role: "user", content: input }] : [...input];
  if (system && !msgs.some((m) => m.role === "system")) msgs.unshift({ role: "system", content: system });
  return msgs;
};

/** Turn an image reference into a data: URI the API accepts. */
export async function imageToDataUri(ref: string): Promise<string | null> {
  if (ref.startsWith("data:")) return ref;
  const m = ref.match(/^\/api\/img\?u=(.+)$/);
  const url = m ? decodeURIComponent(m[1]) : ref;
  if (/^https?:\/\//.test(url)) {
    const img = await cacheImage(url);
    return img ? `data:${img.type.split(";")[0]};base64,${img.buf.toString("base64")}` : null;
  }
  try {
    const { readFileSync } = await import("node:fs");
    const buf = readFileSync(url);
    const type = url.endsWith(".png") ? "image/png" : url.endsWith(".webp") ? "image/webp" : "image/jpeg";
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}
async function attachImages(messages: AIMessage[], images?: string[]) {
  if (!images?.length) return 0;
  const last = [...messages].reverse().find((m) => m.role === "user");
  if (!last) return 0;
  const parts: ContentPart[] = typeof last.content === "string" ? [{ type: "text", text: last.content }] : [...(last.content ?? [])];
  let n = 0;
  for (const ref of images) {
    const uri = await imageToDataUri(ref);
    if (uri) {
      parts.push({ type: "image_url", image_url: { url: uri } });
      n++;
    }
  }
  last.content = parts;
  return n;
}
const textOf = (m?: AIMessage) => (typeof m?.content === "string" ? m.content : (m?.content ?? []).map((p) => (p.type === "text" ? p.text : "")).join(""));

export const SYSTEM_BASE = `You are an assistant inside a Facebook-style app used by young adults (roughly 18–29). Write in a natural, lowercase-leaning, friendly voice like a real person their age; never corporate. Keep answers tight. Never invent people, places, posts or events that aren't in the provided context or tool results.`;

async function text(input: string | AIMessage[], opts: CallOptions & { system?: string }): Promise<TextResult> {
  const e = env();
  const model = opts.model ?? (opts.images?.length ? e.vision : e.text);
  const messages = asMessages(input, opts.system ?? SYSTEM_BASE);
  const nImg = await attachImages(messages, opts.images);
  const t = begin("text", opts, { messages, images: nImg }, model);
  const start = performance.now();
  const mock = async (fallback?: string) => {
    await mockLatency();
    const out = (opts.mock?.() as string | undefined) ?? mockText(opts.task, messages);
    return { text: out, trace: finish(t, start, { response: out, mode: "mock", fallback, costUsd: 0 }) };
  };
  if (t.mode === "mock") return mock();
  try {
    const { r, mode, costUsd } = await chat({ model, messages, temperature: opts.temperature ?? 0.7, max_tokens: opts.maxTokens ?? 700, reasoning_effort: opts.reasoningEffort ?? "low" }, { task: opts.task, kind: "text", cache: opts.cache ?? true });
    const out = textOf(r.choices[0]?.message);
    return { text: out, trace: finish(t, start, { response: out, usage: r.usage, mode, costUsd }) };
  } catch (err) {
    const fb = shouldFallback(err);
    if (fb) return mock(fb);
    finish(t, start, { error: (err as Error).message });
    throw err;
  }
}

function extractJson(s: string) {
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : s;
  const first = body.search(/[[{]/);
  return JSON.parse(first >= 0 ? body.slice(first) : body);
}

async function json<T = unknown>(input: string | AIMessage[], opts: CallOptions & { schema: JSONSchema; schemaName?: string; system?: string }): Promise<JsonResult<T>> {
  const e = env();
  const model = opts.model ?? (opts.images?.length ? e.vision : e.text);
  const messages = asMessages(input, opts.system ?? SYSTEM_BASE);
  const nImg = await attachImages(messages, opts.images);
  messages.push({ role: "system", content: `Respond with ONLY a JSON object matching this JSON Schema, no prose:\n${JSON.stringify(opts.schema)}` });
  const t = begin("json", opts, { messages, schema: opts.schema, images: nImg }, model);
  const start = performance.now();
  const mock = async (fallback?: string) => {
    await mockLatency();
    const data = ((opts.mock?.() as T | undefined) ?? mockFromSchema(opts.schema, opts.task + textOf(messages.at(-2)))) as T;
    return { data, trace: finish(t, start, { response: data, mode: "mock", fallback, costUsd: 0 }) };
  };
  if (t.mode === "mock") return mock();
  const meta = { task: opts.task, kind: "json" as const, cache: opts.cache ?? true };
  try {
    const body: ChatBody = {
      model,
      messages,
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.maxTokens ?? 1200,
      reasoning_effort: opts.reasoningEffort ?? "low",
      response_format: { type: "json_schema", json_schema: { name: opts.schemaName ?? "result", schema: opts.schema, strict: false } },
    };
    let res: Awaited<ReturnType<typeof chat>>;
    try {
      res = await chat(body, meta);
    } catch (err) {
      // Some gateways reject json_schema; fall back to json_object, then plain.
      if ((err as AIError).status !== 400) throw err;
      try {
        res = await chat({ ...body, response_format: { type: "json_object" } }, meta);
      } catch {
        const { response_format: _rf, ...plain } = body;
        void _rf;
        res = await chat(plain, meta);
      }
    }
    let data: T;
    let costUsd = res.costUsd;
    const raw = textOf(res.r.choices[0]?.message);
    try {
      data = extractJson(raw) as T;
    } catch {
      // one repair pass
      const fix = await chat({ model, temperature: 0, max_tokens: opts.maxTokens ?? 1200, reasoning_effort: "low", messages: [...messages, { role: "assistant", content: raw }, { role: "user", content: "That was not valid JSON. Return only the corrected JSON object." }] }, meta);
      costUsd += fix.costUsd;
      data = extractJson(textOf(fix.r.choices[0]?.message)) as T;
    }
    return { data, trace: finish(t, start, { response: data, usage: res.r.usage, mode: res.mode, costUsd }) };
  } catch (err) {
    const fb = shouldFallback(err);
    if (fb) return mock(fb);
    finish(t, start, { error: (err as Error).message });
    throw err;
  }
}

async function image(prompt: string, opts: CallOptions & { size?: string }): Promise<ImageResult> {
  const e = env();
  const model = opts.model ?? e.image;
  const size = opts.size ?? "1024x1024";
  const t = begin("image", opts, { prompt, size }, model);
  const start = performance.now();
  const mock = async (fallback?: string) => {
    await mockLatency();
    const url = mockImage(prompt, size);
    return { url, trace: finish(t, start, { response: url, mode: "mock", fallback, costUsd: 0 }) };
  };
  if (t.mode === "mock") return mock();
  let id: string | undefined;
  try {
    id = ledger().reserve({ task: opts.task, model, kind: "image", reservedUsd: IMAGE_GEN_USD, images: 1 });
    const r = await rawPost<{ data: { url?: string; b64_json?: string }[] }>("/images/generations", { model, prompt, n: 1, size, response_format: "b64_json" });
    ledger().settle(id, { costUsd: IMAGE_GEN_USD });
    const d = r.data[0];
    const url = d.url ?? `data:image/png;base64,${d.b64_json}`;
    return { url, trace: finish(t, start, { response: d.url ?? "<b64 image>", mode: "live", costUsd: IMAGE_GEN_USD }) };
  } catch (err) {
    if (id) ledger().fail(id, (err as Error).message);
    const fb = shouldFallback(err);
    if (fb) return mock(fb);
    finish(t, start, { error: (err as Error).message });
    throw err;
  }
}

export interface ToolsOptions extends CallOptions {
  tools: ToolDef[];
  system?: string;
  /** Hard cap on model round-trips so a looping agent cannot burn the budget. Default 6. */
  maxSteps?: number;
  /** Called as the loop progresses: streaming UIs forward these to the client. */
  onStep?: (step: TraceStep) => void;
  /** Force the first call to use a tool. */
  toolChoice?: "auto" | "required";
  /** End the loop as soon as this tool has run (its args are the structured answer). Saves a model round-trip. */
  stopOnTool?: string;
}

async function tools(input: string | AIMessage[], opts: ToolsOptions): Promise<ToolsResult> {
  const e = env();
  const model = opts.model ?? e.text;
  const messages = asMessages(input, opts.system ?? SYSTEM_BASE);
  const t = begin("tools", opts, { messages: [...messages], tools: opts.tools.map((x) => x.name) }, model);
  const steps: TraceStep[] = [];
  const push = (s: TraceStep) => {
    steps.push(s);
    opts.onStep?.(s);
  };
  const start = performance.now();
  const userId = opts.userId ?? "maya";
  const toolSpecs = opts.tools.map((x) => ({ type: "function", function: { name: x.name, description: x.description, parameters: x.parameters } }));

  const runCalls = async (calls: ToolCall[]) => {
    for (const c of calls) {
      const def = opts.tools.find((x) => x.name === c.function.name);
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(c.function.arguments || "{}");
      } catch {
        /* keep {} */
      }
      push({ type: "tool_call", name: c.function.name, args });
      const s0 = performance.now();
      let result: unknown;
      try {
        result = def ? await def.run(args, { userId }) : { error: `Unknown tool ${c.function.name}` };
      } catch (err) {
        result = { error: (err as Error).message };
      }
      push({ type: "tool_result", name: c.function.name, result, latencyMs: Math.round(performance.now() - s0) });
      messages.push({ role: "tool", tool_call_id: c.id, name: c.function.name, content: JSON.stringify(result).slice(0, 16000) });
    }
  };

  const mock = async (fallback?: string) => {
    await mockLatency();
    const calls = mockToolCalls(opts.tools, messages, userId);
    messages.push({ role: "assistant", content: null, tool_calls: calls });
    await runCalls(calls);
    const lastResult = steps.filter((s) => s.type === "tool_result").at(-1)?.result;
    const text = (opts.mock?.() as string | undefined) ?? `(mock) I used ${calls.map((c) => c.function.name).join(", ")} and got ${JSON.stringify(lastResult).slice(0, 160)}… With a real key, Muse would write the answer from this.`;
    return { text, steps, trace: finish(t, start, { response: text, steps, mode: "mock", fallback, costUsd: 0 }) };
  };
  if (t.mode === "mock") return mock();

  try {
    let usage: Usage | undefined;
    let costUsd = 0;
    let mode: TraceMode = "live";
    const maxSteps = Math.min(opts.maxSteps ?? 6, 12);
    for (let i = 0; i < maxSteps; i++) {
      const s0 = performance.now();
      const last = i === maxSteps - 1;
      const { r, mode: m, costUsd: c } = await chat(
        {
          model,
          messages,
          tools: last ? undefined : toolSpecs,
          // The Meta Model API only accepts tool_choice "auto" (observed 2026-11-12); "required" is prompted instead.
          tool_choice: last ? undefined : "auto",
          temperature: opts.temperature ?? 0.3,
          max_tokens: opts.maxTokens ?? 1200,
          reasoning_effort: opts.reasoningEffort ?? "low",
        },
        { task: opts.task, kind: "tools", cache: opts.cache ?? true },
      );
      costUsd += c;
      if (m === "live") mode = "live";
      else if (i === 0) mode = m;
      usage = r.usage ?? usage;
      const msg = r.choices[0]?.message;
      push({ type: "model", latencyMs: Math.round(performance.now() - s0), result: msg?.tool_calls?.length ? `${msg.tool_calls.length} tool call(s)` : "final answer", mode: m });
      messages.push(msg);
      if (!msg?.tool_calls?.length) {
        const text = textOf(msg);
        return { text, steps, trace: finish(t, start, { response: text, steps, usage, mode, costUsd }) };
      }
      await runCalls(msg.tool_calls);
      if (opts.stopOnTool && msg.tool_calls.some((c) => c.function.name === opts.stopOnTool)) {
        const text = textOf(msg);
        return { text, steps, trace: finish(t, start, { response: text, steps, usage, mode, costUsd }) };
      }
    }
    throw new AIError("Tool loop exceeded maxSteps");
  } catch (err) {
    const fb = shouldFallback(err);
    if (fb) return mock(fb);
    finish(t, start, { error: (err as Error).message, steps });
    throw err;
  }
}

export const ai = { text, json, image, tools, mode: aiMode, status: aiStatus, listModels, models };

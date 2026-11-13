// The AI layer. Server-only. OpenAI-compatible transport against the Meta Model API (Muse), with:
//   ai.text(...)   plain completion
//   ai.json(...)   structured output validated against a JSON schema (with a repair retry)
//   ai.image(...)  image generation
//   ai.tools(...)  tool-calling loop over server-side tools
// Every call is traced for the Inspector. Mock mode needs no key or network.
import { mockFromSchema, mockImage, mockLatency, mockText, mockToolCalls } from "./mock";
import { pushTrace, traceId } from "./trace";
import type { AIMessage, AIMode, CallKind, CallOptions, ImageResult, JSONSchema, JsonResult, TextResult, ToolCall, ToolDef, ToolsResult, Trace, TraceStep, Usage } from "./types";
import "@/server/net"; // prefer IPv4 for outbound calls

export * from "./types";
export { traces, clearTraces, traceStats } from "./trace";

const env = () => ({
  key: process.env.MODEL_API_KEY ?? "",
  base: (process.env.MODEL_API_BASE_URL ?? "https://api.meta.ai/v1").replace(/\/$/, ""),
  text: process.env.MODEL_TEXT ?? "muse-spark",
  image: process.env.MODEL_IMAGE ?? "muse-image",
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
  return { mode: aiMode(), hasKey: !!e.key, baseUrl: e.base, textModel: e.text, imageModel: e.image, configuredMode: e.mode };
}

export class AIError extends Error {
  constructor(message: string, public status?: number, public body?: unknown) {
    super(message);
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const e = env();
  const res = await fetch(`${e.base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${e.key}` },
    body: JSON.stringify(body),
  });
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

/** GET /v1/models, so the Inspector can show which model IDs this key can use. */
export async function listModels(): Promise<string[]> {
  const e = env();
  const res = await fetch(`${e.base}/models`, { headers: { authorization: `Bearer ${e.key}` } });
  if (!res.ok) throw new AIError(`Model API ${res.status}: ${await res.text()}`, res.status);
  const data = (await res.json()) as { data?: { id: string }[] };
  return (data.data ?? []).map((m) => m.id);
}

interface ChatCompletion {
  choices: { message: AIMessage; finish_reason: string }[];
  usage?: Usage;
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

const asMessages = (input: string | AIMessage[], system?: string): AIMessage[] => {
  const msgs: AIMessage[] = typeof input === "string" ? [{ role: "user", content: input }] : [...input];
  if (system && !msgs.some((m) => m.role === "system")) msgs.unshift({ role: "system", content: system });
  return msgs;
};

export const SYSTEM_BASE = `You are an assistant inside a Facebook-style app used by young adults (roughly 18–29) in Austin, TX. Write in a natural, lowercase-leaning, friendly voice like a real person their age; never corporate. Keep answers tight. Never invent people or events that aren't in the provided context.`;

async function text(input: string | AIMessage[], opts: CallOptions & { system?: string }): Promise<TextResult> {
  const e = env();
  const model = opts.model ?? e.text;
  const messages = asMessages(input, opts.system ?? SYSTEM_BASE);
  const t = begin("text", opts, { messages }, model);
  const start = performance.now();
  try {
    if (t.mode === "mock") {
      await mockLatency();
      const out = (opts.mock?.() as string | undefined) ?? mockText(opts.task, messages);
      return { text: out, trace: finish(t, start, { response: out }) };
    }
    const r = await post<ChatCompletion>("/chat/completions", { model, messages, temperature: opts.temperature ?? 0.8, max_tokens: opts.maxTokens ?? 600 });
    const out = r.choices[0]?.message.content ?? "";
    return { text: out, trace: finish(t, start, { response: out, usage: r.usage }) };
  } catch (err) {
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
  const model = opts.model ?? e.text;
  const messages = asMessages(input, opts.system ?? SYSTEM_BASE);
  messages.push({ role: "system", content: `Respond with ONLY a JSON object matching this JSON Schema, no prose:\n${JSON.stringify(opts.schema)}` });
  const t = begin("json", opts, { messages, schema: opts.schema }, model);
  const start = performance.now();
  try {
    if (t.mode === "mock") {
      await mockLatency();
      const data = ((opts.mock?.() as T | undefined) ?? mockFromSchema(opts.schema, opts.task + JSON.stringify(messages.at(-2)?.content ?? ""))) as T;
      return { data, trace: finish(t, start, { response: data }) };
    }
    const body = {
      model,
      messages,
      temperature: opts.temperature ?? 0.4,
      max_tokens: opts.maxTokens ?? 900,
      ...(opts.reasoning ? { reasoning_effort: opts.reasoning } : {}),
      response_format: { type: "json_schema", json_schema: { name: opts.schemaName ?? "result", schema: opts.schema, strict: false } },
    };
    let r: ChatCompletion;
    try {
      r = await post<ChatCompletion>("/chat/completions", body);
    } catch (err) {
      // Some gateways reject json_schema; fall back to json_object, then plain.
      if ((err as AIError).status !== 400) throw err;
      try {
        r = await post<ChatCompletion>("/chat/completions", { ...body, response_format: { type: "json_object" } });
      } catch {
        const { response_format: _rf, ...plain } = body;
        void _rf;
        r = await post<ChatCompletion>("/chat/completions", plain);
      }
    }
    let data: T;
    try {
      data = extractJson(r.choices[0]?.message.content ?? "{}") as T;
    } catch {
      // one repair pass
      const fix = await post<ChatCompletion>("/chat/completions", { model, temperature: 0, messages: [...messages, { role: "assistant", content: r.choices[0]?.message.content ?? "" }, { role: "user", content: "That was not valid JSON. Return only the corrected JSON object." }] });
      data = extractJson(fix.choices[0]?.message.content ?? "{}") as T;
    }
    return { data, trace: finish(t, start, { response: data, usage: r.usage }) };
  } catch (err) {
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
  try {
    if (t.mode === "mock") {
      await mockLatency();
      const url = mockImage(prompt, size);
      return { url, trace: finish(t, start, { response: url }) };
    }
    const r = await post<{ data: { url?: string; b64_json?: string }[] }>("/images/generations", { model, prompt, n: 1, size, response_format: "b64_json" });
    const d = r.data[0];
    const url = d.url ?? `data:image/png;base64,${d.b64_json}`;
    return { url, trace: finish(t, start, { response: d.url ?? "<b64 image>" }) };
  } catch (err) {
    finish(t, start, { error: (err as Error).message });
    throw err;
  }
}

async function tools(input: string | AIMessage[], opts: CallOptions & { tools: ToolDef[]; system?: string; maxSteps?: number }): Promise<ToolsResult> {
  const e = env();
  const model = opts.model ?? e.text;
  const messages = asMessages(input, opts.system ?? SYSTEM_BASE);
  const t = begin("tools", opts, { messages: [...messages], tools: opts.tools.map((x) => x.name) }, model);
  const steps: TraceStep[] = [];
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
      steps.push({ type: "tool_call", name: c.function.name, args });
      const s0 = performance.now();
      let result: unknown;
      try {
        result = def ? await def.run(args, { userId }) : { error: `Unknown tool ${c.function.name}` };
      } catch (err) {
        result = { error: (err as Error).message };
      }
      steps.push({ type: "tool_result", name: c.function.name, result, latencyMs: Math.round(performance.now() - s0) });
      messages.push({ role: "tool", tool_call_id: c.id, name: c.function.name, content: JSON.stringify(result).slice(0, 12000) });
    }
  };

  try {
    if (t.mode === "mock") {
      await mockLatency();
      const calls = mockToolCalls(opts.tools, messages, userId);
      messages.push({ role: "assistant", content: null, tool_calls: calls });
      await runCalls(calls);
      const lastResult = steps.filter((s) => s.type === "tool_result").at(-1)?.result;
      const text = `(mock) I used ${calls.map((c) => c.function.name).join(", ")} and got ${JSON.stringify(lastResult).slice(0, 160)}… With a real key, Muse would write the answer from this.`;
      return { text, steps, trace: finish(t, start, { response: text, steps }) };
    }
    let usage: Usage | undefined;
    for (let i = 0; i < (opts.maxSteps ?? 6); i++) {
      const s0 = performance.now();
      const r = await post<ChatCompletion>("/chat/completions", { model, messages, tools: toolSpecs, tool_choice: "auto", temperature: opts.temperature ?? 0.4, max_tokens: opts.maxTokens ?? 900 });
      usage = r.usage ?? usage;
      const msg = r.choices[0]?.message;
      steps.push({ type: "model", latencyMs: Math.round(performance.now() - s0), result: msg?.tool_calls ? `${msg.tool_calls.length} tool call(s)` : "final answer" });
      messages.push(msg);
      if (!msg?.tool_calls?.length) {
        const text = msg?.content ?? "";
        return { text, steps, trace: finish(t, start, { response: text, steps, usage }) };
      }
      await runCalls(msg.tool_calls);
    }
    throw new AIError("Tool loop exceeded maxSteps");
  } catch (err) {
    finish(t, start, { error: (err as Error).message, steps });
    throw err;
  }
}

export const ai = { text, json, image, tools, mode: aiMode, status: aiStatus, listModels };

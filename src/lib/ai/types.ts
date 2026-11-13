// One reusable AI layer. Import `ai` from "@/lib/ai" and never call the Model API directly.

export type Role = "system" | "user" | "assistant" | "tool";

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

/** OpenAI-style multimodal content part. Images are always data: URIs (the API refuses most public URLs). */
export type ContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

export interface AIMessage {
  role: Role;
  content: string | ContentPart[] | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export type JSONSchema = Record<string, unknown>;

export interface ToolDef<TArgs = Record<string, unknown>, TResult = unknown> {
  name: string;
  description: string;
  parameters: JSONSchema;
  /** Runs server-side. Return anything JSON-serializable. Always scope results to ctx.userId. */
  run: (args: TArgs, ctx: { userId: string }) => Promise<TResult> | TResult;
}

export type ReasoningEffort = "low" | "medium" | "high";

export interface CallOptions {
  /** Short label shown in the Inspector, e.g. "travel.discover". */
  task: string;
  /** Acting user, for tools and personalization. */
  userId?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Muse models reason before answering; "low" keeps hidden reasoning tokens small. Default low. */
  reasoningEffort?: ReasoningEffort;
  /** Images to attach to the last user message: data: URIs, /api/img?u= URLs (read from the local cache) or local file paths. */
  images?: string[];
  /** Force a mode for this one call. */
  mode?: AIMode;
  /** Serve identical requests from the on-disk cache (default true). */
  cache?: boolean;
  /** What to return in mock mode. Build it from real store data so demos look right without a key. */
  mock?: () => unknown;
}

export type AIMode = "live" | "mock";
/** How a traced call was actually answered. */
export type TraceMode = "live" | "mock" | "cached" | "replay";
export type CallKind = "text" | "json" | "image" | "tools";

export interface Usage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
  completion_tokens_details?: { reasoning_tokens?: number };
}

export interface TraceStep {
  type: "tool_call" | "tool_result" | "model";
  name?: string;
  args?: unknown;
  result?: unknown;
  latencyMs?: number;
  mode?: TraceMode;
}

export interface Trace {
  id: string;
  task: string;
  kind: CallKind;
  mode: TraceMode;
  model: string;
  userId?: string;
  startedAt: string;
  latencyMs: number;
  request: { messages?: AIMessage[]; prompt?: string; schema?: JSONSchema; tools?: string[]; size?: string; images?: number };
  response?: unknown;
  usage?: Usage;
  /** Booked cost in USD (with margin). 0 for mock/cached. */
  costUsd?: number;
  steps?: TraceStep[];
  error?: string;
  /** Set when the call wanted live but was answered another way (budget guard, API down). */
  fallback?: string;
}

export interface TextResult {
  text: string;
  trace: Trace;
}
export interface JsonResult<T> {
  data: T;
  trace: Trace;
}
export interface ImageResult {
  /** URL or data: URI. */
  url: string;
  trace: Trace;
}
export interface ToolsResult {
  text: string;
  steps: TraceStep[];
  trace: Trace;
}

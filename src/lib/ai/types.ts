// One reusable AI layer. Import `ai` from "@/lib/ai" and never call the Model API directly.

export type Role = "system" | "user" | "assistant" | "tool";

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface AIMessage {
  role: Role;
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export type JSONSchema = Record<string, unknown>;

export interface ToolDef<TArgs = Record<string, unknown>, TResult = unknown> {
  name: string;
  description: string;
  parameters: JSONSchema;
  /** Runs server-side. Return anything JSON-serializable. */
  run: (args: TArgs, ctx: { userId: string }) => Promise<TResult> | TResult;
}

export interface CallOptions {
  /** Short label shown in the Inspector, e.g. "compose.rewrite". */
  task: string;
  /** Acting user, for tools and personalization. */
  userId?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Reasoning effort for Muse (a reasoning model): thinking counts against maxTokens, so keep it low for short JSON. */
  reasoning?: "minimal" | "low" | "medium" | "high";
  /** Force a mode for this one call. */
  mode?: AIMode;
  /** What to return in mock mode. Build it from real store data so demos look right without a key. */
  mock?: () => unknown;
}

export type AIMode = "live" | "mock";
export type CallKind = "text" | "json" | "image" | "tools";

export interface Usage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface TraceStep {
  type: "tool_call" | "tool_result" | "model";
  name?: string;
  args?: unknown;
  result?: unknown;
  latencyMs?: number;
}

export interface Trace {
  id: string;
  task: string;
  kind: CallKind;
  mode: AIMode;
  model: string;
  userId?: string;
  startedAt: string;
  latencyMs: number;
  request: { messages?: AIMessage[]; prompt?: string; schema?: JSONSchema; tools?: string[]; size?: string };
  response?: unknown;
  usage?: Usage;
  steps?: TraceStep[];
  error?: string;
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

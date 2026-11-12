// Mock mode: no key, no network, deterministic, instant-ish. Produces schema-valid JSON for any schema,
// task-aware canned text for the built-in features, and placeholder images.
import { photoUrl } from "@/lib/img";
import type { AIMessage, JSONSchema, ToolCall, ToolDef } from "./types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const mockLatency = () => sleep(250 + Math.random() * 450);

function hash(s: string) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
}
const pick = <T,>(arr: T[], seed: string) => arr[hash(seed) % arr.length];

const lastUser = (messages: AIMessage[]) => [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

/** Task-specific canned text; falls back to a generic but plausible reply. */
export function mockText(task: string, messages: AIMessage[]): string {
  const prompt = lastUser(messages);
  const canned: Record<string, string[]> = {
    "compose.rewrite": [
      "ok real talk: Saturday is the day. birria, al pastor, mushroom tinga, horchata. Hotel Vegas patio, 11am. come hungry and bring someone who says they 'don't like tacos' so we can fix them 🌮",
      "two years of saying 'I should sell this.' this Saturday I actually am. 400 tacos, one patio, zero regrets. 11am at Hotel Vegas, first 20 people get a free agua fresca.",
    ],
    "compose.ideas": [
      "first bowl that didn't collapse on the wheel today. 7 weeks. she's lopsided and I love her 🏺",
      "Tuesday run was 62° and perfect. if you've been thinking about coming, this is the week. 6:30 at the sign, all paces, P. Terry's after.",
      "signed up for the Austin Half with the run club. 12 weeks. sub 1:50 or I'm never posting again",
    ],
  };
  if (canned[task]) return pick(canned[task], prompt);
  const words = prompt.split(/\s+/).filter(Boolean).slice(0, 12).join(" ");
  return `(mock) Here's a response to "${words}${prompt.length > 80 ? "…" : ""}". Set MODEL_API_KEY to get a real answer from Muse.`;
}

/** Build a plausible object that satisfies a JSON schema (handles object/array/string/number/boolean/enum). */
export function mockFromSchema(schema: JSONSchema, seed = "x", depth = 0): unknown {
  const type = (schema.type as string) ?? (schema.properties ? "object" : "string");
  if (Array.isArray(schema.enum)) return pick(schema.enum as unknown[], seed);
  switch (type) {
    case "object": {
      const out: Record<string, unknown> = {};
      const props = (schema.properties ?? {}) as Record<string, JSONSchema>;
      for (const [k, v] of Object.entries(props)) out[k] = mockFromSchema(v, seed + k, depth + 1);
      return out;
    }
    case "array": {
      const n = depth > 2 ? 1 : 2 + (hash(seed) % 2);
      return Array.from({ length: n }, (_, i) => mockFromSchema((schema.items ?? { type: "string" }) as JSONSchema, seed + i, depth + 1));
    }
    case "number":
    case "integer":
      return (hash(seed) % 90) + 10;
    case "boolean":
      return hash(seed) % 2 === 0;
    default: {
      const desc = (schema.description as string) ?? "";
      return desc ? `${desc.replace(/\.$/, "")} (mock)` : pick(["Looks great", "Worth checking out", "Popular with friends", "Trending this week"], seed);
    }
  }
}

/** Mock tool loop: call the first tool once with schema-derived args, then answer. */
export function mockToolCalls(tools: ToolDef[], messages: AIMessage[], userId = "maya"): ToolCall[] {
  if (!tools.length) return [];
  const prompt = lastUser(messages);
  // Prefer a tool whose required ids we can satisfy from the prompt; fill ids from the prompt or the acting user.
  const quoted = [...prompt.matchAll(/"([a-z0-9_]+)"/gi)].map((m) => m[1]);
  const t = tools.find((x) => x.name === "get_group_posts" && quoted.some((q) => q.startsWith("g_"))) ?? tools.find((x) => x.name === "get_feed") ?? tools[0];
  const args = mockFromSchema(t.parameters, prompt) as Record<string, unknown>;
  for (const k of Object.keys(args)) {
    if (k === "userId") args[k] = quoted.find((q) => !q.startsWith("g_") && q.length <= 12) ?? userId;
    if (k === "groupId") args[k] = quoted.find((q) => q.startsWith("g_")) ?? "g_runclub";
    if (k === "query") args[k] = prompt.split(/\s+/).slice(0, 3).join(" ");
    if (k === "limit") args[k] = 8;
  }
  return [{ id: `call_mock_${hash(t.name)}`, type: "function", function: { name: t.name, arguments: JSON.stringify(args) } }];
}

export function mockImage(prompt: string, size = "1024x1024") {
  const [w, h] = size.split("x").map(Number);
  return photoUrl(String(hash(prompt)), w || 1024, h || 1024);
}

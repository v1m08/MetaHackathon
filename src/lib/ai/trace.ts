// In-memory ring buffer of every AI call. The Inspector (/dev/ai) reads it via /api/ai/trace.
import type { Trace } from "./types";

const g = globalThis as unknown as { __aitrace?: Trace[] };
const MAX = 200;

export function traces(): Trace[] {
  return (g.__aitrace ??= []);
}
export function pushTrace(t: Trace) {
  const list = traces();
  list.unshift(t);
  if (list.length > MAX) list.length = MAX;
}
export function clearTraces() {
  g.__aitrace = [];
}
export function traceStats() {
  const list = traces().filter((t) => !t.error);
  const avg = list.length ? Math.round(list.reduce((n, t) => n + t.latencyMs, 0) / list.length) : 0;
  return { calls: traces().length, errors: traces().filter((t) => t.error).length, avgLatency: avg };
}
export const traceId = () => `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

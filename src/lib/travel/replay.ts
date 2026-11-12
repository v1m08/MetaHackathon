// Replay mode: when Muse is unreachable (or replay is forced for a demo), Discover and Guide replay a REAL
// recorded run — the same steps with their original timing, trips re-validated against the current store —
// and the UI labels it "Replay of a recorded run". Recordings are made with `npm run record` from real runs.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Guide } from "./guide";
import type { DiscoverRun, StreamStep } from "./store";

export interface Recordings {
  recordedAt: string;
  discover: DiscoverRun[];
  guides: (Guide & { city: string; viewerId: string })[];
}

const FILE = () => process.env.AI_RECORDINGS ?? join(process.cwd(), "src/data/recordings.json");
let cache: Recordings | undefined;
export function recordings(): Recordings {
  if (cache) return cache;
  try {
    cache = existsSync(FILE()) ? (JSON.parse(readFileSync(FILE(), "utf8")) as Recordings) : { recordedAt: "", discover: [], guides: [] };
  } catch {
    cache = { recordedAt: "", discover: [], guides: [] };
  }
  return cache;
}

const g = globalThis as unknown as { __forceReplay?: boolean };
/** Runtime switch (Inspector / runbook): force replay even when the API is up. */
export const forceReplay = () => g.__forceReplay === true || process.env.AI_MODE === "replay";
export const setForceReplay = (v: boolean) => (g.__forceReplay = v);

/** Best matching recorded Discover run: same viewer + weekend + budget, else same viewer + weekend, else same viewer, else any. */
export function findDiscoverRecording(viewerId: string, start: string, budget: number): DiscoverRun | undefined {
  const all = recordings().discover;
  const score = (r: DiscoverRun) => (r.viewerId === viewerId ? 100 : 0) + (r.input.start === start ? 10 : 0) + (r.input.budget === budget ? 1 : 0) + (r.trips.length ? 0.5 : 0);
  return [...all].sort((a, b) => score(b) - score(a))[0];
}
export function findGuideRecording(viewerId: string, city: string) {
  const all = recordings().guides;
  const score = (r: Recordings["guides"][number]) => (r.city === city ? 10 : 0) + (r.viewerId === viewerId ? 1 : 0);
  return [...all].filter((r) => r.city === city).sort((a, b) => score(b) - score(a))[0];
}

/** Re-emit recorded steps with their original pacing (sped up), so the UI looks like a live run. */
export async function replaySteps(steps: StreamStep[], onStep: (s: StreamStep) => void, speed = 2.5) {
  let last = 0;
  const t0 = Date.now();
  for (const s of steps) {
    if (s.kind === "done") break;
    const wait = Math.min(2500, (s.at - last) / speed);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = s.at;
    onStep({ ...s, at: Date.now() - t0 });
  }
  return Date.now() - t0;
}

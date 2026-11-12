// In-memory state for the travel feature (trips the agent proposed, guides, drafts) plus a JSONL record of
// every run on disk (.ai-runs/, gitignored) so real runs can be replayed and animated.
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { TraceStep } from "@/lib/ai";
import type { Trip } from "./validate";

export interface StreamStep {
  i: number;
  at: number; // ms since run start
  kind: "tool" | "result" | "model" | "info" | "done" | "error";
  tool?: string;
  text: string;
  detail?: string;
  /** small structured payload for animations (ids touched) */
  ids?: string[];
}
export interface DiscoverRun {
  id: string;
  viewerId: string;
  input: { start: string; end: string; budget: number; hint?: string };
  steps: StreamStep[];
  rawSteps: TraceStep[];
  /** What the model proposed before validation (for the eval's grounding + privacy numbers). */
  proposal?: { trips: { city: string; hostId?: string; rideId?: string; eventId?: string; peopleIds?: string[]; evidence?: { kind: "post" | "reel"; id: string }[] }[]; declineReason?: string };
  trips: Trip[];
  declineReason?: string;
  mode: string;
  costUsd: number;
  latencyMs: number;
  model: string;
  createdAt: string;
}

const g = globalThis as unknown as { __travel?: { trips: Map<string, Trip>; runs: DiscoverRun[]; guides: Map<string, unknown> } };
const fresh = () => ({ trips: new Map<string, Trip>(), runs: [] as DiscoverRun[], guides: new Map<string, unknown>() });
export const travelStore = () => (g.__travel ??= fresh());
export const resetTravelStore = () => (g.__travel = fresh());

export function saveTrips(trips: Trip[]) {
  for (const t of trips) travelStore().trips.set(t.id, t);
}
export const getTrip = (id: string) => travelStore().trips.get(id);

const RUNS_DIR = () => process.env.AI_RUNS_DIR ?? join(process.cwd(), ".ai-runs");
export function recordRun(run: DiscoverRun) {
  travelStore().runs.unshift(run);
  if (travelStore().runs.length > 50) travelStore().runs.length = 50;
  try {
    mkdirSync(RUNS_DIR(), { recursive: true });
    appendFileSync(join(RUNS_DIR(), "discover.jsonl"), JSON.stringify(run) + "\n");
  } catch {
    /* disk is optional */
  }
}

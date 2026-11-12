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

/** "Your travel style": lines Muse proposed from the user's own content, each with its evidence; user-editable. */
export interface StyleLine { id: string; label: string; text: string; evidence: string; sourceIds: string[]; edited?: boolean }
export interface TravelStyle { userId: string; lines: StyleLine[]; generatedAt: string; mode: string; costUsd: number; model: string; consideredIds: string[] }

/** One date's availability for one person as seen by one requester, decided by code from extracted signals. */
export type DayStatus = "confirmed_free" | "likely_free" | "busy" | "unknown";
export interface DayAvailability { date: string; status: DayStatus; reason?: string; quote?: string; source?: { kind: "rsvp" | "post" | "chat" | "reply"; id: string }; confidence: "high" | "medium" | "low" }
export interface Availability { personId: string; requesterId: string; dates: string[]; days: DayAvailability[]; overall: "confirmed" | "likely_free" | "busy" | "unknown"; summary: string; mode: string; costUsd: number; signalCount: number; computedAt: string; key: string }

/** An Open Door request: traveler's agent asked a host's agent; anonymous until both accept. */
export type RequestStatus = "negotiating" | "proposed" | "declined_by_agent" | "host_accepted" | "traveler_accepted" | "revealed" | "declined";
export interface NegotiationTurn { i: number; at: number; from: "traveler" | "host" | "code"; kind: "ask" | "answer" | "counter" | "scrub" | "info"; text: string; detail?: string; payload?: unknown }
export interface OpenDoorRequest {
  id: string;
  tripId?: string;
  travelerId: string;
  hostId: string;
  tier: "friends" | "fof" | "network";
  ask: { start: string; end: string; guests: number; offer: string };
  status: RequestStatus;
  decision: "yes" | "conditions" | "no";
  conditions: string[];
  alternativeDates?: { start: string; end: string };
  fit: { reasons: { text: string; side: "host" | "traveler"; evidence: string }[]; score: number };
  /** What each side sees before the reveal. No names, no avatars. */
  anon: { forHost: string; forTraveler: string };
  turns: NegotiationTurn[];
  hostAccepted?: boolean;
  travelerAccepted?: boolean;
  revealedAt?: string;
  conversationId?: string;
  mode: string;
  costUsd: number;
  createdAt: string;
}

const g = globalThis as unknown as { __travel?: { trips: Map<string, Trip>; runs: DiscoverRun[]; guides: Map<string, unknown>; styles: Map<string, TravelStyle>; availability: Map<string, Availability>; requests: OpenDoorRequest[] } };
const fresh = () => ({ trips: new Map<string, Trip>(), runs: [] as DiscoverRun[], guides: new Map<string, unknown>(), styles: new Map<string, TravelStyle>(), availability: new Map<string, Availability>(), requests: [] as OpenDoorRequest[] });
export const travelStore = () => {
  const t = (g.__travel ??= fresh());
  // hot reload can leave an older-shaped store on globalThis; fill in anything missing
  t.styles ??= new Map(); t.availability ??= new Map(); t.requests ??= []; t.guides ??= new Map();
  return t;
};
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

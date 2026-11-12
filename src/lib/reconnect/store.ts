// In-memory state for Reconnect: private "I miss them" picks, cached why-now nudges, the daily nudge per person,
// and plans the gathering agent proposed. Survives hot reloads on globalThis; resets with the seed.
import type { ID } from "@/types";
import type { CostBreakdown } from "@/lib/travel/pricing";
import type { DayAvailability } from "@/lib/travel/store";
import { seededMisses } from "@/data/reconnect";

export interface Evidence {
  id: string;
  kind: "photo" | "post" | "chat" | "event" | "fact";
  date: string; // YYYY-MM-DD
  people: ID[];
  text: string;
  image?: string;
  /** Where to open it in the app. */
  href?: string;
}

export interface Nudge {
  id: string;
  viewerId: ID;
  friendId: ID;
  /** The friend's new post that made this timely (never cited as evidence). */
  triggerId?: string;
  line: string;
  evidenceIds: string[];
  evidence: Evidence[];
  suggestion: "plan" | "hi";
  mutual: boolean;
  mode: string;
  costUsd: number;
  createdAt: string;
  /** Set when code refused what the model wrote; nothing with a `dropped` reason is ever shown. */
  dropped?: string;
  /** What the model originally returned, for the Inspector and the eval. */
  raw?: { line: string; evidenceIds: string[] };
}

export type PlanShape = "visit" | "hangout" | "event" | "call";
export interface PlanPerson {
  id: ID;
  name: string;
  avatar: string;
  connection: string;
  city?: string;
  availability: "confirmed" | "likely_free" | "busy" | "unknown";
  days: DayAvailability[];
  summary: string;
  /** Said yes inside the app (tapped "I'm in"). */
  joinedAt?: string;
}
export interface Plan {
  id: string;
  ownerId: ID;
  /** Who this plan is for: a person, or a crew (group chat id). */
  target: { personIds: ID[]; crewId?: string; crewName?: string };
  shape: PlanShape;
  title: string;
  pitch: string;
  reasons: string[];
  start: string;
  end: string;
  city: string;
  cityName: string;
  people: PlanPerson[];
  event?: { id: string; title: string; startsAt: string; location: string; price?: string };
  ride?: { id: string; driverId: ID; driverName: string; seatsOpen: number; departAt: string };
  hostId?: ID;
  cost: { each: number; lines: { label: string; usd: number }[]; ifNo?: CostBreakdown; note: string };
  /** Every claim with its source, for the "how this was planned" screen. */
  sources: { claim: string; source: string; kind: "rsvp" | "post" | "chat" | "price" | "ride" | "code" | "model"; id?: string }[];
  repairs: string[];
  status: "proposed" | "drafted" | "sent" | "confirmed";
  conversationId?: string;
  draftMessageId?: string;
  fbEventId?: string;
  confirmedAt?: string;
  mode: string;
  costUsd: number;
  createdAt: string;
}

export interface PlanRun { id: string; ownerId: ID; target: Plan["target"]; plans: Plan[]; declineReason?: string; steps: { i: number; at: number; kind: string; text: string; detail?: string }[]; mode: string; costUsd: number; latencyMs: number; createdAt: string }

interface ReconnectStore {
  misses: Map<ID, Set<ID>>;
  nudges: Map<string, Nudge>;
  daily: Map<ID, { date: string; nudgeId?: string; notified: boolean }>;
  plans: Map<string, Plan>;
  runs: PlanRun[];
  seeded: boolean;
}
const g = globalThis as unknown as { __reconnect?: ReconnectStore };
const fresh = (): ReconnectStore => ({ misses: new Map(), nudges: new Map(), daily: new Map(), plans: new Map(), runs: [], seeded: false });
export const reconnectStore = () => {
  const s = (g.__reconnect ??= fresh());
  if (!s.seeded) {
    s.seeded = true;
    for (const [a, b] of seededMisses) s.misses.set(a, new Set([...(s.misses.get(a) ?? []), b]));
  }
  return s;
};
export const resetReconnectStore = () => (g.__reconnect = fresh());

export const missesOf = (viewerId: ID) => reconnectStore().misses.get(viewerId) ?? new Set<ID>();
export const hasMissed = (viewerId: ID, friendId: ID) => missesOf(viewerId).has(friendId);
/** Private: only mutual picks are ever surfaced, and only to the two people in them. */
export const isMutual = (a: ID, b: ID) => hasMissed(a, b) && hasMissed(b, a);
export function setMiss(viewerId: ID, friendId: ID, on: boolean) {
  const s = reconnectStore().misses.get(viewerId) ?? new Set<ID>();
  if (on) s.add(friendId);
  else s.delete(friendId);
  reconnectStore().misses.set(viewerId, s);
  return { on, mutual: on && isMutual(viewerId, friendId) };
}
export const getPlan = (id: string) => reconnectStore().plans.get(id);
export const savePlan = (p: Plan) => reconnectStore().plans.set(p.id, p);

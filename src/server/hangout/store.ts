// Hang Again in-memory store (same pattern as server/db.ts): seeded at boot, survives hot reloads via
// globalThis, reset from /demo. Built memory files and recorded model responses live on disk in data/hangout.
import { join } from "node:path";
import { CHATS, DEFAULT_DEMO_DATE, FRIENDS, GATHERINGS, ME, PEOPLE, PHOTOS, REACTIONS, STARTING_KEEPSAKES } from "@/data/hangout/seed";
import { buildEvidenceIndex } from "@/lib/hangout/evidence";
import { verifyMemory } from "@/lib/hangout/memory";
import { CritterSchema, MemoryAiSchema } from "@/lib/hangout/schemas";
import { buildTimeline, sleepState } from "@/lib/hangout/sleep";
import type { ChatSnippet, CritterDesign, CritterState, FeedPost, Friend, Gathering, InsideJoke, MemoryFile, Nudge, Plan, ReelItem, SharedPlace } from "@/lib/hangout/types";
import { FIXTURES } from "./fixtures";
import { DATA_DIR, hasKey, readJsonFile, writeJsonFile, type HangMode, type MuseLog } from "./muse";

export interface Alert {
  id: string;
  kind: "nudge" | "match" | "reply" | "hatch";
  friendId: string;
  title: string;
  body: string;
  href: string;
  createdAt: string; // demo date
  seen: boolean;
}

export interface RunStep {
  name: string;
  status: "ok" | "fail" | "skip" | "info";
  detail?: string;
  muse?: MuseLog;
}
export interface PipelineRun {
  id: string;
  at: string; // wall clock
  label: string;
  friendId?: string;
  steps: RunStep[];
  outcome: string;
  ok: boolean;
}

export interface HangState {
  demoDate: string;
  aiMode: HangMode;
  friends: Friend[];
  chats: ChatSnippet[];
  gatherings: Gathering[];
  posts: FeedPost[];
  reels: ReelItem[];
  nudges: Nudge[];
  plans: Record<string, Plan>;
  keepsakes: Record<string, string[]>;
  /** Critters designed at runtime (e.g. Sam on hatch). Otherwise the built memory file's critter is used. */
  critters: Record<string, Omit<CritterDesign, "keepsakes">>;
  seeAgain: { gatheringId: string; myPicks: string[]; theyPicked: string[]; submitted: boolean; matches: string[] };
  eggs: Record<string, { since: string; hatchedAt?: string; hatchSeen?: boolean }>;
  alerts: Alert[];
  runs: PipelineRun[];
  replyIdx: Record<string, number>;
}

const defaultMode = (): HangMode => {
  const m = process.env.HANGOUT_AI_MODE;
  if (m === "live" || m === "cached") return m;
  return hasKey() ? "live" : "cached";
};

function seedState(): HangState {
  return {
    demoDate: /^\d{4}-\d{2}-\d{2}$/.test(process.env.DEMO_DATE ?? "") ? process.env.DEMO_DATE! : DEFAULT_DEMO_DATE,
    aiMode: defaultMode(),
    friends: structuredClone(FRIENDS),
    chats: structuredClone(CHATS),
    gatherings: structuredClone(GATHERINGS),
    posts: [],
    reels: [],
    nudges: [],
    plans: {},
    keepsakes: structuredClone(STARTING_KEEPSAKES),
    critters: {},
    seeAgain: { gatheringId: "gt_runclub_1114", myPicks: [], theyPicked: [], submitted: false, matches: [] },
    eggs: {},
    alerts: [],
    runs: [],
    replyIdx: {},
  };
}

const g = globalThis as unknown as { __hang?: HangState; __hangMemory?: MemoryStore };
export function hang(): HangState {
  return (g.__hang ??= seedState());
}
/** Reset the demo. Keeps the AI mode, date and debug log, unless `full`. */
export function resetHang(full = false) {
  const prev = g.__hang;
  g.__hang = seedState();
  if (prev && !full) Object.assign(g.__hang, { aiMode: prev.aiMode, demoDate: prev.demoDate, runs: prev.runs });
  return g.__hang;
}

let seq = 0;
export const hid = (p: string) => `${p}_${Date.now().toString(36)}${(seq++).toString(36)}`;

// ---------- lookups ----------
export const friendById = (id: string) => hang().friends.find((f) => f.id === id);
/** Anyone the UI may show: never blocked people. */
export const visibleFriends = () => hang().friends.filter((f) => !f.isBlocked && f.isFriend);
export const personById = (id: string) => (id === ME.id ? ME : (friendById(id) ?? PEOPLE.find((p) => p.id === id)));
export const evidenceIndex = () => {
  const s = hang();
  return buildEvidenceIndex({ photos: PHOTOS, chats: s.chats, gatherings: s.gatherings, posts: s.posts, reels: s.reels });
};
export const photoById = (id: string) => PHOTOS.find((p) => p.id === id);
export const firstName = (name: string) => name.split(" ")[0];

/** Wall-clock time of day on the demo date, so runtime messages sort after the seed. */
export function demoNow() {
  const t = new Date().toISOString().slice(11, 19);
  return `${hang().demoDate}T${t}`;
}

// ---------- memory files (AI part on disk, timeline + rhythm computed live) ----------
export const MEMORY_FILE = join(DATA_DIR, "memory.json");
export interface BuiltMemory {
  sharedPlaces: SharedPlace[];
  insideJokes: InsideJoke[];
  critter: Omit<CritterDesign, "keepsakes">;
  source: "live" | "cached" | "fixture";
  model?: string;
  builtAt: string;
}
type MemoryStore = Record<string, BuiltMemory>;

export function memoryStore(): MemoryStore {
  return (g.__hangMemory ??= readJsonFile<MemoryStore>(MEMORY_FILE, {}));
}
export function saveMemory(friendId: string, m: BuiltMemory) {
  memoryStore()[friendId] = m;
  writeJsonFile(MEMORY_FILE, memoryStore());
}
export function reloadMemory() {
  g.__hangMemory = readJsonFile<MemoryStore>(MEMORY_FILE, {});
}

/** Fixture-derived memory, verified by the same code check. Used until a memory file is built. */
function fixtureMemory(friendId: string): BuiltMemory | null {
  const raw = MemoryAiSchema.safeParse(FIXTURES[`memory:${friendId}`]);
  const critter = CritterSchema.safeParse(FIXTURES[`critter:${friendId}`]);
  if (!raw.success) return null;
  const v = verifyMemory(raw.data, friendId, evidenceIndex());
  return { sharedPlaces: v.sharedPlaces, insideJokes: v.insideJokes, critter: critter.success ? critter.data : { body: "blob", color: "sky", accessory: "none" }, source: "fixture", builtAt: "" };
}

export function builtMemory(friendId: string): BuiltMemory | null {
  return memoryStore()[friendId] ?? fixtureMemory(friendId);
}

export function timelineFor(friendId: string) {
  const s = hang();
  return buildTimeline({ friendId, chats: s.chats, gatherings: s.gatherings, photos: PHOTOS, reactions: REACTIONS });
}

export function memoryFile(friendId: string): MemoryFile | null {
  const m = builtMemory(friendId);
  if (!m) return null;
  const timeline = timelineFor(friendId);
  const sleep = sleepState(timeline, hang().demoDate);
  const design = hang().critters[friendId] ?? m.critter;
  return { friendId, sharedPlaces: m.sharedPlaces, insideJokes: m.insideJokes, timeline, rhythmDays: sleep.rhythmDays, critter: { ...design, keepsakes: hang().keepsakes[friendId] ?? [] } };
}

/** Sleep state plus the egg/hatch overlay from "See again" matches. */
export function critterStateFor(friendId: string): { state: CritterState; sleep: ReturnType<typeof sleepState> } {
  const s = hang();
  const f = friendById(friendId);
  const sleep = sleepState(timelineFor(friendId), s.demoDate, { isResting: f?.isResting });
  const egg = s.eggs[friendId];
  if (egg && !egg.hatchedAt) return { state: "egg", sleep };
  if (egg?.hatchedAt && !egg.hatchSeen) return { state: "hatching", sleep };
  return { state: sleep.state, sleep };
}

// ---------- logging ----------
export function pushRun(run: PipelineRun) {
  const runs = hang().runs;
  runs.unshift(run);
  if (runs.length > 60) runs.length = 60;
  return run;
}
export function pushAlert(a: Omit<Alert, "id" | "createdAt" | "seen">) {
  const alert: Alert = { id: hid("al"), createdAt: hang().demoDate, seen: false, ...a };
  hang().alerts.unshift(alert);
  return alert;
}

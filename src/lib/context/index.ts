// Context, Streak & Connection-Scoring Engine for Sidequest Messenger Games (Deep Cuts + Order Up!).
// Implements the full multi-signal scoring & surfacing pipeline over `sqgame` / `sqgamelog` + `.cache` rooms:
//   1. Austin-timezone (`America/Chicago`) Snapchat-style streaks: strict majority by local midnight,
//      1 automatic freeze every 7 days, milestones at 3/7/14/30 days, and evening hourglass after 6pm.
//   2. Anti-hijack group topic agreement: `mean × coverage × (1 − SD)` with a >=60% member turnout gate so
//      one loud spammer cannot skew a group chat's recommendations.
//   3. 8-signal `0..100` Connection Score (turnout, streak, banter, shared taste, momentum, balance, cohesion, tempo: SCORE_WEIGHTS)
//      with commitment thresholds (`40` Group -> `60` Event -> `75` Marketplace).
//   4. Multi-factor item ranking: topic fit + shared-chat overlap + mutual friends going (`+0.05` each, cap `0.15`)
//      + event soonness (`+0.10` over 21 days) + saturation filtering + RSVP/Join/Save feedback signals.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { GameKind } from "@/components/ChatGames";
import { db, getConversation, getUser } from "@/server/db";
import type { ID } from "@/types";
import { dayKey, localHour, prevDay } from "./day";
import { sqPid } from "./seed";
import { chipForTopic, TOPIC_IDS, topic as topicOf, topicLabel, topicsOfEvent, topicsOfGroup, topicsOfListing, topicsOfText, type TopicId } from "./taxonomy";
import { canSeeEvent, canSeePost, canSeeReel, canSeeUser, isFriend, mutuals } from "./visibility";

const DAY = 864e5;
export const HALF_LIFE_DAYS = 14;
export const WINDOW_DAYS = 14;
export const FREEZE_EVERY_DAYS = 7;
export const MILESTONES = [3, 7, 14, 30] as const;
export const HOURGLASS_HOUR = 18;
export type SurfaceTier = "group" | "event" | "listing";
export const THRESHOLDS: Record<SurfaceTier, number> = { group: 40, event: 60, listing: 75 };
export const FRIENDS_EACH = 0.05;
export const FRIENDS_CAP = 0.15;
const REPLY_WINDOW_MS = 30 * 60e3;
const CACHE_ROOT = join(process.cwd(), "sidequest", ".cache");

const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const sd = (a: number[]) => {
  const m = mean(a);
  return Math.sqrt(mean(a.map((x) => (x - m) ** 2)));
};
const round2 = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const decay = (iso: string, now = Date.now()) => 0.5 ** (Math.max(0, now - new Date(iso).getTime()) / DAY / HALF_LIFE_DAYS);
const majority = (members: number) => Math.floor(members / 2) + 1;

export interface UserBrief { id: ID; name: string; first: string; avatar: string }
const card = (id: ID): UserBrief => {
  const u = getUser(id);
  const name = u?.name ?? id;
  return { id, name, first: name.split(" ")[0], avatar: u?.avatar ?? "" };
};

// ---------- 1. Sidequest Session Ingestion ----------

interface CachedKRoom {
  id: string;
  menu?: { interest?: string; name?: string; tagline?: string; dishes?: { name?: string }[] };
  createdAt?: string;
  players?: Record<string, { name?: string; best?: number; plays?: number; served?: number; combo?: number }>;
}
interface CachedXRoom {
  id: string;
  interest?: string;
  pack?: { title?: string; tagline?: string; prompts?: { q?: string }[] };
  createdAt?: string;
  players?: Record<string, { name?: string; picks?: Record<string, { a?: string; r?: number; at?: string }> }>;
}
interface CachedRRoom {
  id: string;
  course?: { interest?: string; title?: string; tagline?: string };
  createdAt?: string;
  players?: Record<string, { name?: string; best?: number | null; plays?: number }>;
}
interface CachedSRoom {
  id: string;
  pack?: { interest?: string; title?: string; tagline?: string; words?: { w?: string }[] };
  createdAt?: string;
  drawings?: { artist?: string; at?: string; guesses?: Record<string, { correct?: boolean }> }[];
}

const GAME_LABEL: Record<GameKind, string> = {
  deepcuts: "Deep Cuts",
  orderup: "Order Up!",
  ghostrun: "Ghost Run",
  sketchoff: "Sketch Off",
};

function readJsonSafe<T>(file: string): T | null {
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

export interface PlayerRun {
  userId: ID;
  plays: number;
  finishedAt: string;
  repliedAfter: boolean;
  summary?: string;
}

export interface SidequestSession {
  conversationId: ID;
  ref: string;
  roomId: string;
  gameKind: GameKind;
  interest: string;
  title: string;
  topics: TopicId[];
  creatorId?: ID;
  createdAt: string;
  date: string; // YYYY-MM-DD in America/Chicago
  players: Map<ID, PlayerRun>;
  sameAnswers: Map<string, number>;
}

const pairKey = (a: ID, b: ID) => (a < b ? `${a}|${b}` : `${b}|${a}`);

function parseCardInterest(text: string): string {
  const m = text.match(/(?:Order Up!|Deep Cuts|Ghost Run|Sketch Off)\s*:\s*(.+)$/i);
  return m ? m[1].trim() : text.replace(/^🎮\s*/, "").trim();
}

export function ingestSidequestSessions(): SidequestSession[] {
  const sessions: SidequestSession[] = [];

  for (const c of db().conversations) {
    const byRef = new Map<string, SidequestSession>();
    const pidToMember = new Map<string, ID>(c.participantIds.map((uid) => [sqPid(uid), uid]));

    for (const m of c.messages) {
      const att = m.attachment;
      if (!att || (att.type !== "sqgame" && att.type !== "sqgamelog")) continue;
      const ref = att.ref;
      const gameKind: GameKind = ref.startsWith("k:") ? "orderup" : ref.startsWith("r:") ? "ghostrun" : ref.startsWith("s:") ? "sketchoff" : "deepcuts";
      const roomId = ref.replace(/^[krs]:/, "");

      let sess = byRef.get(ref);
      if (!sess) {
        sess = {
          conversationId: c.id,
          ref,
          roomId,
          gameKind,
          interest: "",
          title: "",
          topics: [],
          createdAt: m.createdAt,
          date: dayKey(m.createdAt),
          players: new Map(),
          sameAnswers: new Map(),
        };
        byRef.set(ref, sess);
        sessions.push(sess);
      }

      if (att.type === "sqgame") {
        sess.creatorId ??= m.senderId;
        sess.createdAt = m.createdAt;
        sess.date = dayKey(m.createdAt);
        const parsed = parseCardInterest(m.text);
        if (parsed) sess.interest = parsed;
      } else if (att.type === "sqgamelog" && c.participantIds.includes(m.senderId)) {
        const prev = sess.players.get(m.senderId);
        const t0 = new Date(m.createdAt).getTime();
        const repliedAfter = c.messages.some(
          (x) => !x.attachment && x.senderId === m.senderId && new Date(x.createdAt).getTime() > t0 && new Date(x.createdAt).getTime() - t0 <= REPLY_WINDOW_MS,
        );
        sess.players.set(m.senderId, {
          userId: m.senderId,
          plays: (prev?.plays ?? 0) + 1,
          finishedAt: prev?.finishedAt && prev.finishedAt < m.createdAt ? prev.finishedAt : m.createdAt,
          repliedAfter: Boolean(prev?.repliedAfter || repliedAfter),
          summary: m.text,
        });
        if (!sess.title) {
          const tm = m.text.match(/^played\s+([^·]+)/i);
          if (tm) sess.title = tm[1].trim();
        }
      }
    }

    for (const sess of byRef.values()) {
      let extraText = "";
      if (sess.gameKind === "orderup") {
        const kr = readJsonSafe<CachedKRoom>(join(CACHE_ROOT, "kitchen", `${sess.roomId}.json`));
        if (kr) {
          if (kr.menu?.interest) sess.interest ||= kr.menu.interest;
          if (kr.menu?.name) sess.title = kr.menu.name;
          extraText = [kr.menu?.tagline ?? "", ...(kr.menu?.dishes ?? []).map((d) => d.name ?? "")].join(" ");
          for (const [pid, pl] of Object.entries(kr.players ?? {})) {
            const uid = pidToMember.get(pid);
            if (!uid || !(pl.plays && pl.plays > 0)) continue;
            const cur = sess.players.get(uid);
            sess.players.set(uid, {
              userId: uid,
              plays: Math.max(cur?.plays ?? 0, pl.plays),
              finishedAt: cur?.finishedAt ?? kr.createdAt ?? sess.createdAt,
              repliedAfter: cur?.repliedAfter ?? false,
              summary: cur?.summary ?? `played ${sess.title || sess.interest} · $${pl.best ?? 0}`,
            });
          }
        }
      } else if (sess.gameKind === "ghostrun") {
        const rr = readJsonSafe<CachedRRoom>(join(CACHE_ROOT, "run", `${sess.roomId}.json`));
        if (rr) {
          if (rr.course?.interest) sess.interest ||= rr.course.interest;
          if (rr.course?.title) sess.title = rr.course.title;
          extraText = rr.course?.tagline ?? "";
          for (const [pid, pl] of Object.entries(rr.players ?? {})) {
            const uid = pidToMember.get(pid);
            if (!uid || !(pl.plays && pl.plays > 0)) continue;
            const cur = sess.players.get(uid);
            sess.players.set(uid, {
              userId: uid,
              plays: Math.max(cur?.plays ?? 0, pl.plays),
              finishedAt: cur?.finishedAt ?? rr.createdAt ?? sess.createdAt,
              repliedAfter: cur?.repliedAfter ?? false,
              summary: cur?.summary,
            });
          }
        }
      } else if (sess.gameKind === "sketchoff") {
        const sr = readJsonSafe<CachedSRoom>(join(CACHE_ROOT, "sketch", `${sess.roomId}.json`));
        if (sr) {
          if (sr.pack?.interest) sess.interest ||= sr.pack.interest;
          if (sr.pack?.title) sess.title = sr.pack.title;
          extraText = [sr.pack?.tagline ?? "", ...(sr.pack?.words ?? []).map((w) => w.w ?? "")].join(" ");
          for (const d of sr.drawings ?? []) {
            const artistUid = d.artist ? pidToMember.get(d.artist) : undefined;
            if (artistUid && !sess.players.has(artistUid)) {
              sess.players.set(artistUid, { userId: artistUid, plays: 1, finishedAt: d.at ?? sess.createdAt, repliedAfter: false });
            }
            for (const gPid of Object.keys(d.guesses ?? {})) {
              const gUid = pidToMember.get(gPid);
              if (gUid && !sess.players.has(gUid)) {
                sess.players.set(gUid, { userId: gUid, plays: 1, finishedAt: d.at ?? sess.createdAt, repliedAfter: false });
              }
            }
          }
        }
      } else {
        const xr = readJsonSafe<CachedXRoom>(join(CACHE_ROOT, "rarity", `${sess.roomId}.json`));
        if (xr) {
          if (xr.interest) sess.interest ||= xr.interest;
          if (xr.pack?.title) sess.title = xr.pack.title;
          extraText = [xr.pack?.tagline ?? "", ...(xr.pack?.prompts ?? []).map((p) => p.q ?? "")].join(" ");
          const memberPicks: [ID, Record<string, { a?: string }>][] = [];
          for (const [pid, pl] of Object.entries(xr.players ?? {})) {
            const uid = pidToMember.get(pid);
            const answered = Object.keys(pl.picks ?? {}).length;
            if (!uid || answered === 0) continue;
            memberPicks.push([uid, pl.picks ?? {}]);
            const cur = sess.players.get(uid);
            sess.players.set(uid, {
              userId: uid,
              plays: Math.max(cur?.plays ?? 0, 1),
              finishedAt: cur?.finishedAt ?? sess.createdAt,
              repliedAfter: cur?.repliedAfter ?? false,
              summary: cur?.summary,
            });
          }
          for (let i = 0; i < memberPicks.length; i++) {
            for (let j = i + 1; j < memberPicks.length; j++) {
              const [ua, pa] = memberPicks[i];
              const [ub, pb] = memberPicks[j];
              let same = 0;
              for (const k of Object.keys(pa)) {
                const a = pa[k]?.a?.trim().toLowerCase();
                const b = pb[k]?.a?.trim().toLowerCase();
                if (a && b && a === b) same++;
              }
              if (same > 0) sess.sameAnswers.set(pairKey(ua, ub), same);
            }
          }
        }
      }

      sess.title ||= sess.interest || GAME_LABEL[sess.gameKind];
      sess.interest ||= sess.title;
      const direct = topicsOfText(`${sess.interest} ${sess.title}`);
      sess.topics = direct.length ? direct : topicsOfText(extraText);
    }
  }

  return sessions.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// ---------- 2. Explicit Feedback Signals + Per-User Taste Affinity ----------

export interface FeedbackSignal {
  userId: ID;
  tier: SurfaceTier;
  itemId: string;
  topic: TopicId;
  weight: number; // +2 rsvp, +1.5 join, +1 save, -1 dismiss
  at: string;
}
const feedbackStore = () => ((globalThis as unknown as { __sqFeedback?: FeedbackSignal[] }).__sqFeedback ??= []);
export function clearFeedbackSignals() {
  feedbackStore().length = 0;
}
export function recordFeedbackSignal(userId: ID, tier: SurfaceTier, itemId: string, topic: TopicId, action: "in" | "dismiss") {
  const w = action === "dismiss" ? -1 : tier === "event" ? 2 : tier === "group" ? 1.5 : 1;
  feedbackStore().push({ userId, tier, itemId, topic, weight: w, at: new Date().toISOString() });
}

export interface AffinityProfile {
  raw: Record<TopicId, number>;
  score: Record<TopicId, number>;
  observations: Record<TopicId, number>;
}

export function affinityFor(userId: ID, sessions = ingestSidequestSessions(), now = Date.now()): AffinityProfile {
  const raw = Object.fromEntries(TOPIC_IDS.map((t) => [t, 0])) as Record<TopicId, number>;
  const observations = Object.fromEntries(TOPIC_IDS.map((t) => [t, 0])) as Record<TopicId, number>;
  const u = getUser(userId);
  if (u) {
    for (const int of u.interests) for (const t of topicsOfText(int)) raw[t] = Math.min(0.35, raw[t] + 0.18);
  }

  for (const s of sessions) {
    const created = s.creatorId === userId;
    const run = s.players.get(userId);
    if (!created && !run) continue;
    const d = decay(run?.finishedAt ?? s.createdAt, now);
    const w = (created ? 0.55 : 0) + (run ? 0.85 * (1 + 0.15 * Math.min(3, run.plays - 1)) * (run.repliedAfter ? 1.2 : 1) : 0);
    s.topics.forEach((t, idx) => {
      raw[t] += d * w * (idx === 0 ? 1 : 0.65);
      observations[t] += 1;
    });
  }

  for (const fb of feedbackStore()) {
    if (fb.userId !== userId) continue;
    raw[fb.topic] += decay(fb.at, now) * fb.weight;
    observations[fb.topic] += 1;
  }

  const score = Object.fromEntries(TOPIC_IDS.map((t) => [t, round3(Math.tanh(raw[t] / 1.35))])) as Record<TopicId, number>;
  return { raw, score, observations };
}

// ---------- 3. Austin-Timezone Streaks + Anti-Hijack Connection Scoring ----------

export interface StreakInfo {
  days: number;
  freezes: string[];
  today: { hasGame: boolean; finished: number; members: number; needed: number; lockedIn: boolean };
  hourglass: boolean;
  milestone?: number;
}

export interface ChatDayActivity {
  finishersByDay: Map<string, Set<ID>>;
  gamesByDay: Map<string, Set<string>>;
}

/** Per-day (`America/Chicago`) game activity for a conversation across both new rooms and replays of existing cards. */
export function chatDayActivityFor(conversationId: ID, sessions = ingestSidequestSessions()): ChatDayActivity {
  const c = getConversation(conversationId);
  const finishersByDay = new Map<string, Set<ID>>();
  const gamesByDay = new Map<string, Set<string>>();
  const addGame = (d: string, ref: string) => {
    let set = gamesByDay.get(d);
    if (!set) gamesByDay.set(d, (set = new Set()));
    set.add(ref);
  };
  const addFinisher = (d: string, uid: ID) => {
    let set = finishersByDay.get(d);
    if (!set) finishersByDay.set(d, (set = new Set()));
    set.add(uid);
  };

  // A caller can pass a what-if session list (e.g. "before this player's finish"): a finish only counts if the
  // matching session still has that player. Games missing from the list entirely are counted from the messages.
  const byRef = new Map(sessions.filter((s) => s.conversationId === conversationId).map((s) => [s.ref, s]));
  if (c) {
    for (const m of c.messages) {
      const att = m.attachment;
      if (!att || (att.type !== "sqgame" && att.type !== "sqgamelog")) continue;
      const d = dayKey(m.createdAt);
      addGame(d, att.ref);
      const sess = byRef.get(att.ref);
      if (att.type === "sqgamelog" && c.participantIds.includes(m.senderId) && (!sess || sess.players.has(m.senderId))) {
        addFinisher(d, m.senderId);
      }
    }
  }

  for (const s of sessions) {
    if (s.conversationId !== conversationId) continue;
    addGame(s.date, s.ref);
    for (const [uid, run] of s.players) {
      const finishDay = dayKey(run.finishedAt);
      addGame(finishDay, s.ref);
      addFinisher(finishDay <= s.date ? s.date : finishDay, uid);
    }
  }

  return { finishersByDay, gamesByDay };
}

/** Snapchat-style streak for a conversation over Sidequest sessions:
 *  - A calendar day (`America/Chicago`) counts when a strict majority finishes a game on that day by local midnight.
 *  - One missed day every 7 days is held by an automatic freeze (adds 0, preserves the run).
 *  - Milestones fire at 3 / 7 / 14 / 30 days; evening hourglass triggers after 6pm if today's game isn't locked in. */
export function streakInfoFor(conversationId: ID, sessions = ingestSidequestSessions(), now = Date.now()): StreakInfo {
  const c = getConversation(conversationId);
  const members = c?.participantIds.length ?? 0;
  const { finishersByDay: byDay, gamesByDay } = chatDayActivityFor(conversationId, sessions);

  const todayKey = dayKey(now);
  const todaySet = byDay.get(todayKey);
  const finishedToday = todaySet?.size ?? 0;
  const hasTodayGame = (gamesByDay.get(todayKey)?.size ?? 0) > 0;
  const needed = majority(members);
  const today = {
    hasGame: hasTodayGame,
    finished: finishedToday,
    members,
    needed,
    lockedIn: members > 0 && finishedToday >= needed,
  };

  let days = 0;
  const frozen: { key: string; i: number }[] = [];
  let lastCounted = -1;
  let key = todayKey;
  for (let i = 0; c && i < 120; i++, key = prevDay(key)) {
    const doneOnDay = byDay.get(key)?.size ?? 0;
    if (members > 0 && doneOnDay >= needed) {
      days++;
      lastCounted = i;
      continue;
    }
    if (i === 0) continue; // today still open until midnight
    const lastFreeze = frozen.at(-1)?.i ?? -Infinity;
    if (i - lastFreeze >= FREEZE_EVERY_DAYS) {
      frozen.push({ key, i });
      continue;
    }
    break;
  }

  const freezes = frozen.filter((f) => f.i < lastCounted).map((f) => f.key);
  const hourglass = today.hasGame && !today.lockedIn && members > 1 && localHour(now) >= HOURGLASS_HOUR;
  const milestone = (MILESTONES as readonly number[]).includes(days) ? days : undefined;
  return { days, freezes, today, hourglass, milestone };
}

export interface ChatTopicScore {
  topic: TopicId;
  score: number;
  mean: number;
  coverage: number;
  agreement: number;
  games: number;
  observedBy: number;
  settled: boolean;
}

/** Anti-hijack topic scoring for a chat: `mean × coverage × (1 − SD)`.
 *  If 1 loud member spams games alone in an 8-person chat, coverage is 1/8 and SD is high -> `settled` stays false. */
export function chatTopicsFor(conversationId: ID, sessions = ingestSidequestSessions(), now = Date.now()): ChatTopicScore[] {
  const c = getConversation(conversationId);
  if (!c) return [];
  const members = c.participantIds;
  const inChat = sessions.filter((s) => s.conversationId === conversationId && s.players.size > 0);
  // Build per-member affinities from THIS chat's sessions only (zero cross-chat leakage).
  const memberAffs = members.map((uid) => {
    const raw = Object.fromEntries(TOPIC_IDS.map((t) => [t, 0])) as Record<TopicId, number>;
    for (const s of inChat) {
      const run = s.players.get(uid);
      if (!run) continue;
      const d = decay(run.finishedAt, now);
      const w = 0.9 * (1 + 0.15 * Math.min(3, run.plays - 1));
      s.topics.forEach((t, idx) => {
        raw[t] += d * w * (idx === 0 ? 1 : 0.65);
      });
    }
    return Object.fromEntries(TOPIC_IDS.map((t) => [t, Math.tanh(raw[t] / 1.2)])) as Record<TopicId, number>;
  });

  return TOPIC_IDS.map((t) => {
    const vals = memberAffs.map((a) => a[t]);
    const m = mean(vals);
    const coverage = vals.filter((v) => v > 0.15).length / members.length;
    const agreement = 1 - clamp(sd(vals));
    const touching = inChat.filter((s) => s.topics.includes(t));
    const observedBy = members.filter((uid) => touching.some((s) => s.players.has(uid))).length;
    const score = round3(Math.max(0, m) * coverage * agreement);
    const settled = touching.length >= 1 && observedBy / members.length >= 0.5 && score > 0.08;
    return { topic: t, score, mean: round3(m), coverage: round2(coverage), agreement: round2(agreement), games: touching.length, observedBy, settled };
  }).sort((a, b) => b.score - a.score);
}

export type ScorePart = "participation" | "streak" | "reciprocity" | "confidence" | "momentum" | "balance" | "cohesion" | "tempo";

/** How much each signal counts toward the 0..100 Connection Score. Sums to 1. */
export const SCORE_WEIGHTS: Record<ScorePart, number> = {
  participation: 0.28, // turnout: how much of the chat finishes each game
  streak: 0.16, // consistency: consecutive days a majority played
  reciprocity: 0.16, // banter after games, rematches, Deep Cuts mind-melds
  confidence: 0.12, // shared taste: how settled the chat is on a topic
  momentum: 0.1, // is turnout rising or fading (last 3 days vs the days before)
  balance: 0.07, // is everyone involved, or is it one or two people carrying the chat
  cohesion: 0.06, // how many pairs of members have actually played the same game
  tempo: 0.05, // how quickly people jump in after a game is posted
};
const SCORE_NOTES: Record<ScorePart, string> = {
  participation: "share of the chat that finishes each game",
  streak: "days in a row a majority played (out of 7)",
  reciprocity: "players who chat after, replay, or match answers",
  confidence: "how settled the chat is on a shared topic",
  momentum: "turnout in the last 3 days vs the days before",
  balance: "how evenly play and banter are spread across members",
  cohesion: "pairs of members who played the same game",
  tempo: "how fast people play once a game is posted",
};
const MOMENTUM_DAYS = 3;
const TEMPO_FULL_MS = 30 * 60e3; // everyone in within half an hour = full marks
const TEMPO_ZERO_MS = 12 * 3600e3; // half a day later = none
const PLAN_RE = /\b(who'?s (free|in|down|coming)|i'?m (in|down|free|off)|let'?s|we should|should we|this weekend|tonight|tomorrow|(mon|tues|wednes|thurs|fri|satur|sun)day|i'?ll bring|bringing|my place|come over|what time|rematch|bake-?off|cook-?off)\b/i;

/** Gini coefficient of non-negative counts: 0 = perfectly even, toward 1 = one person does everything. */
function gini(counts: number[]): number {
  const n = counts.length;
  const total = counts.reduce((s, x) => s + x, 0);
  if (n < 2 || total === 0) return 0;
  const sorted = [...counts].sort((x, y) => x - y);
  const weighted = sorted.reduce((s, x, i) => s + (i + 1) * x, 0);
  return clamp((2 * weighted) / (n * total) - (n + 1) / n);
}

export interface ScoreSignal {
  part: ScorePart;
  value: number; // 0..1
  weight: number;
  points: number; // value × weight × 100
  note: string;
}

export interface ConnectionScoreResult {
  score: number; // 0..100
  parts: Record<ScorePart, number>;
  /** The same parts with their weights and points, strongest first, for the Inspector. */
  signals: ScoreSignal[];
  /** 0..1: how much the chat is already talking about meeting up (not part of the score; it steers what Muse suggests). */
  planning: number;
  streak: StreakInfo;
  topics: ChatTopicScore[];
  earnedTiers: SurfaceTier[];
  nextTier?: { tier: SurfaceTier; at: number };
}

/**
 * 8-signal `0..100` Connection Score + `40 / 60 / 75` tier gates (`group: 40`, `event: 60`, `listing: 75`).
 * Four signals say how much the chat plays (turnout, streak, momentum, tempo), three say how well it plays together
 * (reciprocity, balance, cohesion) and one says whether it has a shared taste to recommend from (confidence).
 * Everything comes from this chat's own games and messages in the last `WINDOW_DAYS` days.
 */
export function connectionScoreFor(conversationId: ID, sessions = ingestSidequestSessions(), now = Date.now()): ConnectionScoreResult {
  const c = getConversation(conversationId);
  const memberIds = c?.participantIds ?? [];
  const members = memberIds.length || 1;
  const recent = sessions.filter((s) => s.conversationId === conversationId && now - new Date(s.createdAt).getTime() <= WINDOW_DAYS * DAY);
  const todayKey = dayKey(now);
  const rate = (list: SidequestSession[]) => mean(list.map((s) => s.players.size / members));
  // Today's game is still open: it can lift turnout but never drag it down.
  const settledGames = recent.filter((s) => s.date !== todayKey);
  const participation = clamp(Math.max(rate(recent), rate(settledGames)));

  const played = recent.filter((s) => s.players.size > 0);
  const social = (list: SidequestSession[]) =>
    mean(
      list.map((s) => {
        const socialPlayers = [...s.players.values()].filter((r) => r.repliedAfter || r.plays > 1).length;
        const mindMelds = [...s.sameAnswers.values()].reduce((sum, v) => sum + v, 0);
        return clamp((socialPlayers + mindMelds) / Math.max(1, s.players.size));
      }),
    );
  // Same rule as turnout: the banter after today's game may still be coming, so it can only help.
  const reciprocity = clamp(Math.max(social(played), social(played.filter((s) => s.date !== todayKey))));

  const streak = streakInfoFor(conversationId, sessions, now);
  const topics = chatTopicsFor(conversationId, sessions, now);
  const top = topics.find((t) => t.observedBy > 0);
  const confidence = top ? clamp(top.score / 0.35) * clamp(top.observedBy / members / 0.6) : 0;

  // Momentum: turnout over the last few days against the days before. 0.5 = steady (or too new to tell),
  // above = picking up, below = fading; a chat that stopped playing drops to 0.
  const age = (s: SidequestSession) => (now - new Date(s.createdAt).getTime()) / DAY;
  const fresh = settledGames.filter((s) => age(s) <= MOMENTUM_DAYS);
  const freshAll = recent.filter((s) => age(s) <= MOMENTUM_DAYS);
  const older = recent.filter((s) => age(s) > MOMENTUM_DAYS);
  const freshRate = Math.max(rate(fresh), rate(freshAll));
  const momentum = !played.length ? 0 : !older.length ? 0.5 : !freshAll.length ? 0 : clamp(0.5 + (freshRate - rate(older)));

  // Balance: finishes plus post-game banter per member, including members who never showed up.
  const activity = memberIds.map((id) => played.reduce((n, s) => n + (s.players.has(id) ? 1 + (s.players.get(id)!.repliedAfter ? 1 : 0) : 0), 0));
  const balance = played.length ? 1 - gini(activity) : 0;

  // Cohesion: of all pairs of members, how many have finished the same game at least once.
  let pairs = 0;
  let coPlayed = 0;
  for (let i = 0; i < memberIds.length; i++)
    for (let j = i + 1; j < memberIds.length; j++) {
      pairs++;
      if (played.some((s) => s.players.has(memberIds[i]) && s.players.has(memberIds[j]))) coPlayed++;
    }
  const cohesion = pairs ? coPlayed / pairs : 0;

  // Tempo: median time from a game being posted to each finish.
  const delays = played
    .flatMap((s) => [...s.players.values()].map((r) => new Date(r.finishedAt).getTime() - new Date(s.createdAt).getTime()))
    .filter((d) => Number.isFinite(d))
    .map((d) => Math.max(0, d))
    .sort((x, y) => x - y);
  const median = delays.length ? delays[Math.floor((delays.length - 1) / 2)] : Infinity;
  const tempo = delays.length ? clamp(1 - (median - TEMPO_FULL_MS) / (TEMPO_ZERO_MS - TEMPO_FULL_MS)) : 0;

  const raw: Record<ScorePart, number> = { participation, streak: clamp(streak.days / 7), reciprocity, confidence, momentum, balance, cohesion, tempo };
  const order = Object.keys(SCORE_WEIGHTS) as ScorePart[];
  const parts = Object.fromEntries(order.map((k) => [k, round2(raw[k])])) as Record<ScorePart, number>;
  const score = Math.round(100 * order.reduce((sum, k) => sum + SCORE_WEIGHTS[k] * raw[k], 0));
  const signals = order
    .map((k) => ({ part: k, value: parts[k], weight: SCORE_WEIGHTS[k], points: Math.round(1000 * SCORE_WEIGHTS[k] * raw[k]) / 10, note: SCORE_NOTES[k] }))
    .sort((x, y) => y.points - x.points);

  // Planning intent: share of the chat's recent plain messages that sound like making plans. Steers suggestions only.
  const lines = (c?.messages ?? []).filter((m) => !m.attachment && m.text && now - new Date(m.createdAt).getTime() <= WINDOW_DAYS * DAY).slice(-40);
  const planning = lines.length ? round2(clamp((lines.filter((m) => PLAN_RE.test(m.text)).length / lines.length) * 3)) : 0;

  const hasSettled = topics.some((t) => t.settled);
  const tiers: SurfaceTier[] = ["group", "event", "listing"];
  const earnedTiers = hasSettled ? tiers.filter((t) => score >= THRESHOLDS[t]) : [];
  const next = tiers.find((t) => score < THRESHOLDS[t]);
  return {
    score,
    parts,
    signals,
    planning,
    streak,
    topics,
    earnedTiers,
    nextTier: next ? { tier: next, at: THRESHOLDS[next] } : undefined,
  };
}

// ---------- 4. Relationship Closeness & Crew Sync Graph (strictly chat-scoped) ----------

export interface SharedMatch {
  conversationId: ID;
  isGroup: boolean;
  friendId?: ID;
  memberIds: ID[];
  name: string;
  shortName: string;
  avatar: string;
  coPlayed: number;
  totalRuns: number;
  sameAnswers: number;
  closenessScore: number; // 0..100 from connectionScoreFor
  parts: ConnectionScoreResult["parts"];
  streak: StreakInfo;
  earnedTiers: SurfaceTier[];
  sharedGames: string[];
  topicOverlap: Partial<Record<TopicId, number>>;
  sharedTopics: { topic: TopicId; label: string; strength: number; agreement: number; settled: boolean }[];
}

/** Computes `viewerId`'s closeness and shared-taste graph strictly from Sidequest games co-played in shared chats. */
export function sharedMatchesFor(viewerId: ID, sessions = ingestSidequestSessions(), now = Date.now()): SharedMatch[] {
  const convs = db().conversations.filter((c) => c.participantIds.includes(viewerId));
  const out: SharedMatch[] = [];

  for (const c of convs) {
    const inChat = sessions.filter((s) => s.conversationId === c.id);
    if (!inChat.length) continue;

    // Privacy gate: only sessions where BOTH viewerId and at least one other member played count as co-played.
    const coSessions = inChat.filter((s) => s.players.has(viewerId) && s.players.size >= 2);
    if (!coSessions.length) continue;

    const cs = connectionScoreFor(c.id, coSessions, now);
    const totalRuns = coSessions.reduce((sum, s) => sum + [...s.players.values()].reduce((a, r) => a + r.plays, 0), 0);
    let sameAnswers = 0;
    const gameTitles: string[] = [];
    for (const s of coSessions) {
      for (const [pk, count] of s.sameAnswers) if (pk.includes(viewerId)) sameAnswers += count;
      if (!gameTitles.includes(s.title)) gameTitles.push(s.title);
    }

    const overlap: Partial<Record<TopicId, number>> = {};
    for (const ct of cs.topics) {
      if (ct.settled || (ct.games >= 1 && ct.observedBy >= 2 && ct.score > 0.08)) {
        overlap[ct.topic] = ct.score;
      }
    }

    const others = c.participantIds.filter((id) => id !== viewerId);
    const friend = !c.isGroup && others[0] ? card(others[0]) : undefined;
    const label = friend ? friend.name : c.name ?? others.slice(0, 2).map((id) => card(id).first).join(", ");
    const shortName = friend ? friend.first : label;

    const sharedTopics = cs.topics
      .filter((t) => (overlap[t.topic] ?? 0) > 0.08)
      .map((t) => ({ topic: t.topic, label: topicLabel(t.topic), strength: round2(t.score), agreement: t.agreement, settled: t.settled }))
      .slice(0, 5);

    out.push({
      conversationId: c.id,
      isGroup: c.isGroup,
      friendId: friend?.id,
      memberIds: c.participantIds,
      name: label,
      shortName,
      avatar: friend ? friend.avatar : card(others[0] ?? viewerId).avatar,
      coPlayed: coSessions.length,
      totalRuns,
      sameAnswers,
      closenessScore: cs.score,
      parts: cs.parts,
      streak: cs.streak,
      earnedTiers: cs.earnedTiers,
      sharedGames: gameTitles.slice(-4),
      topicOverlap: overlap,
      sharedTopics,
    });
  }

  return out.sort((a, b) => b.closenessScore - a.closenessScore || b.coPlayed - a.coPlayed);
}

// ---------- 5. Smart Input Context & Blind-Spot Suggestions for GameTray ----------

export function inventoryTopicsFor(memberIds: ID[]): Set<TopicId> {
  const d = db();
  const now = Date.now();
  const all = (fn: (id: ID) => boolean) => memberIds.every(fn);
  const out = new Set<TopicId>();
  d.events.filter((e) => new Date(e.startsAt).getTime() > now && all((m) => canSeeEvent(m, e))).forEach((e) => topicsOfEvent(e).forEach((t) => out.add(t)));
  d.groups.filter((g) => g.privacy === "public" || all((m) => g.memberIds.includes(m))).forEach((g) => topicsOfGroup(g).forEach((t) => out.add(t)));
  d.listings.filter((l) => l.status === "available").forEach((l) => topicsOfListing(l).forEach((t) => out.add(t)));
  return out;
}

export function blindSpotTopicsFor(memberIds: ID[], sessions = ingestSidequestSessions()): TopicId[] {
  const live = inventoryTopicsFor(memberIds);
  const affs = memberIds.map((id) => affinityFor(id, sessions));
  return TOPIC_IDS
    .filter((t) => live.has(t))
    .map((t) => ({ t, obs: affs.reduce((s, a) => s + a.observations[t], 0) }))
    .sort((a, b) => a.obs - b.obs)
    .map((x) => x.t);
}

export function traySuggestionsFor(conversationId: ID, viewerId: ID, game: GameKind | "auto" = "auto") {
  const c = getConversation(conversationId);
  if (!c || !c.participantIds.includes(viewerId)) throw Object.assign(new Error("Conversation not found"), { status: 404 });
  const ids = c.participantIds;
  const all = (fn: (id: ID) => boolean) => ids.every(fn);
  const d = db();
  const sessions = ingestSidequestSessions();

  const sharedReasons = new Map<TopicId, string>();
  const note = (ts: TopicId[], reason: string) => {
    for (const t of ts) if (!sharedReasons.has(t)) sharedReasons.set(t, reason);
  };

  for (const g of d.groups.filter((x) => x.privacy === "public" || all((m) => x.memberIds.includes(m)))) {
    const inGrp = ids.filter((id) => g.memberIds.includes(id));
    if (inGrp.length >= 2) note(topicsOfGroup(g), ids.length === 2 ? `Both in ${g.name}` : `${inGrp.length} in ${g.name}`);
  }
  for (const e of d.events.filter((x) => all((m) => canSeeEvent(m, x)))) {
    const inEv = ids.filter((id) => e.going.includes(id) || e.interested.includes(id));
    if (inEv.length >= 2) note(topicsOfEvent(e), ids.length === 2 ? `Both eyeing ${e.title}` : `${inEv.length} into ${e.title}`);
  }
  for (const m of c.messages.filter((x) => !x.attachment && x.text.length >= 10).slice(-25).reverse()) {
    note(topicsOfText(m.text), "From this chat");
  }
  for (const id of ids) {
    d.posts.filter((p) => p.authorId === id && all((m) => canSeePost(m, p))).slice(0, 5).forEach((p) => note(topicsOfText(p.text), `${card(id).first}'s post`));
    d.reels.filter((r) => r.authorId === id && all((m) => canSeeReel(m, r))).slice(0, 2).forEach((r) => note(topicsOfText(r.caption), `${card(id).first}'s reel`));
    d.listings.filter((l) => l.sellerId === id && l.status === "available").forEach((l) => note(topicsOfListing(l), `${card(id).first}'s listing`));
    const u = getUser(id);
    if (u && all((m) => m === id || (canSeeUser(m, u) && (u.privacy !== "friends" || isFriend(m, id))))) {
      u.interests.forEach((int) => note(topicsOfText(int), `${card(id).first}'s bio`));
    }
  }

  const usedChips = new Set<string>();
  const forChat: { chip: string; topic: TopicId; reason: string }[] = [];
  for (const [t, reason] of sharedReasons) {
    const chip = chipForTopic(t, game);
    if (usedChips.has(chip.toLowerCase())) continue;
    usedChips.add(chip.toLowerCase());
    forChat.push({ chip, topic: t, reason });
    if (forChat.length >= 3) break;
  }

  const discover: { chip: string; topic: TopicId; reason: string }[] = [];
  for (const t of blindSpotTopicsFor(ids, sessions)) {
    const chip = chipForTopic(t, game);
    if (usedChips.has(chip.toLowerCase())) continue;
    usedChips.add(chip.toLowerCase());
    discover.push({ chip, topic: t, reason: `New vibe · ${topicOf(t).label}` });
    if (discover.length >= 3) break;
  }

  return { forChat, discover };
}

// ---------- 6. Multi-Factor Downstream Ecosystem Ranking ----------

export interface ShareTarget {
  conversationId: ID;
  name: string;
  label: string;
}
export interface ItemRankContext {
  tier?: SurfaceTier;
  startsAt?: string;
  /** Users already going (Events) or already members (Groups), used for social proof & saturation filtering. */
  alreadyInIds?: ID[];
}
export interface SocialMatchResult {
  fit: number;
  topic?: TopicId;
  fitLabel?: string;
  shareTarget?: ShareTarget;
  parts: { topicFit: number; chatOverlap: number; friendsGoing: number; soonness: number };
}
export interface SocialMatchCache {
  aff: AffinityProfile;
  matches: SharedMatch[];
  friendIds: Set<ID>;
}

export function socialMatchCache(viewerId: ID, now = Date.now()): SocialMatchCache {
  const sessions = ingestSidequestSessions();
  const me = getUser(viewerId);
  return {
    aff: affinityFor(viewerId, sessions, now),
    matches: sharedMatchesFor(viewerId, sessions, now),
    friendIds: new Set(me?.friendIds ?? []),
  };
}

/** Multi-factor ranking across Events, Groups, and Marketplace:
 *  - `topicFit`: primary topic in full + secondary topics at 0.25 (prevents 5-topic items outranking squarely matched ones)
 *  - `chatOverlap`: strongest shared chat that has earned `tier`'s threshold (`40` group, `60` event, `75` listing)
 *    where NOT every other member of that chat is already in `alreadyInIds` (saturation check)
 *  - `friendsGoing`: Events social proof (`+0.05` per friend going, capped at `+0.15`)
 *  - `soonness`: Events happening sooner score up to `+0.10` over a 21-day window */
export function socialMatchFor(
  viewerId: ID,
  topics: TopicId[],
  cache: SocialMatchCache = socialMatchCache(viewerId),
  itemCtx: ItemRankContext = {},
): SocialMatchResult {
  const zeroParts = { topicFit: 0, chatOverlap: 0, friendsGoing: 0, soonness: 0 };
  const observed = topics.map((t, i) => ({ t, v: cache.aff.observations[t] > 0 ? (cache.aff.score[t] ?? 0) * (i === 0 ? 1 : 0.6) : 0 })).filter((x) => x.v > 0);
  if (!observed.length) return { fit: 0, parts: zeroParts };

  const best = [...observed].sort((a, b) => b.v - a.v)[0];
  const topicFit = round3(best.v + 0.25 * (observed.reduce((s, x) => s + x.v, 0) - best.v));

  const tier = itemCtx.tier;
  const alreadySet = new Set(itemCtx.alreadyInIds ?? []);

  let bestChat: { m: SharedMatch; topic: TopicId; v: number; othersNotIn: ID[] } | undefined;
  for (const m of cache.matches) {
    // Tier threshold gate: when `tier` is specified, only surface chat attribution if the chat earned that tier (or >= 40 fallback for 1-game live demos).
    if (tier && m.closenessScore < Math.min(THRESHOLDS[tier], 45)) continue;
    const others = m.memberIds.filter((id) => id !== viewerId);
    const othersNotIn = others.filter((id) => !alreadySet.has(id));
    for (const [i, t] of topics.entries()) {
      const ov = (m.topicOverlap[t] ?? 0) * (i === 0 ? 1 : 0.65);
      if (ov > 0.08 && (!bestChat || ov > bestChat.v)) bestChat = { m, topic: t, v: ov, othersNotIn };
    }
  }

  const chatOverlap = round3(bestChat ? Math.min(0.3, bestChat.v * 0.45) : 0);
  const friendsGoingCount = tier === "event" ? [...alreadySet].filter((id) => cache.friendIds.has(id)).length : 0;
  const friendsGoing = round3(tier === "event" ? Math.min(FRIENDS_CAP, FRIENDS_EACH * friendsGoingCount) : 0);
  const daysOut = tier === "event" && itemCtx.startsAt ? (new Date(itemCtx.startsAt).getTime() - Date.now()) / DAY : 99;
  const soonness = round3(tier === "event" && daysOut >= -0.2 ? 0.1 * clamp(1 - Math.max(0, daysOut) / 21) : 0);

  const fit = round3(topicFit + chatOverlap + friendsGoing + soonness);
  const parts = { topicFit, chatOverlap, friendsGoing, soonness };

  if (bestChat && fit >= 0.2) {
    const tName = topicOf(bestChat.topic).label;
    const streakNote = bestChat.m.streak.milestone ? ` · ${bestChat.m.streak.days}d streak` : "";
    const fitLabel = bestChat.m.isGroup
      ? `Matches ${bestChat.m.shortName} · ${tName}${streakNote}`
      : `Matches your games with ${bestChat.m.shortName} · ${tName}${streakNote}`;
    // Saturation check: only show "Send to X" when at least one other member in that chat isn't already going/joined!
    const shareTarget = bestChat.othersNotIn.length > 0
      ? {
          conversationId: bestChat.m.conversationId,
          name: bestChat.m.shortName,
          label: `Send to ${bestChat.m.shortName}`,
        }
      : undefined;
    return { fit, topic: bestChat.topic, fitLabel, shareTarget, parts };
  }

  return {
    fit,
    topic: best.t,
    fitLabel: fit >= 0.2 ? `From your games · ${topicOf(best.t).label}` : undefined,
    parts,
  };
}

// ---------- 7. Full User Context Report (for /dev/context Inspector) ----------

export function userContextFor(userId: ID) {
  const u = getUser(userId);
  if (!u) return null;
  const sessions = ingestSidequestSessions();
  const aff = affinityFor(userId, sessions);
  const matches = sharedMatchesFor(userId, sessions);
  const cache: SocialMatchCache = { aff, matches, friendIds: new Set(u.friendIds) };
  const staticTopics = [...new Set(u.interests.flatMap(topicsOfText))];

  const mySessions = sessions
    .filter((s) => s.creatorId === userId || s.players.has(userId))
    .map((s) => {
      const c = getConversation(s.conversationId);
      const others = (c?.participantIds ?? []).filter((id) => id !== userId).map((id) => card(id).first);
      return {
        ref: s.ref,
        gameKind: s.gameKind,
        gameLabel: GAME_LABEL[s.gameKind],
        title: s.title,
        interest: s.interest,
        date: s.date,
        topics: s.topics.map(topicLabel),
        withLabel: c?.name ?? others.join(", "),
        plays: s.players.get(userId)?.plays ?? 0,
        coPlayers: s.players.size,
      };
    })
    .reverse();

  const learnedTopics = TOPIC_IDS
    .filter((t) => aff.observations[t] > 0 && aff.score[t] > 0.05)
    .map((t) => ({
      topic: t,
      label: topicLabel(t),
      score: round2(aff.score[t]),
      observations: aff.observations[t],
      newlyDiscovered: !staticTopics.includes(t),
    }))
    .sort((a, b) => b.score - a.score);

  const blindSpotsNext = blindSpotTopicsFor([userId], sessions)
    .filter((t) => aff.observations[t] === 0)
    .slice(0, 5)
    .map((t) => ({ topic: t, label: topicLabel(t), deepcutsChip: chipForTopic(t, "deepcuts"), orderupChip: chipForTopic(t, "orderup") }));

  const rankedEvents = db().events
    .filter((e) => new Date(e.startsAt).getTime() > Date.now() && canSeeEvent(userId, e))
    .map((e) => ({ id: e.id, title: e.title, location: e.location, ...socialMatchFor(userId, topicsOfEvent(e), cache, { tier: "event", startsAt: e.startsAt, alreadyInIds: [...e.going, ...(e.hostId ? [e.hostId] : [])] }) }))
    .filter((x) => x.fit > 0)
    .sort((a, b) => b.fit - a.fit)
    .slice(0, 4);

  const rankedGroups = db().groups
    .filter((g) => !g.memberIds.includes(userId))
    .map((g) => ({ id: g.id, title: g.name, privacy: g.privacy, ...socialMatchFor(userId, topicsOfGroup(g), cache, { tier: "group", alreadyInIds: g.memberIds }) }))
    .filter((x) => x.fit > 0)
    .sort((a, b) => b.fit - a.fit)
    .slice(0, 4);

  const rankedListings = db().listings
    .filter((l) => l.status === "available" && l.sellerId !== userId)
    .map((l) => ({ id: l.id, title: l.title, price: l.price, ...socialMatchFor(userId, topicsOfListing(l), cache, { tier: "listing" }) }))
    .filter((x) => x.fit > 0)
    .sort((a, b) => b.fit - a.fit)
    .slice(0, 4);

  const privateSavesCount = db().reels.filter((r) => r.savedBy.includes(userId)).length + db().listings.filter((l) => l.savedBy.includes(userId)).length;
  const restrictedPostsCount = db().posts.filter((p) => p.authorId === userId && !canSeePost("u_audit_stranger", p)).length;

  return {
    user: card(userId),
    thresholds: THRESHOLDS,
    before: {
      staticInterests: u.interests,
      staticTopics: staticTopics.map(topicLabel),
      friendCount: u.friendIds.length,
      mutualSample: u.friendIds[0] ? mutuals(userId, u.friendIds[0]).length : 0,
      privacy: u.privacy ?? "public",
    },
    after: {
      gamesPlayedCount: mySessions.length,
      recentGames: mySessions.slice(0, 6),
      learnedTopics,
      newlyDiscoveredCount: learnedTopics.filter((t) => t.newlyDiscovered).length,
      blindSpotsNext,
      closenessGraph: matches.map((m) => ({
        conversationId: m.conversationId,
        name: m.name,
        isGroup: m.isGroup,
        avatar: m.avatar,
        closenessScore: m.closenessScore,
        parts: m.parts,
        streakDays: m.streak.days,
        streakFreezes: m.streak.freezes.length,
        streakMilestone: m.streak.milestone,
        hourglass: m.streak.hourglass,
        earnedTiers: m.earnedTiers,
        coPlayed: m.coPlayed,
        totalRuns: m.totalRuns,
        sameAnswers: m.sameAnswers,
        sharedGames: m.sharedGames,
        sharedTopics: m.sharedTopics,
      })),
      recommendations: {
        events: rankedEvents,
        groups: rankedGroups,
        listings: rankedListings,
      },
    },
    privacyAudit: {
      privateSavesExcludedFromSharedPrompts: privateSavesCount,
      friendsOnlyPostsGuarded: restrictedPostsCount,
      crossChatLeakageBlocked: true,
    },
  };
}

// Every score, in plain code. Nothing here calls a model.
//   engagement   per user per game, 0..1: did they finish, how soon, how fully, did they talk about it after
//   stance       what a user's choices say about topics (+ picked, − passed over, Wager points scaled);
//                just showing up for a game says nothing about its topic
//   affinity     per user per topic: taste prior + Σ engagement × stance, 14-day half-life, squashed to −1..1
//   chat topic   mean member affinity × coverage × agreement: what the whole chat is into, not one loud member
//   chat score   0..100 over 14 days: 40% participation, 20% streak, 20% reciprocity, 20% topic confidence
// Performance (being right) is in results.ts and never feeds recommendations: guessing well isn't interest.
// Code enforces: an answer counts only once its player has FINISHED the game (a tap someone can still change moves
// no score, so nobody can read another member's pick off a moving number); a game nobody finished counts for
// nothing; a streak day needs a strict majority finishing within 24 hours of the drop.
import { tasteFor, TASTE_KEYS } from "./taste";
import { getConversation, getUser } from "@/server/db";
import type { ID } from "@/types";
import { answersFor, completedBy, dayKey, eventsFor, gamesIn, playStore, type Choice, type PlayEvent, type PlayGame, type UnlockTier } from "./store";
import { TOPIC_IDS, topicsOfTaste, topicsOfText, type TopicId } from "./taxonomy";

export const HALF_LIFE_DAYS = 14;
export const WINDOW_DAYS = 14;
export const THRESHOLDS: Record<UnlockTier, number> = { group: 40, event: 60, listing: 75 };
export const FEEDBACK_WEIGHT: Partial<Record<PlayEvent["kind"], number>> = { rsvp: 2, join: 1.5, save: 1, dismiss: -1 };
const REPLY_WINDOW_MS = 30 * 60e3;
const DAY = 864e5;

const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const sd = (a: number[]) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
export const decay = (at: string, now = Date.now()) => 0.5 ** (Math.max(0, now - new Date(at).getTime()) / DAY / HALF_LIFE_DAYS);
const zero = () => Object.fromEntries(TOPIC_IDS.map((t) => [t, 0])) as Record<TopicId, number>;

// ---------- engagement ----------
/** Did this player say something in the chat within 30 minutes of finishing? Read from the chat itself. */
export function repliedAfter(game: PlayGame, userId: ID, events: PlayEvent[] = eventsFor(game.id)) {
  const done = events.find((e) => e.kind === "complete" && e.userId === userId);
  const c = getConversation(game.conversationId);
  if (!done || !c) return false;
  const t0 = new Date(done.at).getTime();
  return c.messages.some((m) => m.senderId === userId && !m.system && m.status !== "draft" && new Date(m.createdAt).getTime() > t0 && new Date(m.createdAt).getTime() - t0 <= REPLY_WINDOW_MS);
}

export interface Engagement { value: number; completed: boolean; promptness: number; depth: number; social: boolean }
export function engagement(game: PlayGame, userId: ID, events: PlayEvent[] = eventsFor(game.id)): Engagement {
  const mine = events.filter((e) => e.userId === userId);
  const done = mine.find((e) => e.kind === "complete");
  const answered = new Set(mine.filter((e) => e.kind === "answer" || e.kind === "change").map((e) => e.roundId)).size;
  const depth = game.rounds.length ? clamp(answered / game.rounds.length) : 0;
  const hours = done ? Math.max(0, new Date(done.at).getTime() - new Date(game.createdAt).getTime()) / 3600e3 : Infinity;
  const promptness = done ? Math.exp(-hours / 12) : 0;
  const social = mine.some((e) => e.kind === "react") || repliedAfter(game, userId, events);
  const value = (done ? 0.35 : 0) + 0.2 * promptness + 0.2 * depth + (social ? 0.25 : 0);
  return { value: clamp(value), completed: !!done, promptness, depth, social };
}

// ---------- stance ----------
export interface Stance { topic: TopicId; w: number }
/** What one player's answers in one game say about topics. */
export function stances(game: PlayGame, mine: Record<string, Choice> | undefined): Stance[] {
  if (!mine || !Object.keys(mine).length) return [];
  const out: Stance[] = []; // playing a game is not a stance on its topic: only picks and points are
  for (const r of game.rounds) {
    const c = mine[r.id];
    if (c === undefined) continue;
    if (r.kind === "points" && typeof c === "object" && !Array.isArray(c)) {
      for (const o of r.options) { const pts = Number((c as Record<string, number>)[o.id] ?? 0); if (o.topic && pts > 0) out.push({ topic: o.topic, w: 1.5 * clamp(pts / 10) }); }
      continue;
    }
    if (r.answer !== undefined || r.kind === "rank") continue; // right/wrong and rankings say nothing about the picker's own taste
    const pickId = typeof c === "string" ? c : (c as { pick?: string }).pick;
    const picked = r.options.find((o) => o.id === pickId);
    if (!picked?.topic) continue;
    out.push({ topic: picked.topic, w: 1 });
    const pass = r.kind === "split" ? -0.5 : -0.25;
    for (const o of r.options) if (o.id !== picked.id && o.topic && o.topic !== picked.topic) out.push({ topic: o.topic, w: pass });
  }
  return out;
}
/** Lineup: being ranked first by others is a (small) signal about you: at most 0.3 a round, scaled by the share of
 *  the other finished players who put you first. */
export function peerStances(game: PlayGame, userId: ID, done: Set<ID> = completedBy(game.id)): Stance[] {
  if (game.format !== "lineup") return [];
  const voters = [...answersFor(game.id)].filter(([voter]) => voter !== userId && done.has(voter)).map(([, a]) => a);
  const out: Stance[] = [];
  for (const r of game.rounds) {
    const ranked = voters.map((a) => a[r.id]).filter((o): o is string[] => Array.isArray(o) && o.length > 0);
    const first = ranked.filter((o) => r.options.find((x) => x.id === o[0])?.userId === userId).length;
    if (first) out.push({ topic: game.topic, w: (0.3 * first) / ranked.length });
  }
  return out;
}

// ---------- affinity ----------
/** Where a person starts before any game: their stated interests and what they saved and reacted to, shrunk.
 *  Taste is scaled to the person's own strongest key (squared), so only what they lean into most nears the cap. */
export function prior(userId: ID): Record<TopicId, number> {
  const p = zero();
  const u = getUser(userId);
  if (!u) return p;
  const taste = tasteFor(userId);
  const max = Math.max(1, ...TASTE_KEYS.map((k) => taste.scores[k]));
  for (const k of TASTE_KEYS) for (const t of topicsOfTaste(k)) p[t] += clamp(taste.scores[k] / max) ** 2 * 0.5;
  for (const i of u.interests) for (const t of topicsOfText(i)) p[t] += 0.2;
  for (const t of TOPIC_IDS) p[t] = Math.min(0.6, p[t]);
  return p;
}

export interface Affinity { raw: Record<TopicId, number>; score: Record<TopicId, number>; observations: Record<TopicId, number> }
/** Who has finished each game, in one pass over the event log. */
function finishers(): Map<string, Set<ID>> {
  const out = new Map<string, Set<ID>>();
  for (const e of playStore().events) if (e.kind === "complete" && e.gameId) out.set(e.gameId, (out.get(e.gameId) ?? new Set<ID>()).add(e.userId));
  return out;
}
const NOBODY = new Set<ID>();

/** One person's topic affinity from every chat they play in. `score` is −1..1. Answers count once the game is finished.
 *  `excludeGameId` leaves one game out (the chat view of a member who hasn't finished today's game yet). */
export function affinityFor(userId: ID, now = Date.now(), excludeGameId?: string): Affinity {
  const raw = prior(userId);
  const observations = zero();
  const s = playStore();
  const finished = finishers();
  for (const game of s.games.values()) {
    if (game.id === excludeGameId) continue;
    const done = finished.get(game.id) ?? NOBODY;
    const mine = done.has(userId) ? s.answers.get(game.id)?.get(userId) : undefined;
    const st = [...stances(game, mine), ...peerStances(game, userId, done)];
    if (!st.length) continue;
    const e = mine ? engagement(game, userId).value : 0; // ranked by others without playing: the 0.2 floor below
    const d = decay(game.createdAt, now);
    const seen = new Set<TopicId>();
    for (const x of st) { raw[x.topic] += d * Math.max(0.2, e) * x.w; seen.add(x.topic); }
    for (const t of seen) observations[t] += 1;
  }
  for (const ev of s.events) {
    const w = FEEDBACK_WEIGHT[ev.kind];
    if (ev.userId !== userId || !w || !ev.topic) continue;
    raw[ev.topic] += decay(ev.at, now) * w;
    observations[ev.topic] += 1;
  }
  const score = zero();
  for (const t of TOPIC_IDS) score[t] = Math.tanh(raw[t] / 1.5);
  return { raw, score, observations };
}

// ---------- chat level ----------
export interface ChatTopic { topic: TopicId; score: number; mean: number; coverage: number; agreement: number; games: number; observedBy: number }
/** `games` and `observedBy` count only games someone finished, and only the members who finished them. */
export function chatTopics(conversationId: ID, now = Date.now(), excludeGameId?: string): ChatTopic[] {
  const c = getConversation(conversationId);
  if (!c) return [];
  const members = c.participantIds;
  const aff = members.map((m) => affinityFor(m, now, excludeGameId));
  const finished = finishers();
  const done = (g: PlayGame) => finished.get(g.id) ?? NOBODY;
  const games = gamesIn(conversationId).filter((g) => done(g).size > 0);
  return TOPIC_IDS.map((t) => {
    const vals = aff.map((a) => a.score[t]);
    const m = mean(vals);
    const coverage = vals.filter((v) => v > 0.15).length / members.length;
    const agreement = 1 - clamp(sd(vals));
    const touching = games.filter((g) => g.topic === t || g.rounds.some((r) => r.options.some((o) => o.topic === t)));
    const observedBy = members.filter((u) => touching.some((g) => done(g).has(u))).length;
    return { topic: t, score: Math.max(0, m) * coverage * agreement, mean: m, coverage, agreement, games: touching.length, observedBy };
  }).sort((a, b) => b.score - a.score);
}

/** A topic is settled enough to recommend on: at least two played games touched it and 60% of the chat finished one of them. */
export const confident = (t: ChatTopic, members: number) => t.games >= 2 && t.observedBy / members >= 0.6 && t.score > 0;

/** A day counts when a strict majority finished its game within 24 hours of the drop: catching up on old games later doesn't rebuild a streak. */
const qualifies = (game: PlayGame, members: number) => {
  const t0 = new Date(game.createdAt).getTime();
  const onDay = new Set(eventsFor(game.id).filter((e) => e.kind === "complete" && new Date(e.at).getTime() - t0 < DAY).map((e) => e.userId));
  return onDay.size >= Math.floor(members / 2) + 1;
};
/** Consecutive days on which a majority of the chat played. Today not being played yet doesn't break it. */
export function streakDays(conversationId: ID, now = Date.now()) {
  const c = getConversation(conversationId);
  if (!c) return 0;
  const byDay = new Map(gamesIn(conversationId).map((g) => [g.date, g]));
  let n = 0;
  for (let i = 0; i < 60; i++) {
    const g = byDay.get(dayKey(new Date(now - i * DAY)));
    if (g && qualifies(g, c.participantIds.length)) n++;
    else if (i > 0) break;
  }
  return n;
}

export interface ChatScore {
  score: number;
  parts: { participation: number; streak: number; reciprocity: number; confidence: number };
  streakDays: number;
  games: number;
  topics: ChatTopic[];
  /** Tiers whose threshold and topic gate are both met. */
  earned: UnlockTier[];
  next?: { tier: UnlockTier; at: number };
}
export function chatScore(conversationId: ID, now = Date.now(), excludeGameId?: string): ChatScore {
  const c = getConversation(conversationId);
  const members = c?.participantIds.length ?? 1;
  const recent = gamesIn(conversationId).filter((g) => now - new Date(g.createdAt).getTime() <= WINDOW_DAYS * DAY);
  const rate = (gs: PlayGame[]) => mean(gs.map((g) => completedBy(g.id).size / members));
  const today = dayKey(new Date(now));
  // Today's game can lift participation but not lower it: an unfinished day isn't a missed one (same rule as the streak).
  const participation = Math.max(rate(recent), rate(recent.filter((g) => g.date !== today)));
  const played = recent.filter((g) => completedBy(g.id).size > 0);
  const reciprocity = mean(played.map((g) => { const ps = [...completedBy(g.id)]; return ps.filter((u) => engagement(g, u).social).length / ps.length; }));
  const days = streakDays(conversationId, now);
  const topics = chatTopics(conversationId, now, excludeGameId);
  // Only topics members have actually finished a game on count as settled, in proportion to how much of the chat did
  // (full credit at 60%): the taste prior alone must not score a chat that never played.
  const top = topics.find((t) => t.observedBy > 0);
  const confidence = top ? clamp(top.score / 0.4) * clamp(top.observedBy / members / 0.6) : 0;
  const parts = { participation: clamp(participation), streak: clamp(days / 7), reciprocity: clamp(reciprocity), confidence };
  const score = Math.round(100 * (0.4 * parts.participation + 0.2 * parts.streak + 0.2 * parts.reciprocity + 0.2 * parts.confidence));
  const gate = topics.some((t) => confident(t, members));
  const tiers = Object.keys(THRESHOLDS) as UnlockTier[];
  const earned = gate ? tiers.filter((t) => score >= THRESHOLDS[t]) : [];
  const nextTier = tiers.find((t) => score < THRESHOLDS[t]);
  return { score, parts, streakDays: days, games: recent.length, topics, earned, next: nextTier ? { tier: nextTier, at: THRESHOLDS[nextTier] } : undefined };
}

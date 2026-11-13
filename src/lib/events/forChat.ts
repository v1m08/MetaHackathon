// Event unlock popup: after a Sidequest game is scored in a chat, pick upcoming events for that chat once it has earned
// the Event tier of the Connection Score (src/lib/context: 40 Group, 60 Event, 75 Marketplace, plus a settled topic).
// An event has to relate to the game just played, to the chat's settled topics, or to interests every member lists
// publicly. Privacy follows the Context engine: only this chat's games and topics, public profile interests and
// attendee counts. Never another member's games from other chats or their learned affinity.
import { connectionScoreFor, FRIENDS_CAP, FRIENDS_EACH, ingestSidequestSessions, THRESHOLDS, type SidequestSession } from "@/lib/context";
import { dayKey } from "@/lib/context/day";
import { topic as topicOf, topicsOfEvent, topicsOfText, type TopicId } from "@/lib/context/taxonomy";
import { canSeeEvent } from "@/lib/context/visibility";
import { db, getConversation, getUser } from "@/server/db";
import type { Database, FBEvent, ID } from "@/types";

/** An event needs at least this fit to be shown. */
export const EVENT_FIT_MIN = 0.6;
/** One suggestion: of the events that fit, the one closest to everyone's profiles. */
export const MAX_PICKS = 1;
/** Relevance is the strongest source; each extra agreeing source, friends going and soonness add a little. */
export const FIT = {
  game: 1,
  gameSecondary: 0.65,
  chat: 0.8,
  profiles: 0.6,
  eventSecondary: 0.65,
  agreeEach: 0.1,
  agreeCap: 0.2,
  soonMax: 0.1,
  soonDays: 21,
} as const;
/** A settled chat topic at this agreement score counts in full (the engine's own confidence normalization). */
export const CHAT_TOPIC_FULL = 0.35;
/** In a group, a profile interest counts when at least this share of members list it (a 1:1 needs both). */
export const GROUP_PROFILE_SHARE = 0.5;

const DAY = 864e5;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const round3 = (n: number) => Math.round(n * 1000) / 1000;

export type RsvpStatus = "going" | "interested" | "none";

export interface EventPick {
  id: string;
  title: string;
  cover: string;
  startsAt: string;
  location: string;
  why: string;
  myStatus: RsvpStatus;
  /** False when every other member is already going or hosting (main's saturation rule): RSVP is the action then. */
  canSend: boolean;
  fit: number;
}

export interface EventPicks {
  /** True when the game just finished is what earned the chat the Event tier. The score itself never reaches the client. */
  unlocked: boolean;
  streak: { days: number; milestone?: number };
  isGroup: boolean;
  /** The other person's first name in a 1:1, the chat's name in a group. */
  withName: string;
  muse: string;
  game: { title: string; topicLabel?: string };
  picks: EventPick[];
}

export type EventPicksResult = ({ show: true } & EventPicks) | { show: false; reason: string };

// ---------- cadence: once per game per person, one popup per person per chat per Austin day ----------

interface Ledger { games: Set<string>; days: Set<string>; chats: Set<ID> }
// Keyed by the db object, so resetDb() starts a fresh ledger. On globalThis so hot reloads keep it.
const g = globalThis as unknown as { __eventPicksShown?: WeakMap<Database, Ledger> };
function ledger(): Ledger {
  g.__eventPicksShown ??= new WeakMap();
  const d = db();
  let l = g.__eventPicksShown.get(d);
  if (!l) g.__eventPicksShown.set(d, (l = { games: new Set(), days: new Set(), chats: new Set() }));
  return l;
}
const gameKey = (viewerId: ID, ref: string) => `${viewerId}|${ref}`;
const chatDayKey = (viewerId: ID, conversationId: ID, now: number) => `${viewerId}|${conversationId}|${dayKey(now)}`;

function requireMember(conversationId: ID, viewerId: ID) {
  const c = getConversation(conversationId);
  if (!c || !c.participantIds.includes(viewerId)) throw Object.assign(new Error("Not in this chat"), { status: 404 });
  return c;
}

/** Records that the popup was shown, so it counts toward the cadence, and the chat's Event unlock sticks. Idempotent. */
export function markEventPicksShown(conversationId: ID, viewerId: ID, gameRef: string, now = Date.now()) {
  requireMember(conversationId, viewerId);
  const l = ledger();
  l.games.add(gameKey(viewerId, gameRef));
  l.days.add(chatDayKey(viewerId, conversationId, now));
  l.chats.add(conversationId);
}

// ---------- fit ----------

interface FitContext {
  viewerId: ID;
  friendIds: ID[];
  memberIds: ID[];
  gameTopics: TopicId[];
  /** The chat's settled topics, `mean × coverage × (1 − SD)` from the engine. */
  chatTopics: Partial<Record<TopicId, number>>;
  /** Share of members whose public profile interests include the topic. */
  profileShare: Partial<Record<TopicId, number>>;
  profileMin: number;
  /** Each member's public profile topics, in `memberIds` order. */
  memberTopics: Set<TopicId>[];
  now: number;
}

interface ProfileAlign { align: number; topic?: TopicId; listers: number }
interface Fit { fit: number; topic: TopicId; game: number; chat: number; profiles: number; profile: ProfileAlign }

/** How closely an event matches the members' public profiles: each member's best match across the event's topics
 *  (1 for its main topic, 0.65 for the others), averaged over the chat. 1 means everyone lists its main topic. */
function profileAlign(topics: TopicId[], ctx: FitContext): ProfileAlign {
  const perMember = ctx.memberTopics.map((mine) => Math.max(0, ...topics.map((t, j) => (mine.has(t) ? (j === 0 ? 1 : FIT.eventSecondary) : 0))));
  let topic: TopicId | undefined;
  let listers = 0;
  for (const t of topics) {
    const n = ctx.memberTopics.filter((mine) => mine.has(t)).length;
    if (n > listers) [topic, listers] = [t, n];
  }
  return { align: round3(perMember.reduce((s, v) => s + v, 0) / Math.max(1, perMember.length)), topic, listers };
}

function fitFor(e: FBEvent, ctx: FitContext): Fit | null {
  let best: (Omit<Fit, "fit" | "profile"> & { score: number }) | undefined;
  const topics = topicsOfEvent(e);
  topics.forEach((t, j) => {
    const w = j === 0 ? 1 : FIT.eventSecondary;
    const gi = ctx.gameTopics.indexOf(t);
    const game = gi < 0 ? 0 : gi === 0 ? FIT.game : FIT.gameSecondary;
    const chat = FIT.chat * clamp((ctx.chatTopics[t] ?? 0) / CHAT_TOPIC_FULL);
    const share = ctx.profileShare[t] ?? 0;
    const profiles = share >= ctx.profileMin ? FIT.profiles * share : 0;
    const sources = [game, chat, profiles].filter((v) => v > 0);
    if (!sources.length) return;
    const score = w * Math.max(...sources) + Math.min(FIT.agreeCap, (sources.length - 1) * FIT.agreeEach);
    if (!best || score > best.score) best = { score, topic: t, game, chat, profiles };
  });
  if (!best) return null;
  const friends = e.going.filter((id) => id !== ctx.viewerId && ctx.friendIds.includes(id)).length;
  const daysOut = (new Date(e.startsAt).getTime() - ctx.now) / DAY;
  const soon = FIT.soonMax * clamp(1 - Math.max(0, daysOut) / FIT.soonDays);
  const { score, ...rest } = best;
  return { ...rest, profile: profileAlign(topics, ctx), fit: round3(score + Math.min(FRIENDS_CAP, friends * FRIENDS_EACH) + soon) };
}

const first = (id: ID) => getUser(id)?.name.split(" ")[0] ?? "A friend";

function whyFor(e: FBEvent, f: Fit, ctx: FitContext, isGroup: boolean, canSend: boolean): string {
  const parts: string[] = [];
  // Profiles first: it's why this event was picked. Profile interests are public, so naming who lists one is fine.
  const p = f.profile;
  if (p.topic && p.listers > 0) {
    const label = topicOf(p.topic).label;
    const n = ctx.memberIds.length;
    if (p.listers === n) parts.push(`${isGroup ? "You all" : "You both"} list ${label}`);
    else if (isGroup) parts.push(p.listers * 2 >= n ? `Most of you list ${label}` : `${p.listers} of you list ${label}`);
    else {
      const who = ctx.memberIds.find((_, i) => ctx.memberTopics[i].has(p.topic!))!;
      parts.push(who === ctx.viewerId ? `You list ${label}` : `${first(who)} lists ${label}`);
    }
  }
  const label = topicOf(f.topic).label;
  if (f.game > 0) parts.push(`Fits your ${label} game`);
  else if (f.chat > 0) parts.push(isGroup ? `The chat keeps playing ${label}` : `You two keep playing ${label}`);
  // Attendee lists are public on the event page, so naming chat members who are going is fine.
  const others = ctx.memberIds.filter((id) => id !== ctx.viewerId);
  const membersIn = others.filter((id) => e.going.includes(id) || e.hostId === id);
  const friends = e.going.filter((id) => id !== ctx.viewerId && ctx.friendIds.includes(id) && !membersIn.includes(id)).length;
  let social = "";
  if (!canSend) social = others.length === 1 ? `${first(others[0])} is ${e.hostId === others[0] ? "hosting" : "going"}` : "Everyone else is going";
  else if (membersIn.length === 1) social = `${first(membersIn[0])} is ${e.hostId === membersIn[0] ? "hosting" : "going"}`;
  else if (membersIn.length > 1) social = `${membersIn.length} of you are going`;
  else if (friends) social = `${friends} friend${friends === 1 ? "" : "s"} going`;
  // The social line matters most when it changes the action (saturated), so it replaces the second reason then.
  if (social) {
    if (!canSend) parts.splice(1, parts.length, social);
    else parts.push(social);
  }
  return parts.slice(0, 2).join(" · ");
}

function museLine(p: { unlocked: boolean; isGroup: boolean; withName: string; milestone?: number }) {
  const streak = p.milestone ? `${p.milestone}-day streak! ` : "";
  if (p.unlocked) return p.isGroup ? `${streak}This chat just unlocked events! This one fits the group.` : `${streak}You and ${p.withName} just unlocked events! This one fits you two.`;
  return p.isGroup ? `${streak || "Good game! "}This one fits the group.` : `${streak || "Good game! "}This one fits you and ${p.withName}.`;
}

/** The game as it stood before the viewer's latest finish: one fewer play, or without them if it was their first. */
function beforeFinish(game: SidequestSession, viewerId: ID): SidequestSession {
  const players = new Map(game.players);
  const run = players.get(viewerId)!;
  if (run.plays > 1) players.set(viewerId, { ...run, plays: run.plays - 1 });
  else players.delete(viewerId);
  return { ...game, players };
}

/** Checks the four benchmarks (game scored, Event tier earned, fit, cadence) and returns the popup, or why it doesn't show. */
export function eventPicksFor(conversationId: ID, viewerId: ID, gameRef: string, now = Date.now()): EventPicksResult {
  const c = requireMember(conversationId, viewerId);
  const viewer = getUser(viewerId)!;

  // 1. Game scored: the viewer has finished this game in this chat.
  const sessions = ingestSidequestSessions();
  const game = sessions.find((s) => s.conversationId === c.id && s.ref === gameRef);
  if (!game || !game.players.has(viewerId)) return { show: false, reason: "you haven't finished this game in this chat" };

  // 4. Cadence (checked early: it's the cheapest).
  const l = ledger();
  if (l.games.has(gameKey(viewerId, gameRef))) return { show: false, reason: "already shown for this game" };
  if (l.days.has(chatDayKey(viewerId, c.id, now))) return { show: false, reason: "already shown in this chat today" };

  // 2. Event tier earned: the chat's Connection Score counting this finish, and before it (for the unlock moment).
  // An unlock sticks once a member has seen it: the score averages per game, so a fresh game can dip it under 60.
  const after = connectionScoreFor(c.id, sessions, now);
  const stuck = l.chats.has(c.id);
  // The reason stays number-free: users never see their score (the /dev/context inspector shows it).
  if (!after.earnedTiers.includes("event") && !stuck) {
    const why = after.score < THRESHOLDS.event ? "score below the Event tier" : "no settled topic yet";
    return { show: false, reason: `event tier not earned (${why})` };
  }
  const prior = beforeFinish(game, viewerId);
  const before = connectionScoreFor(c.id, sessions.map((s) => (s === game ? prior : s)), now);

  // 3. Fit: upcoming events every member can see, that the viewer isn't going to or hosting.
  const memberIds = c.participantIds;
  const memberTopics = memberIds.map((id) => new Set(topicsOfText(getUser(id)?.interests.join(" ") ?? "")));
  const profileCount: Partial<Record<TopicId, number>> = {};
  for (const mine of memberTopics) for (const t of mine) profileCount[t] = (profileCount[t] ?? 0) + 1;
  const ctx: FitContext = {
    viewerId,
    friendIds: viewer.friendIds,
    memberIds,
    gameTopics: game.topics,
    chatTopics: Object.fromEntries(after.topics.filter((t) => t.settled).map((t) => [t.topic, t.score])),
    profileShare: Object.fromEntries(Object.entries(profileCount).map(([t, n]) => [t, n / memberIds.length])),
    profileMin: c.isGroup ? GROUP_PROFILE_SHARE : 1,
    memberTopics,
    now,
  };
  const scored = db()
    .events.filter((e) => new Date(e.startsAt).getTime() > now && !e.going.includes(viewerId) && e.hostId !== viewerId && memberIds.every((id) => canSeeEvent(id, e)))
    .map((e) => ({ e, f: fitFor(e, ctx) }))
    .filter((x): x is { e: FBEvent; f: Fit } => !!x.f)
    .sort((a, b) => b.f.fit - a.f.fit);
  // Of the events that fit, suggest the one closest to everyone's profiles; ties go to the better fit, then the soonest.
  const picks = scored
    .filter((x) => x.f.fit >= EVENT_FIT_MIN)
    .sort((a, b) => b.f.profile.align - a.f.profile.align || b.f.fit - a.f.fit || a.e.startsAt.localeCompare(b.e.startsAt))
    .slice(0, MAX_PICKS);
  if (!picks.length) return { show: false, reason: scored.length ? `no event fits well enough (best ${scored[0].f.fit} < ${EVENT_FIT_MIN})` : "no upcoming event relates to this chat" };

  const other = memberIds.find((id) => id !== viewerId);
  const withName = c.isGroup ? (c.name ?? "the chat") : first(other ?? "");
  const unlocked = !stuck && !before.earnedTiers.includes("event");
  const milestone = after.streak.milestone;
  return {
    show: true,
    unlocked,
    streak: { days: after.streak.days, milestone },
    isGroup: c.isGroup,
    withName,
    muse: museLine({ unlocked, isGroup: c.isGroup, withName, milestone }),
    game: { title: game.title, topicLabel: game.topics[0] ? topicOf(game.topics[0]).label : undefined },
    picks: picks.map(({ e, f }) => {
      const canSend = memberIds.some((id) => id !== viewerId && !e.going.includes(id) && e.hostId !== id);
      return {
        id: e.id,
        title: e.title,
        cover: e.cover,
        startsAt: e.startsAt,
        location: e.location,
        why: whyFor(e, f, ctx, c.isGroup, canSend),
        myStatus: e.interested.includes(viewerId) ? "interested" : "none",
        canSend,
        fit: f.fit,
      };
    }),
  };
}

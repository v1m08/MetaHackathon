// Multi-surface post-game recommendations in Messenger: once a Sidequest game is scored and closed, surfaces the best
// matching items across Facebook's three local inventory surfaces gated by the chat's earned Connection Score tiers:
//   - 40+ (`group`):       Facebook Groups to join or share into the chat
//   - 60+ (`event`):       Upcoming Events to attend together
//   - 75+ (`listing`):     Local Marketplace finds (food, kitchen gear, instruments, bikes, hobbies)
// Privacy & anti-spam invariants:
//   - Strictly scoped to THIS chat's Sidequest sessions + public profile interests + public event/group rosters.
//   - Never reads private Marketplace `savedBy` for ranking (only checks viewer's own `saved` state for the UI toggle).
//   - Never exposes numeric Connection Scores to the client.
//   - Once per game per viewer, and at most one popup per viewer per chat per Austin calendar day (`America/Chicago`).
import { connectionScoreFor, FRIENDS_CAP, FRIENDS_EACH, ingestSidequestSessions, THRESHOLDS, type SidequestSession, type SurfaceTier } from "@/lib/context";
import { dayKey } from "@/lib/context/day";
import { topic as topicOf, topicsOfEvent, topicsOfGroup, topicsOfListing, topicsOfText, type TopicId } from "@/lib/context/taxonomy";
import { canSeeEvent } from "@/lib/context/visibility";
import { db, getConversation, getUser } from "@/server/db";
import type { Database, FBEvent, Group, ID, Listing } from "@/types";
import type { RsvpStatus } from "./forChat";

export const EVENT_MIN_FIT = 0.55;
export const GROUP_MIN_FIT = 0.45;
export const LISTING_MIN_FIT = 0.45;

const DAY = 864e5;
const CHAT_TOPIC_FULL = 0.35;
const GROUP_PROFILE_SHARE = 0.5;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const first = (id: ID) => getUser(id)?.name.split(" ")[0] ?? "A friend";

export interface EventChatPick {
  kind: "event";
  id: string;
  title: string;
  cover: string;
  startsAt: string;
  location: string;
  why: string;
  myStatus: RsvpStatus;
  canSend: boolean;
  fit: number;
  matchesGame: boolean;
}

export interface GroupChatPick {
  kind: "group";
  id: string;
  name: string;
  cover: string;
  memberCount: number;
  privacy: "public" | "private";
  why: string;
  joined: boolean;
  canSend: boolean;
  fit: number;
  matchesGame: boolean;
}

export interface ListingChatPick {
  kind: "listing";
  id: string;
  title: string;
  image: string;
  price: number;
  location: string;
  category: string;
  why: string;
  saved: boolean;
  canSend: boolean;
  fit: number;
  matchesGame: boolean;
}

export type ChatPickItem = EventChatPick | GroupChatPick | ListingChatPick;

export interface ChatPicks {
  unlockedTier?: SurfaceTier;
  earnedTiers: SurfaceTier[];
  streak: { days: number; milestone?: number };
  isGroup: boolean;
  withName: string;
  muse: string;
  game: { title: string; topicLabel?: string };
  items: ChatPickItem[];
}

export type ChatPicksResult = ({ show: true } & ChatPicks) | { show: false; reason: string };

// ---------- Cadence & sticky tier ledger (reset automatically when resetDb() swaps db()) ----------

interface MultiLedger {
  games: Set<string>;
  days: Set<string>;
  unlockedByChat: Map<ID, Set<SurfaceTier>>;
}
const g = globalThis as unknown as { __chatPicksLedger?: WeakMap<Database, MultiLedger> };
function ledger(): MultiLedger {
  g.__chatPicksLedger ??= new WeakMap();
  const d = db();
  let l = g.__chatPicksLedger.get(d);
  if (!l) g.__chatPicksLedger.set(d, (l = { games: new Set(), days: new Set(), unlockedByChat: new Map() }));
  return l;
}
const gameKey = (viewerId: ID, ref: string) => `${viewerId}|${ref}`;
const chatDayKey = (viewerId: ID, conversationId: ID, now: number) => `${viewerId}|${conversationId}|${dayKey(now)}`;

function requireMember(conversationId: ID, viewerId: ID) {
  const c = getConversation(conversationId);
  if (!c || !c.participantIds.includes(viewerId)) throw Object.assign(new Error("Not in this chat"), { status: 404 });
  return c;
}

/** Forgets the once-per-game / once-a-day cadence for one chat (a fresh game was dropped for the demo). Unlocks stay. */
export function clearChatPicksCadence(conversationId: ID) {
  const c = getConversation(conversationId);
  if (!c) return;
  const l = ledger();
  for (const k of [...l.days]) if (c.participantIds.some((id) => k.startsWith(`${id}|${conversationId}|`))) l.days.delete(k);
}

export function markChatPicksShown(conversationId: ID, viewerId: ID, gameRef: string, now = Date.now()) {
  requireMember(conversationId, viewerId);
  const l = ledger();
  l.games.add(gameKey(viewerId, gameRef));
  l.days.add(chatDayKey(viewerId, conversationId, now));
  const tiers = connectionScoreFor(conversationId, ingestSidequestSessions(), now).earnedTiers;
  let stick = l.unlockedByChat.get(conversationId);
  if (!stick) l.unlockedByChat.set(conversationId, (stick = new Set()));
  for (const t of tiers) stick.add(t);
}

// ---------- Shared Fit Scoring ----------

interface FitContext {
  viewerId: ID;
  friendIds: ID[];
  memberIds: ID[];
  isGroup: boolean;
  gameTopics: TopicId[];
  chatTopics: Partial<Record<TopicId, number>>;
  profileShare: Partial<Record<TopicId, number>>;
  profileMin: number;
  memberTopics: Set<TopicId>[];
  now: number;
}

interface BaseFit {
  baseScore: number;
  topic: TopicId;
  game: number;
  chat: number;
  profiles: number;
  profileAlign: number;
  profileTopic?: TopicId;
  profileListers: number;
}

function scoreTopics(topics: TopicId[], ctx: FitContext): BaseFit | null {
  if (!topics.length) return null;
  let best: { baseScore: number; topic: TopicId; game: number; chat: number; profiles: number } | undefined;
  topics.forEach((t, j) => {
    const w = j === 0 ? 1 : 0.65;
    const gi = ctx.gameTopics.indexOf(t);
    const game = gi < 0 ? 0 : gi === 0 ? 1 : 0.65;
    const chat = 0.8 * clamp((ctx.chatTopics[t] ?? 0) / CHAT_TOPIC_FULL);
    const share = ctx.profileShare[t] ?? 0;
    const profiles = share >= ctx.profileMin ? 0.6 * share : 0;
    const sources = [game, chat, profiles].filter((v) => v > 0);
    if (!sources.length) return;
    const sc = w * Math.max(...sources) + Math.min(0.2, (sources.length - 1) * 0.1);
    if (!best || sc > best.baseScore) best = { baseScore: sc, topic: t, game, chat, profiles };
  });
  if (!best) return null;

  const perMember = ctx.memberTopics.map((mine) => Math.max(0, ...topics.map((t, j) => (mine.has(t) ? (j === 0 ? 1 : 0.65) : 0))));
  let profileTopic: TopicId | undefined;
  let profileListers = 0;
  for (const t of topics) {
    const n = ctx.memberTopics.filter((mine) => mine.has(t)).length;
    if (n > profileListers) [profileTopic, profileListers] = [t, n];
  }
  const profileAlign = round3(perMember.reduce((s, v) => s + v, 0) / Math.max(1, perMember.length));
  return { ...best, profileAlign, profileTopic, profileListers };
}

function baseWhyParts(bf: BaseFit, ctx: FitContext): string[] {
  const parts: string[] = [];
  if (bf.profileTopic && bf.profileListers > 0) {
    const label = topicOf(bf.profileTopic).label;
    const n = ctx.memberIds.length;
    if (bf.profileListers === n) parts.push(`${ctx.isGroup ? "You all" : "You both"} list ${label}`);
    else if (ctx.isGroup) parts.push(bf.profileListers * 2 >= n ? `Most of you list ${label}` : `${bf.profileListers} of you list ${label}`);
    else {
      const who = ctx.memberIds.find((_, i) => ctx.memberTopics[i].has(bf.profileTopic!))!;
      parts.push(who === ctx.viewerId ? `You list ${label}` : `${first(who)} lists ${label}`);
    }
  }
  const label = topicOf(bf.topic).label;
  if (bf.game > 0) parts.push(`Fits your ${label} game`);
  else if (bf.chat > 0) parts.push(ctx.isGroup ? `The chat keeps playing ${label}` : `You two keep playing ${label}`);
  return parts;
}

function pickBestEvent(ctx: FitContext): EventChatPick | undefined {
  const candidates = db()
    .events.filter((e) => {
      if (new Date(e.startsAt).getTime() <= ctx.now) return false;
      if (!ctx.memberIds.every((id) => canSeeEvent(id, e))) return false;
      // Saturated only when everyone in the chat is already going or hosting.
      return ctx.memberIds.some((id) => !e.going.includes(id) && e.hostId !== id);
    })
    .map((e) => {
      const bf = scoreTopics(topicsOfEvent(e), ctx);
      if (!bf) return null;
      const friends = e.going.filter((id) => id !== ctx.viewerId && ctx.friendIds.includes(id)).length;
      const daysOut = (new Date(e.startsAt).getTime() - ctx.now) / DAY;
      const soon = 0.1 * clamp(1 - Math.max(0, daysOut) / 21);
      const fit = round3(bf.baseScore + Math.min(FRIENDS_CAP, friends * FRIENDS_EACH) + soon);
      return { e, bf, fit, friends };
    })
    .filter((x): x is NonNullable<typeof x> => !!x && x.fit >= EVENT_MIN_FIT)
    .sort(
      (a, b) =>
        Number(b.bf.game > 0) - Number(a.bf.game > 0) ||
        Number(!b.e.going.includes(ctx.viewerId) && b.e.hostId !== ctx.viewerId) - Number(!a.e.going.includes(ctx.viewerId) && a.e.hostId !== ctx.viewerId) ||
        b.bf.profileAlign - a.bf.profileAlign ||
        b.fit - a.fit ||
        a.e.startsAt.localeCompare(b.e.startsAt),
    );

  const top = candidates[0];
  if (!top) return undefined;
  const { e, bf, fit } = top;
  const viewerGoing = e.going.includes(ctx.viewerId) || e.hostId === ctx.viewerId;
  const others = ctx.memberIds.filter((id) => id !== ctx.viewerId);
  const canSend = others.some((id) => !e.going.includes(id) && e.hostId !== id);
  const membersIn = others.filter((id) => e.going.includes(id) || e.hostId === id);
  const extraFriends = e.going.filter((id) => id !== ctx.viewerId && ctx.friendIds.includes(id) && !membersIn.includes(id)).length;
  const parts = baseWhyParts(bf, ctx);
  let social = "";
  if (viewerGoing && others.length === 1 && canSend) social = `You're going · Invite ${first(others[0])}`;
  else if (!canSend) social = others.length === 1 ? `${first(others[0])} is ${e.hostId === others[0] ? "hosting" : "going"}` : "Everyone else is going";
  else if (membersIn.length === 1) social = `${first(membersIn[0])} is ${e.hostId === membersIn[0] ? "hosting" : "going"}`;
  else if (membersIn.length > 1) social = `${membersIn.length} of you are going`;
  else if (extraFriends) social = `${extraFriends} friend${extraFriends === 1 ? "" : "s"} going`;
  if (social) {
    if (!canSend) parts.splice(1, parts.length, social);
    else parts.push(social);
  }
  return {
    kind: "event",
    id: e.id,
    title: e.title,
    cover: e.cover,
    startsAt: e.startsAt,
    location: e.location,
    why: parts.slice(0, 2).join(" · "),
    myStatus: viewerGoing ? "going" : e.interested.includes(ctx.viewerId) ? "interested" : "none",
    canSend,
    fit,
    matchesGame: bf.game > 0,
  };
}

function pickBestGroup(ctx: FitContext): GroupChatPick | undefined {
  const others = ctx.memberIds.filter((id) => id !== ctx.viewerId);
  const candidates = db()
    .groups.filter((grp) => {
      const visible = grp.privacy === "public" || ctx.memberIds.every((id) => grp.memberIds.includes(id));
      if (!visible) return false;
      // Saturation check: skip groups where everyone in the chat is already a member.
      return ctx.memberIds.some((id) => !grp.memberIds.includes(id));
    })
    .map((grp) => {
      const bf = scoreTopics(topicsOfGroup(grp), ctx);
      if (!bf) return null;
      const friendsIn = grp.memberIds.filter((id) => id !== ctx.viewerId && ctx.friendIds.includes(id)).length;
      const fit = round3(bf.baseScore + Math.min(FRIENDS_CAP, friendsIn * FRIENDS_EACH));
      return { grp, bf, fit, friendsIn };
    })
    .filter((x): x is NonNullable<typeof x> => !!x && x.fit >= GROUP_MIN_FIT)
    .sort((a, b) => Number(b.bf.game > 0) - Number(a.bf.game > 0) || Number(!b.grp.memberIds.includes(ctx.viewerId)) - Number(!a.grp.memberIds.includes(ctx.viewerId)) || b.fit - a.fit);

  const top = candidates[0];
  if (!top) return undefined;
  const { grp, bf, fit, friendsIn } = top;
  const joined = grp.memberIds.includes(ctx.viewerId);
  const canSend = others.some((id) => !grp.memberIds.includes(id));
  const parts = baseWhyParts(bf, ctx);
  if (joined && others.length === 1 && !grp.memberIds.includes(others[0])) parts.splice(1, parts.length, `Invite ${first(others[0])}`);
  else if (friendsIn > 0) parts.push(`${friendsIn} friend${friendsIn === 1 ? "" : "s"} in group`);
  return {
    kind: "group",
    id: grp.id,
    name: grp.name,
    cover: grp.cover,
    memberCount: grp.memberIds.length,
    privacy: grp.privacy,
    why: parts.slice(0, 2).join(" · "),
    joined,
    canSend,
    fit,
    matchesGame: bf.game > 0,
  };
}

function pickBestListing(ctx: FitContext): ListingChatPick | undefined {
  const candidates = db()
    .listings.filter((l) => l.status === "available" && !ctx.memberIds.includes(l.sellerId))
    .map((l) => {
      // Strictly never inspect `l.savedBy` when computing fit or reasons (private Marketplace saves stay private).
      const bf = scoreTopics(topicsOfListing(l), ctx);
      if (!bf) return null;
      const ageDays = Math.max(0, (ctx.now - new Date(l.createdAt).getTime()) / DAY);
      const fresh = 0.06 * clamp(1 - ageDays / 21);
      const fit = round3(bf.baseScore + fresh);
      return { l, bf, fit };
    })
    .filter((x): x is NonNullable<typeof x> => !!x && x.fit >= LISTING_MIN_FIT)
    .sort((a, b) => Number(b.bf.game > 0) - Number(a.bf.game > 0) || b.fit - a.fit || b.l.createdAt.localeCompare(a.l.createdAt));

  const top = candidates[0];
  if (!top) return undefined;
  const { l, bf, fit } = top;
  const parts = baseWhyParts(bf, ctx);
  parts.push(`Local in ${l.location}`);
  return {
    kind: "listing",
    id: l.id,
    title: l.title,
    image: l.images[0] ?? "",
    price: l.price,
    location: l.location,
    category: l.category,
    why: parts.slice(0, 2).join(" · "),
    saved: l.savedBy.includes(ctx.viewerId),
    canSend: true,
    fit,
    matchesGame: bf.game > 0,
  };
}

function beforeFinish(game: SidequestSession, viewerId: ID): SidequestSession {
  const players = new Map(game.players);
  const run = players.get(viewerId)!;
  if (run.plays > 1) players.set(viewerId, { ...run, plays: run.plays - 1 });
  else players.delete(viewerId);
  return { ...game, players };
}

function museLine(opts: { unlockedTier?: SurfaceTier; items: ChatPickItem[]; isGroup: boolean; withName: string; milestone?: number }) {
  const streak = opts.milestone ? `${opts.milestone}-day streak! ` : "";
  const who = opts.isGroup ? "the group" : `you and ${opts.withName}`;
  if (opts.unlockedTier === "listing") return `${streak}Marketplace picks unlocked! Found local picks for ${who}.`;
  if (opts.unlockedTier === "event") return `${streak}${opts.isGroup ? "This chat" : `You and ${opts.withName}`} just unlocked events!`;
  if (opts.unlockedTier === "group") return `${streak}Groups unlocked! Here's a community that fits ${who}.`;
  if (opts.items.length > 1) return `${streak || "Good game! "}Picked across Facebook for ${who}.`;
  const kind = opts.items[0]?.kind;
  const noun = kind === "group" ? "group" : kind === "listing" ? "Marketplace find" : "event";
  return `${streak || "Good game! "}This ${noun} fits ${who}.`;
}

/**
 * `peek`: the viewer asked to see the picks again (the "See Muse's plans" button), so the once-per-game and
 * once-a-day cadence doesn't apply. Every other benchmark (finished the game, tier earned, something fits) still does.
 */
export function chatPicksFor(conversationId: ID, viewerId: ID, gameRef: string, now = Date.now(), opts: { peek?: boolean } = {}): ChatPicksResult {
  const c = requireMember(conversationId, viewerId);
  const viewer = getUser(viewerId)!;

  const sessions = ingestSidequestSessions();
  const game = sessions.find((s) => s.conversationId === c.id && s.ref === gameRef);
  if (!game || !game.players.has(viewerId)) return { show: false, reason: "you haven't finished this game in this chat" };

  const l = ledger();
  if (!opts.peek && l.games.has(gameKey(viewerId, gameRef))) return { show: false, reason: "already shown for this game" };
  if (!opts.peek && l.days.has(chatDayKey(viewerId, c.id, now))) return { show: false, reason: "already shown in this chat today" };

  const after = connectionScoreFor(c.id, sessions, now);
  const stuck = l.unlockedByChat.get(c.id) ?? new Set<SurfaceTier>();
  const tierSet = new Set<SurfaceTier>([...after.earnedTiers, ...stuck]);
  const tierOrder: SurfaceTier[] = ["group", "event", "listing"];
  const earnedTiers = tierOrder.filter((t) => tierSet.has(t));

  if (!earnedTiers.length) {
    const why = after.score < THRESHOLDS.group ? "score below the Group tier" : "no settled topic yet";
    return { show: false, reason: `no tier earned yet (${why})` };
  }

  const prior = beforeFinish(game, viewerId);
  const before = connectionScoreFor(c.id, sessions.map((s) => (s === game ? prior : s)), now);
  const newlyUnlocked = [...earnedTiers].reverse().find((t) => !stuck.has(t) && !before.earnedTiers.includes(t));

  const memberIds = c.participantIds;
  const memberTopics = memberIds.map((id) => new Set(topicsOfText(getUser(id)?.interests.join(" ") ?? "")));
  const profileCount: Partial<Record<TopicId, number>> = {};
  for (const mine of memberTopics) for (const t of mine) profileCount[t] = (profileCount[t] ?? 0) + 1;

  const ctx: FitContext = {
    viewerId,
    friendIds: viewer.friendIds,
    memberIds,
    isGroup: c.isGroup,
    gameTopics: game.topics,
    chatTopics: Object.fromEntries(after.topics.filter((t) => t.settled || (t.games >= 1 && t.observedBy >= 2 && t.score > 0.08)).map((t) => [t.topic, t.score])),
    profileShare: Object.fromEntries(Object.entries(profileCount).map(([t, n]) => [t, n / memberIds.length])),
    profileMin: c.isGroup ? GROUP_PROFILE_SHARE : 1,
    memberTopics,
    now,
  };

  const candidates: ChatPickItem[] = [];
  if (tierSet.has("event")) {
    const ev = pickBestEvent(ctx);
    if (ev) candidates.push(ev);
  }
  if (tierSet.has("group")) {
    const grp = pickBestGroup(ctx);
    if (grp) candidates.push(grp);
  }
  if (tierSet.has("listing")) {
    const lst = pickBestListing(ctx);
    if (lst) candidates.push(lst);
  }

  if (!candidates.length) return { show: false, reason: "no matching Event, Group, or Marketplace item found for this chat" };

  // Put items matching the game just played first, then order by fit descending.
  const items = candidates.sort((a, b) => Number(b.matchesGame) - Number(a.matchesGame) || b.fit - a.fit);
  const other = memberIds.find((id) => id !== viewerId);
  const withName = c.isGroup ? (c.name ?? "the chat") : first(other ?? "");
  const milestone = after.streak.milestone;

  return {
    show: true,
    unlockedTier: newlyUnlocked,
    earnedTiers,
    streak: { days: after.streak.days, milestone },
    isGroup: c.isGroup,
    withName,
    muse: museLine({ unlockedTier: newlyUnlocked, items, isGroup: c.isGroup, withName, milestone }),
    game: { title: game.title, topicLabel: game.topics[0] ? topicOf(game.topics[0]).label : undefined },
    items,
  };
}

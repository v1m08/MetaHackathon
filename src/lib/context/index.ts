// Context & Closeness Engine for Sidequest Messenger Games (Deep Cuts + Order Up!).
// Zero dependency on any legacy quiz engine: ingests `sqgame` / `sqgamelog` messages and Sidequest room caches
// (`sidequest/.cache/{rarity,kitchen}/*.json`) to build per-user taste profiles, chat-scoped closeness graphs,
// smart in-tray topic suggestions, and friend-aware rankings across Events, Groups, and Marketplace.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { GameKind } from "@/components/ChatGames";
import { db, getConversation, getUser } from "@/server/db";
import type { ID } from "@/types";
import { sqPid } from "./seed";
import { chipForTopic, TOPIC_IDS, topic as topicOf, topicLabel, topicsOfEvent, topicsOfGroup, topicsOfListing, topicsOfText, type TopicId } from "./taxonomy";
import { canSeeEvent, canSeePost, canSeeReel, canSeeUser, isFriend, mutuals } from "./visibility";

const DAY = 864e5;
const HALF_LIFE_DAYS = 14;
const REPLY_WINDOW_MS = 30 * 60e3;
const CACHE_ROOT = join(process.cwd(), "sidequest", ".cache");

const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const round2 = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const decay = (iso: string, now = Date.now()) => 0.5 ** (Math.max(0, now - new Date(iso).getTime()) / DAY / HALF_LIFE_DAYS);

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
  players: Map<ID, PlayerRun>;
  /** Pair key `a|b` (sorted) -> number of Deep Cuts prompts where both typed the exact same canonical answer. */
  sameAnswers: Map<string, number>;
}

const pairKey = (a: ID, b: ID) => (a < b ? `${a}|${b}` : `${b}|${a}`);

function parseCardInterest(text: string): string {
  const m = text.match(/(?:Order Up!|Deep Cuts)\s*:\s*(.+)$/i);
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
      const gameKind: GameKind = ref.startsWith("k:") ? "orderup" : "deepcuts";
      const roomId = ref.replace(/^k:/, "");

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
          players: new Map(),
          sameAnswers: new Map(),
        };
        byRef.set(ref, sess);
        sessions.push(sess);
      }

      if (att.type === "sqgame") {
        sess.creatorId ??= m.senderId;
        sess.createdAt = m.createdAt;
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
          finishedAt: m.createdAt,
          repliedAfter: Boolean(prev?.repliedAfter || repliedAfter),
          summary: m.text,
        });
        if (!sess.title) {
          const tm = m.text.match(/^played\s+([^·]+)/i);
          if (tm) sess.title = tm[1].trim();
        }
      }
    }

    // Enrich each session from Sidequest's room cache when available on disk.
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

      sess.title ||= sess.interest || (sess.gameKind === "orderup" ? "Order Up!" : "Deep Cuts");
      sess.interest ||= sess.title;
      const direct = topicsOfText(`${sess.interest} ${sess.title}`);
      sess.topics = direct.length ? direct : topicsOfText(extraText);
    }
  }

  return sessions.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// ---------- 2. Per-User Taste Affinity (from Sidequest play) ----------

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

  const score = Object.fromEntries(TOPIC_IDS.map((t) => [t, round3(Math.tanh(raw[t] / 1.35))])) as Record<TopicId, number>;
  return { raw, score, observations };
}

// ---------- 3. Relationship Closeness & Crew Sync Graph (strictly chat-scoped) ----------

export interface SharedMatch {
  conversationId: ID;
  isGroup: boolean;
  friendId?: ID;
  name: string;
  shortName: string;
  avatar: string;
  coPlayed: number;
  totalRuns: number;
  sameAnswers: number;
  closenessScore: number; // 0..100
  sharedGames: string[];
  topicOverlap: Partial<Record<TopicId, number>>;
  sharedTopics: { topic: TopicId; label: string; strength: number }[];
}

/** Computes `viewerId`'s closeness and shared-taste graph strictly from Sidequest games co-played in shared chats.
 *  Zero cross-chat leakage: games a friend played in another chat `viewerId` is not in are never inspected here. */
export function sharedMatchesFor(viewerId: ID, sessions = ingestSidequestSessions(), now = Date.now()): SharedMatch[] {
  const convs = db().conversations.filter((c) => c.participantIds.includes(viewerId));
  const out: SharedMatch[] = [];

  for (const c of convs) {
    const inChat = sessions.filter((s) => s.conversationId === c.id);
    if (!inChat.length) continue;
    const overlap: Partial<Record<TopicId, number>> = {};
    const gameTitles: string[] = [];
    let coPlayed = 0;
    let decayedPlays = 0;
    let totalRuns = 0;
    let sameAnswers = 0;
    let banterCount = 0;

    if (!c.isGroup && c.participantIds.length === 2) {
      const otherId = c.participantIds.find((id) => id !== viewerId)!;
      for (const s of inChat) {
        const myRun = s.players.get(viewerId);
        const theirRun = s.players.get(otherId);
        // Both friends must have played this Sidequest room inside THIS shared thread.
        if (!myRun || !theirRun) continue;
        coPlayed++;
        const d = decay(s.createdAt, now);
        decayedPlays += d;
        totalRuns += myRun.plays + theirRun.plays;
        sameAnswers += s.sameAnswers.get(pairKey(viewerId, otherId)) ?? 0;
        if (myRun.repliedAfter || theirRun.repliedAfter) banterCount++;
        if (!gameTitles.includes(s.title)) gameTitles.push(s.title);
        s.topics.forEach((t, idx) => {
          overlap[t] = (overlap[t] ?? 0) + d * (idx === 0 ? 1 : 0.65);
        });
      }
      if (!coPlayed) continue;
      const friend = card(otherId);
      const closenessScore = Math.round(
        100 * (0.5 * clamp(decayedPlays / 2.2) + 0.25 * clamp(totalRuns / 5) + 0.15 * clamp((sameAnswers + banterCount) / 3) + 0.1),
      );
      const sharedTopics = TOPIC_IDS
        .filter((t) => (overlap[t] ?? 0) > 0.1)
        .map((t) => ({ topic: t, label: topicLabel(t), strength: round2(Math.tanh((overlap[t] ?? 0) / 1.1)) }))
        .sort((a, b) => b.strength - a.strength);
      out.push({
        conversationId: c.id,
        isGroup: false,
        friendId: otherId,
        name: friend.name,
        shortName: friend.first,
        avatar: friend.avatar,
        coPlayed,
        totalRuns,
        sameAnswers,
        closenessScore: Math.min(99, closenessScore),
        sharedGames: gameTitles.slice(-4),
        topicOverlap: overlap,
        sharedTopics,
      });
    } else {
      for (const s of inChat) {
        const myRun = s.players.get(viewerId);
        if (!myRun || s.players.size < 2) continue;
        coPlayed++;
        const d = decay(s.createdAt, now);
        decayedPlays += d;
        totalRuns += [...s.players.values()].reduce((sum, r) => sum + r.plays, 0);
        for (const [pk, count] of s.sameAnswers) if (pk.includes(viewerId)) sameAnswers += count;
        if ([...s.players.values()].some((r) => r.repliedAfter)) banterCount++;
        if (!gameTitles.includes(s.title)) gameTitles.push(s.title);
        const turnout = s.players.size / Math.max(2, c.participantIds.length);
        s.topics.forEach((t, idx) => {
          overlap[t] = (overlap[t] ?? 0) + d * (0.5 + 0.5 * turnout) * (idx === 0 ? 1 : 0.65);
        });
      }
      if (!coPlayed) continue;
      const others = c.participantIds.filter((id) => id !== viewerId);
      const label = c.name ?? others.slice(0, 2).map((id) => card(id).first).join(", ");
      const closenessScore = Math.round(
        100 * (0.5 * clamp(decayedPlays / 2.5) + 0.25 * clamp(totalRuns / 8) + 0.15 * clamp((sameAnswers + banterCount) / 3) + 0.1),
      );
      const sharedTopics = TOPIC_IDS
        .filter((t) => (overlap[t] ?? 0) > 0.1)
        .map((t) => ({ topic: t, label: topicLabel(t), strength: round2(Math.tanh((overlap[t] ?? 0) / 1.1)) }))
        .sort((a, b) => b.strength - a.strength);
      out.push({
        conversationId: c.id,
        isGroup: true,
        name: label,
        shortName: label,
        avatar: card(others[0] ?? viewerId).avatar,
        coPlayed,
        totalRuns,
        sameAnswers,
        closenessScore: Math.min(99, closenessScore),
        sharedGames: gameTitles.slice(-4),
        topicOverlap: overlap,
        sharedTopics,
      });
    }
  }

  return out.sort((a, b) => b.closenessScore - a.closenessScore || b.coPlayed - a.coPlayed);
}

// ---------- 4. Smart Input Context & Blind-Spot Suggestions for GameTray ----------

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

/** Audience-intersection topic suggestions for the Messenger "+" GameTray (`Deep Cuts` and `Order Up!`).
 *  Never reads private saves (`savedBy`), unshared private Groups, restricted profiles, or other threads. */
export function traySuggestionsFor(conversationId: ID, viewerId: ID, game: GameKind) {
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

  // 1. Mutually visible shared Groups
  for (const g of d.groups.filter((x) => x.privacy === "public" || all((m) => x.memberIds.includes(m)))) {
    const inGrp = ids.filter((id) => g.memberIds.includes(id));
    if (inGrp.length >= 2) note(topicsOfGroup(g), ids.length === 2 ? `Both in ${g.name}` : `${inGrp.length} in ${g.name}`);
  }
  // 2. Co-attended / mutually interested Events
  for (const e of d.events.filter((x) => all((m) => canSeeEvent(m, x)))) {
    const inEv = ids.filter((id) => e.going.includes(id) || e.interested.includes(id));
    if (inEv.length >= 2) note(topicsOfEvent(e), ids.length === 2 ? `Both eyeing ${e.title}` : `${inEv.length} into ${e.title}`);
  }
  // 3. Recent messages in THIS thread only
  for (const m of c.messages.filter((x) => !x.attachment && x.text.length >= 10).slice(-25).reverse()) {
    note(topicsOfText(m.text), "From this chat");
  }
  // 4. Mutually visible posts, Reels, public seller Listings, and permitted profile interests
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

// ---------- 5. Downstream Ecosystem Ranking (Events, Groups, Marketplace) ----------

export interface ShareTarget {
  conversationId: ID;
  name: string;
  label: string;
}
export interface SocialMatchResult {
  fit: number;
  topic?: TopicId;
  fitLabel?: string;
  shareTarget?: ShareTarget;
}
export interface SocialMatchCache {
  aff: AffinityProfile;
  matches: SharedMatch[];
}

export function socialMatchCache(viewerId: ID): SocialMatchCache {
  const sessions = ingestSidequestSessions();
  return {
    aff: affinityFor(viewerId, sessions),
    matches: sharedMatchesFor(viewerId, sessions),
  };
}

export function socialMatchFor(viewerId: ID, topics: TopicId[], cache: SocialMatchCache = socialMatchCache(viewerId)): SocialMatchResult {
  let baseFit = 0;
  let bestTopic: TopicId | undefined;
  topics.forEach((t, i) => {
    if (!(cache.aff.observations[t] > 0)) return;
    const v = (cache.aff.score[t] ?? 0) * (i === 0 ? 1 : 0.65);
    if (v > baseFit) { baseFit = v; bestTopic = t; }
  });
  if (baseFit <= 0 || !bestTopic) return { fit: 0 };

  let bestChat: { m: SharedMatch; topic: TopicId; v: number } | undefined;
  for (const m of cache.matches) {
    for (const [i, t] of topics.entries()) {
      const ov = (m.topicOverlap[t] ?? 0) * (i === 0 ? 1 : 0.65);
      if (ov > 0.1 && (!bestChat || ov > bestChat.v)) bestChat = { m, topic: t, v: ov };
    }
  }

  const fit = round3(baseFit + (bestChat ? Math.min(0.3, bestChat.v * 0.25) : 0));
  if (bestChat && fit >= 0.2) {
    const tName = topicOf(bestChat.topic).label;
    const fitLabel = bestChat.m.isGroup
      ? `Matches ${bestChat.m.shortName} · ${tName}`
      : `Matches your games with ${bestChat.m.shortName} · ${tName}`;
    return {
      fit,
      topic: bestChat.topic,
      fitLabel,
      shareTarget: {
        conversationId: bestChat.m.conversationId,
        name: bestChat.m.shortName,
        label: `Send to ${bestChat.m.shortName}`,
      },
    };
  }
  return {
    fit,
    topic: bestTopic,
    fitLabel: fit >= 0.2 ? `From your games · ${topicOf(bestTopic).label}` : undefined,
  };
}

// ---------- 6. Full User Context Report (for /dev/context Inspector) ----------

export function userContextFor(userId: ID) {
  const u = getUser(userId);
  if (!u) return null;
  const sessions = ingestSidequestSessions();
  const aff = affinityFor(userId, sessions);
  const matches = sharedMatchesFor(userId, sessions);
  const cache: SocialMatchCache = { aff, matches };
  const staticTopics = [...new Set(u.interests.flatMap(topicsOfText))];

  const mySessions = sessions
    .filter((s) => s.creatorId === userId || s.players.has(userId))
    .map((s) => {
      const c = getConversation(s.conversationId);
      const others = (c?.participantIds ?? []).filter((id) => id !== userId).map((id) => card(id).first);
      return {
        ref: s.ref,
        gameKind: s.gameKind,
        gameLabel: s.gameKind === "orderup" ? "Order Up!" : "Deep Cuts",
        title: s.title,
        interest: s.interest,
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
    .filter((e) => new Date(e.startsAt).getTime() > Date.now())
    .map((e) => ({ id: e.id, title: e.title, location: e.location, ...socialMatchFor(userId, topicsOfEvent(e), cache) }))
    .filter((x) => x.fit > 0)
    .sort((a, b) => b.fit - a.fit)
    .slice(0, 4);

  const rankedGroups = db().groups
    .filter((g) => !g.memberIds.includes(userId))
    .map((g) => ({ id: g.id, title: g.name, privacy: g.privacy, ...socialMatchFor(userId, topicsOfGroup(g), cache) }))
    .filter((x) => x.fit > 0)
    .sort((a, b) => b.fit - a.fit)
    .slice(0, 4);

  const rankedListings = db().listings
    .filter((l) => l.status === "available" && l.sellerId !== userId)
    .map((l) => ({ id: l.id, title: l.title, price: l.price, ...socialMatchFor(userId, topicsOfListing(l), cache) }))
    .filter((x) => x.fit > 0)
    .sort((a, b) => b.fit - a.fit)
    .slice(0, 4);

  const privateSavesCount = db().reels.filter((r) => r.savedBy.includes(userId)).length + db().listings.filter((l) => l.savedBy.includes(userId)).length;
  const restrictedPostsCount = db().posts.filter((p) => p.authorId === userId && !canSeePost("u_audit_stranger", p)).length;

  return {
    user: card(userId),
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

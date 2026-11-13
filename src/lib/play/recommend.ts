// Unlocks: when a chat's interaction score crosses a threshold, it gets one real Group / Event / Listing.
// Code decides everything that matters:
//   - which item: ranked from inventory every member can see, by the chat's topic scores (never one member's);
//     where the chat spread Wager points on the item itself, that result replaces the topic estimate
//   - the gate: the item's topic must be settled in this chat (score.ts `confident`) or the chat put Wager points on it
//   - the facts: counted from this chat's own finished answers and events, nothing invented
//   - whether the model's why line is allowed on screen: it must copy a fact word for word and may add no number
//     or quantity word of its own, <=30 words, <=200 characters, no BANNED words; otherwise the first fact is shown
//   - at most one unlock per tier per chat, one per call, and one per chat per day (no burst of cards); a tier
//     whose kind is on today's Wager waits until half the chat (and never fewer than two people) has answered it;
//     Wager points from a single finisher are never cited or ranked on: a total over one person is their answer
// "I'm in" does the real thing (RSVP / join / save) and is written back as a strong signal for that member only.
import { ai } from "@/lib/ai";
import { BANNED } from "@/lib/reconnect/whynow";
import { getConversation, getEvent, getGroup, getListing, getUser, notify, rsvp, sendMessage, toggleGroupMembership, toggleSaveListing } from "@/server/db";
import type { ID } from "@/types";
import { inventoryFor, type InventoryItem } from "./context";
import { roundResults } from "./results";
import { affinityFor, chatScore, chatTopics, confident, decay, streakDays, THRESHOLDS, type Affinity } from "./score";
import { completedBy, dayKey, FORMAT_LABEL, gamesIn, getGame, logEvent, pid, playStore, unlocksIn, type EventKind, type PlayGame, type Unlock, type UnlockTier } from "./store";
import { topic as topicOf, topicLabel, type TopicId } from "./taxonomy";
import type { MemberCard, UnlockView } from "./views";

export interface Candidate { item: InventoryItem; score: number; topic: TopicId; parts: Record<string, number> }

const TIERS = Object.keys(THRESHOLDS) as UnlockTier[];
const TIER_LABEL: Record<UnlockTier, string> = { group: "a group to join together", event: "an event for the chat", listing: "a Marketplace pick" };
const FEEDBACK_KIND: Record<UnlockTier, EventKind> = { event: "rsvp", group: "join", listing: "save" };
const DAY = 864e5;
const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const round3 = (n: number) => Math.round(n * 1000) / 1000;
const fail = (status: number, msg: string) => Object.assign(new Error(msg), { status });
const card = (id: ID): MemberCard => { const u = getUser(id); const name = u?.name ?? id; return { id, name, first: name.split(" ")[0], avatar: u?.avatar ?? "" }; };
const dayName = (g: PlayGame) => (g.date === dayKey() ? "today" : new Date(g.date + "T12:00:00").toLocaleString("en-US", { weekday: "long" }));

/** The most recent Wager round that offered this exact item, with the chat's totals for it. */
function lastWager(games: PlayGame[], item: InventoryItem) {
  for (const g of [...games].reverse()) {
    if (g.format !== "wager") continue;
    const res = roundResults(g);
    for (const r of g.rounds) {
      const o = r.kind === "points" ? r.options.find((x) => x.ref?.kind === item.kind && x.ref.id === item.id) : undefined;
      const rr = res.find((x) => x.roundId === r.id);
      if (o && rr) return { game: g, points: rr.totals[o.id] ?? 0, max: Math.max(0, ...Object.values(rr.totals)), total: Object.values(rr.totals).reduce((s, x) => s + x, 0), voters: rr.voters };
    }
  }
  return undefined;
}
/** Where the chat put this item in its last Wager: its points relative to the round's leader (0..1), fading with the
 *  same half-life as every other signal. Undefined when it was never wagered on or under half the chat answered. */
function wagerStanding(games: PlayGame[], item: InventoryItem, members: number): number | undefined {
  const w = lastWager(games, item);
  if (!w || w.voters < 2 || w.voters * 2 < members || w.max <= 0) return undefined; // one finisher's points are that person's answer, not the chat's
  return (w.points / w.max) * decay(w.game.createdAt);
}

export function rankInventory(conversationId: ID, tier: UnlockTier): Candidate[] {
  const c = getConversation(conversationId);
  if (!c) return [];
  const members = c.participantIds;
  const taken = new Set(unlocksIn(conversationId).filter((u) => u.tier === tier).map((u) => u.refId));
  const ct = new Map(chatTopics(conversationId).map((t) => [t.topic, t.score]));
  const games = gamesIn(conversationId);
  // Marketplace picks follow the event the chat just unlocked, when there is one.
  const lastEventTopic = tier === "listing" ? unlocksIn(conversationId).filter((u) => u.tier === "event").at(-1)?.topic : undefined;
  // inventoryFor already keeps events to the chat's home city and to what every member can see.
  return inventoryFor(members)
    .filter((i) => i.kind === tier && !taken.has(i.id) && i.membersIn.length < members.length)
    .map((item) => {
      const per = item.topics.map((t, i) => ({ t, v: (ct.get(t) ?? 0) * (i === 0 ? 1 : 0.6) }));
      const best = [...per].sort((a, b) => b.v - a.v)[0];
      const share = item.membersIn.length / members.length;
      const days = item.startsAt ? (new Date(item.startsAt).getTime() - Date.now()) / DAY : 0;
      const standing = wagerStanding(games, item, members.length);
      const parts: Record<string, number> = {
        // the item's best topic in full, the rest at a quarter: a title that touches five topics shouldn't outrank one that is squarely the chat's.
        // Once the chat has wagered on this exact item, what it said there stands in for the topic estimate.
        topics: standing === undefined ? round3(best.v + 0.25 * (per.reduce((s, x) => s + x.v, 0) - best.v)) : 0,
        membersIn: round3(tier === "group" ? -0.5 * share : 0.1 * share),
        soonness: round3(tier === "event" ? 0.1 * clamp(1 - days / 21) : 0),
        wager: round3(standing ?? 0),
        followsEvent: lastEventTopic && item.topics.includes(lastEventTopic) ? 0.3 : 0,
      };
      const score = round3(Object.values(parts).reduce((s, x) => s + x, 0));
      return { item, score, topic: lastEventTopic && item.topics.includes(lastEventTopic) ? lastEventTopic : best.v > 0 ? best.t : item.topics[0], parts };
    })
    .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id));
}

/** What code can truthfully say about why this item: counted from this chat's answers and events only. */
export function unlockFacts(conversationId: ID, c: Candidate): string[] {
  const conv = getConversation(conversationId);
  if (!conv) return [];
  const games = gamesIn(conversationId);
  const recent = [...games].reverse();
  const facts: string[] = [];
  // strongest first: this exact item led the most recent Wager that offered it (an item that lost gets no points line)
  const w = lastWager(games, c.item);
  if (w && w.voters >= 2 && w.points > 0 && w.points === w.max) facts.push(`${w.points} of ${w.total} points went to this in ${dayName(w.game)}'s Wager`);
  // then the most recent Split / Blend round the chat settled on this topic
  outer: for (const g of recent) {
    if (g.format !== "split" && g.format !== "blend") continue;
    const res = roundResults(g);
    for (const r of g.rounds) {
      const rr = res.find((x) => x.roundId === r.id);
      const win = rr && r.options.find((o) => o.id === rr.order[0]);
      if (!rr || !win || win.topic !== c.topic) continue;
      const k = rr.totals[win.id];
      if (k < 2 || rr.order.some((id) => id !== win.id && rr.totals[id] === k)) continue; // a tie isn't a win
      facts.push(`${k} of ${rr.voters} of you picked ${win.label} in ${dayName(g)}'s ${FORMAT_LABEL[g.format]}`);
      break outer;
    }
  }
  // nothing counted about this item yet: say where its topic stands in this chat
  if (!facts.length) {
    const topics = chatTopics(conversationId);
    const rank = topics.findIndex((t) => t.topic === c.topic) + 1;
    const n = topics[rank - 1]?.games ?? 0; // played games that touched this topic, not every game the chat was sent
    facts.push(`${topicOf(c.topic).label} is this chat's ${rank <= 1 ? "top" : `#${rank}`} topic${n ? ` after ${n} game${n === 1 ? "" : "s"} on it` : ""}`);
  }
  const streak = streakDays(conversationId);
  if (streak >= 2) facts.push(`${streak}-day streak`);
  const m = c.item.membersIn.length;
  if (m >= 1 && c.item.kind !== "listing") facts.push(`${m} of you ${m === 1 ? "is" : "are"} already ${c.item.kind === "event" ? "going" : "in"}`);
  return facts;
}

const WHY_SCHEMA = {
  type: "object",
  properties: { line: { type: "string", description: "One sentence, max 24 words, written to the whole chat. Copy one FACT word for word, then add a short clause on why this pick fits. The clause has no numbers and no quantity words (all, every, half, most, both...). Do not repeat the item's name. No mood or health words, no guilt." } },
  required: ["line"],
};
const numbersIn = (s: string) => s.match(/\d+(?:\.\d+)?/g) ?? [];
/** Words that claim a count without a digit. "one" and "whole" are left out: "this one is for the whole chat" claims nothing. */
const QUANT = /\b(all|every|everyone|everybody|each|half|most|majority|both|none|nobody|no one|unanimous(?:ly)?|couple|dozens?|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/i;
/** Code's check on the why line. Returns the reason it was refused, or undefined when it may be shown.
 *  A number is only allowed inside a fact copied word for word, so it can't be moved onto another noun. */
export function checkWhy(line: string, facts: string[], title = ""): string | undefined {
  if (typeof line !== "string" || !line.trim()) return "empty line";
  if (line.length > 200) return "over 200 characters";
  if (line.trim().split(/\s+/).length > 30) return "over 30 words";
  if (BANNED.test(line)) return `banned word: ${line.match(BANNED)?.[0]}`;
  let rest = line;
  let copied = 0;
  for (const f of [...facts].sort((a, b) => b.length - a.length)) {
    const i = rest.toLowerCase().indexOf(f.toLowerCase());
    if (f && i >= 0) { rest = `${rest.slice(0, i)} ${rest.slice(i + f.length)}`; copied++; }
  }
  if (!copied) return "no fact copied word for word";
  if (title) rest = rest.split(title).join(" "); // the item's own name is copied text, not a claim
  const n = numbersIn(rest)[0];
  if (n) return `number outside a copied fact: ${n}`;
  const q = rest.match(QUANT)?.[0];
  return q ? `quantity word outside a copied fact: ${q}` : undefined;
}

const inflight = new Set<ID>();
/** After a completion or a reaction (anything that can move the score): the lowest earned, not yet unlocked tier that
 *  has a fitting candidate gets it. A lower tier with nothing to offer doesn't hold the higher ones back. One per call. */
export async function maybeUnlock(conversationId: ID): Promise<Unlock | null> {
  const c = getConversation(conversationId);
  const s = playStore();
  if (!c || s.muted.has(conversationId) || inflight.has(conversationId)) return null;
  const has = (t: UnlockTier) => unlocksIn(conversationId).some((u) => u.tier === t);
  if (unlocksIn(conversationId).some((u) => dayKey(u.createdAt) === dayKey())) return null; // one card a day per chat
  const cs = chatScore(conversationId);
  // A candidate has to be backed by this chat's play: Wager points on the item itself, a topic the chat has settled
  // on, or (Marketplace) the topic of the Event it already unlocked. The taste prior alone recommends nothing.
  const settled = new Set(cs.topics.filter((t) => confident(t, c.participantIds.length)).map((t) => t.topic));
  // Mid-Wager, the chat is still saying which of these things it wants: a tier whose kind is on today's Wager waits
  // until half the chat has answered, so the card follows the vote instead of getting ahead of it.
  const today = getGame(s.byDay.get(`${conversationId}|${dayKey()}`) ?? "");
  // Never fewer than two: in a chat of two, a card citing one finisher's points would show the other what they wagered before playing.
  const quorum = Math.max(2, Math.ceil(c.participantIds.length / 2));
  const voting = new Set(today?.format === "wager" && completedBy(today.id).size < quorum ? today.rounds.flatMap((r) => r.options.map((o) => o.ref?.kind)) : []);
  let tier: UnlockTier | undefined;
  let best: Candidate | undefined;
  for (const t of TIERS) {
    if (!cs.earned.includes(t) || has(t) || voting.has(t)) continue;
    best = rankInventory(conversationId, t).find((x) => x.parts.wager > 0 || (x.parts.topics > 0 && (settled.has(x.topic) || x.parts.followsEvent > 0)));
    if (best) { tier = t; break; }
  }
  if (!tier || !best) return null; // nothing real that fits what this chat plays; better no card than a random one
  const facts = unlockFacts(conversationId, best);
  inflight.add(conversationId);
  try {
    let why = facts[0];
    let mode = "code";
    let costUsd = 0;
    let refusedWhy: string | undefined;
    try {
      const prompt = `A group chat ("${c.name ?? "a direct message"}", ${c.participantIds.length} people) plays a short daily game together. Their play just unlocked ${TIER_LABEL[tier]}:\n\n${best.item.kind.toUpperCase()}: ${best.item.title} (${best.item.sub})\nTOPIC: ${topicOf(best.topic).label}\n\nFACTS (counted by code from their answers; the only things you may state):\n${facts.map((f) => `- ${f}`).join("\n")}\n\nWrite the one line shown on the card: why this is the pick for this chat. Copy the strongest fact word for word, then add a short clause with no numbers and no quantity words (all, every, half, most, both...).`;
      const { data, trace } = await ai.json<{ line: string }>(prompt, { task: "play.unlock", schema: WHY_SCHEMA, maxTokens: 300, temperature: 0.5, cache: false, mock: () => ({ line: `${facts[0]}, so this one is for the whole chat.` }) });
      const line = typeof data?.line === "string" ? data.line.replace(/\s+/g, " ").trim() : ""; // a non-string is refused as empty
      mode = trace.mode;
      costUsd = trace.costUsd ?? 0;
      const refused = checkWhy(line, facts, best.item.title);
      if (refused) { refusedWhy = `${refused}: "${line.slice(0, 160)}"`; console.warn("[play] why line refused:", refused); }
      else why = line;
    } catch (err) {
      console.warn("[play] why line failed, using the fact:", (err as Error).message.slice(0, 80));
    }
    if (has(tier)) return null; // someone else's completion got there while the line was being written
    const u: Unlock = { id: pid("ul"), conversationId, tier, refId: best.item.id, topic: best.topic, title: best.item.title, sub: best.item.sub, image: best.item.image, why, facts, refused: refusedWhy, score: cs.score, mode, costUsd, responses: {}, createdAt: new Date().toISOString() };
    s.unlocks.set(u.id, u);
    const m = sendMessage(conversationId, c.participantIds[0], `Unlocked at ${cs.score} · ${best.item.title}`, { type: "unlock", ref: u.id });
    m.system = true;
    m.readBy = [];
    u.messageId = m.id;
    const where = c.name ?? "Your chat";
    for (const id of c.participantIds) notify(id, { type: "play", text: `**${where}** unlocked ${TIER_LABEL[tier]}: ${best.item.title}`, href: `/messages/${conversationId}` });
    return u;
  } finally {
    inflight.delete(conversationId);
  }
}

const getUnlock = (unlockId: string, userId: ID) => {
  const u = playStore().unlocks.get(unlockId);
  if (!u || !getConversation(u.conversationId)?.participantIds.includes(userId)) throw fail(404, "Unlock not found");
  return u;
};
const isIn = (u: Unlock, userId: ID) =>
  u.tier === "event" ? !!getEvent(u.refId)?.going.includes(userId) : u.tier === "group" ? !!getGroup(u.refId)?.memberIds.includes(userId) : !!getListing(u.refId)?.savedBy.includes(userId);
const setIn = (u: Unlock, userId: ID, on: boolean) => {
  if (isIn(u, userId) === on) return false;
  if (u.tier === "event") rsvp(u.refId, userId, on ? "going" : "none");
  else if (u.tier === "group") toggleGroupMembership(u.refId, userId);
  else toggleSaveListing(u.refId, userId);
  return true;
};

/**
 * "in" does the real thing (RSVP going / join / save) and logs it as feedback; "dismiss" logs a dismissal; "undo" takes
 * the member's response back, including the signal and the RSVP/join/save if this card is what made it.
 * Feedback events carry the unlock id, and "acted" in choice when the card (not the member beforehand) did it.
 */
export function respondUnlock(unlockId: string, userId: ID, action: "in" | "dismiss" | "undo"): Unlock {
  const u = getUnlock(unlockId, userId);
  if (action !== "in" && action !== "dismiss" && action !== "undo") throw fail(400, "unknown action");
  const prev = u.responses[userId];
  if (prev === action) return u; // idempotent
  const s = playStore();
  if (prev) {
    const i = s.events.findLastIndex((e) => e.userId === userId && e.unlockId === u.id && (e.kind === "dismiss" || e.kind === FEEDBACK_KIND[u.tier]));
    const ev = i >= 0 ? s.events.splice(i, 1)[0] : undefined;
    if (prev === "in" && ev?.choice === "acted") setIn(u, userId, false);
    delete u.responses[userId];
  }
  if (action === "in") {
    const acted = setIn(u, userId, true);
    logEvent({ conversationId: u.conversationId, userId, unlockId: u.id, kind: FEEDBACK_KIND[u.tier], topic: u.topic, choice: acted ? "acted" : "already" });
    u.responses[userId] = "in";
  } else if (action === "dismiss") {
    logEvent({ conversationId: u.conversationId, userId, unlockId: u.id, kind: "dismiss", topic: u.topic });
    u.responses[userId] = "dismiss";
  }
  return u;
}

export function viewUnlock(u: Unlock, viewerId: ID): UnlockView {
  const c = getConversation(u.conversationId);
  if (!c?.participantIds.includes(viewerId)) throw fail(404, "Unlock not found");
  const href = u.tier === "event" ? `/events/${u.refId}` : u.tier === "group" ? `/groups/${u.refId}` : `/marketplace/${u.refId}`;
  return {
    id: u.id, conversationId: u.conversationId, tier: u.tier, refId: u.refId, href, topic: u.topic, topicLabel: topicLabel(u.topic), title: u.title, sub: u.sub, image: u.image, why: u.why, score: u.score,
    // Who is in: anyone who said so on the card, plus (events and groups, where everyone can see it anyway) anyone already going / a member. Saves stay private.
    inMembers: c.participantIds.filter((id) => u.responses[id] === "in" || (u.tier !== "listing" && u.responses[id] !== "dismiss" && isIn(u, id))).map(card),
    my: u.responses[viewerId],
    mode: u.mode,
  };
}

/** The viewer's OWN affinity over an item's topics (first topic counts in full, the rest 0.6). Only topics the viewer has
 *  game or feedback evidence on count, so someone who never played gets fit 0 and no "From your games" line.
 *  Pass `aff` to reuse one lookup. */
export function fitFor(userId: ID, topics: TopicId[], aff: Affinity = affinityFor(userId)): { fit: number; topic?: TopicId } {
  let fit = 0;
  let best: TopicId | undefined;
  topics.forEach((t, i) => {
    if (!(aff.observations[t] > 0)) return;
    const v = (aff.score[t] ?? 0) * (i === 0 ? 1 : 0.6);
    if (v > fit) { fit = v; best = t; }
  });
  return { fit: round3(fit), topic: best };
}
/** "Because you're into …", only when the fit is real. */
export const fitLabel = (f: { fit: number; topic?: TopicId }) => (f.topic && f.fit >= 0.25 ? `Because you're into ${topicOf(f.topic).label}` : undefined);

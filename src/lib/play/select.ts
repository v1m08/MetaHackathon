// Matching: which game goes to which chat today. All code, no model.
//   topic  = upper confidence bound: what the chat seems to like + a bonus for topics it has barely been asked about
//   format = rotate, limited to what this chat's material can support; Wager is forced once a topic leads,
//            because it turns "we like this" into a ranked choice of real things
import { getConversation } from "@/server/db";
import type { ID } from "@/types";
import type { ChatContext, InventoryItem } from "./context";
import { chatTopics, confident } from "./score";
import { FORMATS, GROUP_ONLY, gamesIn, type Format } from "./store";
import { TOPIC_IDS, type TopicId } from "./taxonomy";

export interface Selection { topic: TopicId; format: Format; subjectId?: ID; items: InventoryItem[]; why: string }

/** Lines that work as a Receipts round: said by a member, short enough to read, long enough to recognise. */
export const quotable = (ctx: ChatContext) => ctx.evidence.filter((e) => e.by && (e.kind === "message" || e.kind === "post") && e.text.length >= 20 && e.text.length <= 170);

/** Up to three real things for a Wager: on-topic first (an item's main topic beats a passing mention), then the chat's
 *  next topics, events before groups before listings, one kind never taking all three slots if avoidable. */
export function wagerItems(ctx: ChatContext, topic: TopicId, ranked: TopicId[]): InventoryItem[] {
  const order = [topic, ...ranked.filter((t) => t !== topic)];
  const score = (i: InventoryItem) => { const idx = Math.min(...i.topics.map((t, pos) => { const x = order.indexOf(t); return x < 0 ? 99 : x + (pos === 0 ? 0 : 0.25); }), 99); return idx + (i.kind === "event" ? 0 : i.kind === "group" ? 0.3 : 0.6) + (i.membersIn.length === ctx.members.length ? 5 : 0); };
  const sorted = [...ctx.inventory].sort((a, b) => score(a) - score(b));
  const out: InventoryItem[] = [];
  for (const i of sorted) { if (out.length >= 3) break; if (out.filter((x) => x.kind === i.kind).length >= 2) continue; out.push(i); }
  return out;
}

export function feasible(format: Format, ctx: ChatContext, topic: TopicId, ranked: TopicId[]): boolean {
  if (GROUP_ONLY.includes(format) && ctx.members.length < 3) return false;
  if (format === "receipts") { const q = quotable(ctx); return q.length >= 4 && new Set(q.map((e) => e.by)).size >= 2; }
  if (format === "wager") return ctx.inventory.filter((i) => i.topics.includes(topic)).length >= 1 && wagerItems(ctx, topic, ranked).length >= 3;
  if (format === "hotseat") return !!pickSubject(ctx, topic, []);
  return true;
}

/** Hot Seat subject: the member with the most to go on for this topic who hasn't been in the seat lately. */
export function pickSubject(ctx: ChatContext, topic: TopicId, recent: ID[]): ID | undefined {
  const count = (id: ID) => ctx.evidence.filter((e) => e.by === id).length + 2 * ctx.evidence.filter((e) => e.by === id && e.topics.includes(topic)).length;
  return ctx.members.map((m) => m.id).filter((id) => !recent.includes(id) && ctx.evidence.filter((e) => e.by === id).length >= 3).sort((a, b) => count(b) - count(a))[0];
}

export function selectGame(ctx: ChatContext, force: { topic?: TopicId; format?: Format } = {}): Selection {
  const c = getConversation(ctx.conversationId)!;
  const members = c.participantIds.length;
  const history = gamesIn(ctx.conversationId);
  const topics = chatTopics(ctx.conversationId);
  const ranked = topics.map((t) => t.topic);
  const lastTopics = history.slice(-2).map((g) => g.topic);
  const material = (t: TopicId) => ctx.evidence.filter((e) => e.topics.includes(t)).length;
  const stock = (t: TopicId) => ctx.inventory.filter((i) => i.topics.includes(t)).length;

  // Wager is forced when a settled topic leads and the chat hasn't wagered recently.
  const leader = topics.find((t) => confident(t, members));
  const wageredLately = history.slice(-4).some((g) => g.format === "wager");
  let format = force.format;
  let topic = force.topic;
  let why = "";
  if (!format && !topic && leader && !wageredLately && feasible("wager", ctx, leader.topic, ranked)) {
    format = "wager"; topic = leader.topic;
    why = `${leader.topic} leads this chat (${leader.games} games, ${leader.observedBy}/${members} played) → Wager on real things`;
  }
  if (!topic) {
    const ucb = TOPIC_IDS.filter((t) => !lastTopics.includes(t) && (material(t) >= 2 || stock(t) >= 1)).map((t) => {
      const ct = topics.find((x) => x.topic === t)!;
      const mentions = ctx.evidence.filter((e) => e.kind === "message" && e.topics.includes(t)).length;
      const value = ct.mean + 0.15 * Math.min(1, mentions / 5) + 0.35 / Math.sqrt(1 + ct.games);
      return { t, value };
    }).sort((a, b) => b.value - a.value);
    topic = ucb[0]?.t ?? ranked[0] ?? "food";
    why = `topic ${topic}: best of affinity + exploration bonus (${ucb.slice(0, 3).map((x) => `${x.t} ${x.value.toFixed(2)}`).join(", ")})`;
  }
  if (!format) {
    const last = history.at(-1)?.format;
    const start = last ? (FORMATS.indexOf(last) + 1) % FORMATS.length : 0;
    const rotation = [...FORMATS.slice(start), ...FORMATS.slice(0, start)];
    format = rotation.find((f) => feasible(f, ctx, topic!, ranked)) ?? "split";
    why += ` · format ${format}: next in rotation this chat can support`;
  }
  const recentSubjects = history.filter((g) => g.format === "hotseat" && g.subjectId).slice(-3).map((g) => g.subjectId!);
  const subjectId = format === "hotseat" ? pickSubject(ctx, topic, recentSubjects) ?? pickSubject(ctx, topic, []) : undefined;
  const items = format === "wager" ? wagerItems(ctx, topic, ranked) : [];
  if (force.format) why += ` · format ${format}: asked for by the caller`;
  if (force.topic) why = `topic ${topic}: asked for by the caller${why}`;
  return { topic, format, subjectId, items, why: why.replace(/^ · /, "") };
}

// What a game for this chat may be built from. Only material every member of the chat can already see:
// the chat's own messages, members' posts and Reels that pass the visibility check for all of them, and a member's
// stated interests only when every other member can see that profile (friend or friend-of-friend; a restricted
// profile: friends only). Nothing from any other chat is ever read. Inventory is real, upcoming, visible to all,
// and (for events) in the city most of the chat lives in.
import { canSeeEvent, canSeePost, canSeeReel, canSeeUser, isFriend } from "@/lib/travel/visibility";
import { db, getConversation, getUser } from "@/server/db";
import type { ID } from "@/types";
import type { EvidenceItem } from "./store";
import { topicsOfEvent, topicsOfGroup, topicsOfListing, topicsOfText, type TopicId } from "./taxonomy";

export interface InventoryItem { kind: "event" | "group" | "listing"; id: string; title: string; sub: string; image?: string; topics: TopicId[]; startsAt?: string; membersIn: ID[] }
export interface ChatContext {
  conversationId: ID;
  isGroup: boolean;
  members: { id: ID; first: string; name: string; avatar: string }[];
  evidence: EvidenceItem[];
  byId: Map<string, EvidenceItem>;
  inventory: InventoryItem[];
}

const first = (name: string) => name.split(" ")[0];
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric" });

/** Where the chat lives: the city most members are in. An event with no city set counts as local. */
export function homeCity(memberIds: ID[]) {
  const cities = memberIds.map((m) => getUser(m)?.city ?? "austin");
  return [...new Set(cities)].sort((x, y) => cities.filter((v) => v === y).length - cities.filter((v) => v === x).length)[0] ?? "austin";
}

export function inventoryFor(memberIds: ID[]): InventoryItem[] {
  const d = db();
  const now = Date.now();
  const all = (fn: (id: ID) => boolean) => memberIds.every(fn);
  const home = homeCity(memberIds);
  const events: InventoryItem[] = d.events
    .filter((e) => new Date(e.startsAt).getTime() > now && e.category !== "Reconnect" && (e.city ?? home) === home && all((m) => canSeeEvent(m, e)))
    .map((e) => ({ kind: "event", id: e.id, title: e.title, sub: `${when(e.startsAt)} · ${e.location}${e.price ? ` · ${e.price}` : ""}`, image: e.cover, topics: topicsOfEvent(e), startsAt: e.startsAt, membersIn: memberIds.filter((m) => e.going.includes(m)) }));
  const groups: InventoryItem[] = d.groups
    .filter((g) => g.privacy === "public" || all((m) => g.memberIds.includes(m)))
    .map((g) => ({ kind: "group", id: g.id, title: g.name, sub: `${g.memberIds.length} members · ${g.tags.slice(0, 2).join(", ")}`, image: g.cover, topics: topicsOfGroup(g), membersIn: memberIds.filter((m) => g.memberIds.includes(m)) }));
  const listings: InventoryItem[] = d.listings
    .filter((l) => l.status === "available")
    .map((l) => ({ kind: "listing", id: l.id, title: l.title, sub: `$${l.price} · ${l.condition} · ${l.location}`, image: l.images[0], topics: topicsOfListing(l), membersIn: memberIds.filter((m) => l.savedBy.includes(m) || l.sellerId === m) }));
  return [...events, ...groups, ...listings].filter((i) => i.topics.length > 0);
}

export function buildContext(conversationId: ID): ChatContext {
  const c = getConversation(conversationId);
  if (!c) throw Object.assign(new Error("Conversation not found"), { status: 404 });
  const ids = c.participantIds;
  const members = ids.map((id) => { const u = getUser(id); return { id, first: first(u?.name ?? id), name: u?.name ?? id, avatar: u?.avatar ?? "" }; });
  const all = (fn: (id: ID) => boolean) => ids.every(fn);
  const d = db();
  const evidence: EvidenceItem[] = [];
  const add = (e: Omit<EvidenceItem, "topics">) => evidence.push({ ...e, text: e.text.slice(0, 240), topics: topicsOfText(e.text) });

  for (const m of c.messages.filter((m) => m.status !== "draft" && !m.system && m.text.trim().length >= 12 && ids.includes(m.senderId)).slice(-60)) add({ id: m.id, kind: "message", by: m.senderId, text: m.text });
  for (const id of ids) {
    d.posts.filter((p) => p.authorId === id && !p.eventId && all((m) => canSeePost(m, p))).slice(0, 8).forEach((p) => add({ id: p.id, kind: "post", by: id, text: p.text }));
    d.reels.filter((r) => r.authorId === id && all((m) => canSeeReel(m, r))).slice(0, 3).forEach((r) => add({ id: r.id, kind: "reel", by: id, text: r.caption }));
    const u = getUser(id);
    if (u && all((m) => m === id || (canSeeUser(m, u) && (u.privacy !== "friends" || isFriend(m, id))))) u.interests.forEach((t, i) => add({ id: `int:${id}:${i}`, kind: "interest", by: id, text: t }));
  }
  const inventory = inventoryFor(ids);
  return { conversationId, isGroup: c.isGroup, members, evidence, byId: new Map(evidence.map((e) => [e.id, e])), inventory };
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
/** Does the quote really appear in the source (exact after normalising, or ≥80% of its words)? */
export function quoteIn(quote: string, text: string) {
  const q = norm(quote), t = norm(text);
  if (!q) return false;
  if (t.includes(q)) return true;
  const qw = q.split(" ").filter((w) => w.length > 2);
  if (qw.length < 3) return false;
  return qw.filter((w) => t.includes(w)).length / qw.length >= 0.8;
}

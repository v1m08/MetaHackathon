// Shared history the viewer can already see, indexed so a model's citation can be checked by id.
// Everything here involves BOTH people: tagged photos, events both went to, lines from chats the viewer is in,
// and plain facts from the friendship itself (how they know each other, same hometown). Nothing third-party.
import { db, getUser } from "@/server/db";
import type { ID } from "@/types";
import { canSeePost, connection } from "@/lib/travel/visibility";
import { chatEvents } from "./drift";
import type { Evidence } from "./store";

const dayOf = (iso: string) => iso.slice(0, 10);

export function sharedEvidence(viewerId: ID, friendId: ID): Evidence[] {
  const me = getUser(viewerId);
  const friend = getUser(friendId);
  if (!me || !friend) return [];
  const out: Evidence[] = [];
  // photos and posts both people are in
  for (const p of db().posts) {
    if (p.groupId) continue;
    const people = [p.authorId, ...(p.taggedIds ?? [])];
    if (!people.includes(viewerId) || !people.includes(friendId) || !canSeePost(viewerId, p)) continue;
    out.push({ id: p.id, kind: p.images?.length ? "photo" : "post", date: dayOf(p.createdAt), people, text: p.text, image: p.images?.[0], href: `/post/${p.id}` });
  }
  // events both went to
  for (const e of db().events) {
    if (!e.going.includes(viewerId) || !e.going.includes(friendId)) continue;
    out.push({ id: e.id, kind: "event", date: dayOf(e.startsAt), people: e.going, text: `${e.title} · ${e.location}`, image: e.cover, href: `/events/${e.id}` });
  }
  // the friend's own lines from two-way exchanges in chats the viewer is in (the friend's words, never a third party's)
  for (const c of db().conversations) {
    if (!c.participantIds.includes(viewerId) || !c.participantIds.includes(friendId)) continue;
    for (const ev of chatEvents(c, viewerId, friendId)) {
      if (ev.type !== "two_way_chat") continue;
      const line = c.messages.filter((m) => ev.sourceIds.includes(m.id) && m.senderId === friendId && m.text.length > 12).sort((a, b) => b.text.length - a.text.length)[0];
      if (line) out.push({ id: line.id, kind: "chat", date: ev.date, people: [viewerId, friendId], text: `${friend.name.split(" ")[0]}: “${line.text.slice(0, 140)}”`, href: `/messages/${c.id}` });
    }
  }
  // facts of the friendship
  const how = connection(viewerId, friendId)?.label;
  if (how && how !== "friends") out.push({ id: `fact:how:${friendId}`, kind: "fact", date: me.joined.slice(0, 10), people: [viewerId, friendId], text: `you know each other from: ${how}` });
  if (me.hometown && me.hometown === friend.hometown) out.push({ id: `fact:hometown:${friendId}`, kind: "fact", date: me.joined.slice(0, 10), people: [viewerId, friendId], text: `you're both from ${me.hometown}` });
  if (me.school && friend.school && me.school.split("·")[0].trim() === friend.school.split("·")[0].trim()) out.push({ id: `fact:school:${friendId}`, kind: "fact", date: me.joined.slice(0, 10), people: [viewerId, friendId], text: `you both went to ${me.school.split("·")[0].trim()}` });
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

export type EvidenceCheck = { ok: true; ids: string[] } | { ok: false; reason: string; ids: string[]; badIds: string[] };

/** Code's verdict on a model's citations: every id must be in the shared index and must not be the trigger. */
export function checkEvidence(ids: string[], index: Evidence[], triggerId?: string): EvidenceCheck {
  const clean = [...new Set((ids ?? []).filter((id) => id && id !== triggerId))];
  const known = new Set(index.map((e) => e.id));
  const bad = clean.filter((id) => !known.has(id));
  const good = clean.filter((id) => known.has(id));
  if (!clean.length) return { ok: false, reason: "no shared evidence cited", ids: [], badIds: [] };
  if (bad.length && !good.length) return { ok: false, reason: "cited evidence is not in shared history", ids: [], badIds: bad };
  if (bad.length) return { ok: false, reason: "some cited evidence is not in shared history", ids: good, badIds: bad };
  return { ok: true, ids: good };
}

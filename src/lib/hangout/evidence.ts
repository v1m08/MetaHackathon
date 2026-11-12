// Evidence index + code check for model output. Every ID the model cites must exist in the seed
// and involve both people. The trigger (the friend's new post/Reel) is cited separately, never as evidence.
import type { ChatSnippet, FeedPost, Gathering, Photo, ReelItem } from "./types";

export type EvidenceItem =
  | { id: string; kind: "photo"; date: string; people: string[]; photo: Photo }
  | { id: string; kind: "chat"; date: string; people: string[]; chat: ChatSnippet }
  | { id: string; kind: "gathering"; date: string; people: string[]; gathering: Gathering }
  | { id: string; kind: "post"; date: string; people: string[]; post: FeedPost }
  | { id: string; kind: "reel"; date: string; people: string[]; reel: ReelItem };

export function buildEvidenceIndex(src: { photos: Photo[]; chats: ChatSnippet[]; gatherings: Gathering[]; posts?: FeedPost[]; reels?: ReelItem[] }, meId = "me") {
  const index = new Map<string, EvidenceItem>();
  for (const p of src.photos) index.set(p.id, { id: p.id, kind: "photo", date: p.date, people: p.taggedFriendIds, photo: p });
  for (const c of src.chats) index.set(c.id, { id: c.id, kind: "chat", date: c.date.slice(0, 10), people: [meId, c.friendId], chat: c });
  for (const g of src.gatherings) index.set(g.id, { id: g.id, kind: "gathering", date: g.date, people: g.attendeeIds, gathering: g });
  for (const p of src.posts ?? []) index.set(p.id, { id: p.id, kind: "post", date: p.date, people: [p.friendId, ...(p.taggedFriendIds ?? [])], post: p });
  for (const r of src.reels ?? []) index.set(r.id, { id: r.id, kind: "reel", date: r.date, people: [r.friendId], reel: r });
  return index;
}
export type EvidenceIndex = ReturnType<typeof buildEvidenceIndex>;

/** Items that involve both the user and this friend: what the model may cite. */
export function sharedItems(index: EvidenceIndex, friendId: string, meId = "me") {
  return [...index.values()].filter((e) => e.people.includes(meId) && e.people.includes(friendId)).sort((a, b) => a.date.localeCompare(b.date));
}

export type EvidenceCheck = { ok: true; evidenceIds: string[] } | { ok: false; reason: string; badIds: string[] };

export function checkEvidence(candidate: { evidenceIds: string[]; action?: string | null; photoId?: string | null }, friendId: string, index: EvidenceIndex, opts: { triggerId?: string; meId?: string } = {}): EvidenceCheck {
  const meId = opts.meId ?? "me";
  const ids = [...new Set(candidate.evidenceIds.filter((id) => id !== opts.triggerId))];
  if (!ids.length) return { ok: false, reason: "no shared evidence cited", badIds: [] };
  const missing = ids.filter((id) => !index.has(id));
  if (missing.length) return { ok: false, reason: "evidence ID not in seed data", badIds: missing };
  const notShared = ids.filter((id) => {
    const people = index.get(id)!.people;
    return !people.includes(meId) || !people.includes(friendId);
  });
  if (notShared.length) return { ok: false, reason: "evidence doesn't include both people", badIds: notShared };
  if (candidate.action === "send_photo") {
    const p = candidate.photoId;
    if (!p || !ids.includes(p) || index.get(p)?.kind !== "photo") return { ok: false, reason: "send_photo needs a photoId from the cited photos", badIds: p ? [p] : [] };
  }
  return { ok: true, evidenceIds: ids };
}

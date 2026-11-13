import { db, getUser } from "@/server/db";
import type { FBEvent, ID, Post, Reel, User } from "@/types";
import { DEMO_EVENT_IDS, isDemoUser } from "@/lib/demo";

export const isFriend = (viewerId: ID, otherId: ID) => viewerId === otherId || (getUser(viewerId)?.friendIds.includes(otherId) ?? false);

export const mutuals = (viewerId: ID, otherId: ID) => {
  const a = getUser(viewerId);
  const b = getUser(otherId);
  if (!a || !b) return [];
  return a.friendIds.filter((f) => b.friendIds.includes(f));
};

export function canSeeUser(viewerId: ID, u: User): boolean {
  if (isFriend(viewerId, u.id)) return true;
  return mutuals(viewerId, u.id).length > 0;
}

export function canSeePost(viewerId: ID, p: Post): boolean {
  if (p.authorId === viewerId) return true;
  if (p.groupId) {
    const g = db().groups.find((x) => x.id === p.groupId);
    if (!g) return false;
    return g.privacy === "public" || g.memberIds.includes(viewerId);
  }
  const author = getUser(p.authorId);
  if (!author) return false;
  const restricted = p.audience === "friends" || author.privacy === "friends";
  return restricted ? isFriend(viewerId, p.authorId) : true;
}

export function canSeeReel(viewerId: ID, r: Reel): boolean {
  if (r.authorId === viewerId) return true;
  const author = getUser(r.authorId);
  if (!author) return false;
  return author.privacy === "friends" ? isFriend(viewerId, r.authorId) : true;
}

export function canSeeEvent(viewerId: ID, e: FBEvent): boolean {
  if (e.inviteOnly) return e.hostId === viewerId || e.going.includes(viewerId) || e.interested.includes(viewerId) || !!e.invited?.includes(viewerId);
  // The hackathon demo's SF accounts live in their own world: SF events are only theirs, Austin events never are.
  if ((DEMO_EVENT_IDS as readonly string[]).includes(e.id) !== isDemoUser(viewerId)) return false;
  if (e.hostGroupId) {
    const g = db().groups.find((x) => x.id === e.hostGroupId);
    if (g && g.privacy === "private" && !g.memberIds.includes(viewerId)) return false;
  }
  return true;
}

// The one place that decides what a viewer can see. Every travel tool and the output validator call this,
// so privacy is enforced by code paths the model cannot bypass.
import { db, getUser } from "@/server/db";
import type { FBEvent, ID, Post, Reel, User } from "@/types";

export const isFriend = (viewerId: ID, otherId: ID) => viewerId === otherId || (getUser(viewerId)?.friendIds.includes(otherId) ?? false);

/** Mutual friends between viewer and other, as ids. */
export const mutuals = (viewerId: ID, otherId: ID) => {
  const a = getUser(viewerId);
  const b = getUser(otherId);
  if (!a || !b) return [];
  return a.friendIds.filter((f) => b.friendIds.includes(f));
};

/** A person's profile is visible if they are the viewer, a friend, or a friend-of-friend (via a named mutual). */
export function canSeeUser(viewerId: ID, u: User): boolean {
  if (isFriend(viewerId, u.id)) return true;
  return mutuals(viewerId, u.id).length > 0;
}

/** Content from a restricted ("friends") profile, or marked audience friends, is only for friends. Group posts follow group membership. */
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
  const restricted = r.audience === "friends" || author.privacy === "friends";
  return restricted ? isFriend(viewerId, r.authorId) : true;
}

export function canSeeEvent(viewerId: ID, e: FBEvent): boolean {
  if (e.hostGroupId) {
    const g = db().groups.find((x) => x.id === e.hostGroupId);
    if (g && g.privacy === "private" && !g.memberIds.includes(viewerId)) return false;
  }
  return true; // events are public in this clone
}

/** Who is going to an event, filtered to people the viewer can see. */
export const visibleGoing = (viewerId: ID, e: FBEvent) => e.going.filter((id) => {
  const u = getUser(id);
  return u ? canSeeUser(viewerId, u) : false;
});

/** Human description of how the viewer is connected to a person; null if they are not connected at all. */
export function connection(viewerId: ID, otherId: ID): { degree: 1 | 2; label: string; via?: ID } | null {
  if (viewerId === otherId) return { degree: 1, label: "you" };
  const me = getUser(viewerId);
  const other = getUser(otherId);
  if (!me || !other) return null;
  if (me.friendIds.includes(otherId)) return { degree: 1, label: me.friendLabels?.[otherId] ?? "friends" };
  const m = mutuals(viewerId, otherId);
  if (!m.length) return null;
  const via = m[0];
  const viaUser = getUser(via)!;
  const how = viaUser.friendLabels?.[otherId];
  return { degree: 2, label: `${viaUser.name.split(" ")[0]}'s friend${how ? ` (${how})` : ""}`, via };
}

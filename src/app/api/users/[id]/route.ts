import { route } from "@/server/http";
import { cardFor, db, friendRequestsFor, friendsOf, hydratePost, mutualFriends, postsBy, requireUser, userCard } from "@/server/db";
export const GET = route<{ id: string }>((_req, { userId, params }) => {
  const u = requireUser(params.id);
  const friends = friendsOf(u.id).map(userCard);
  const photos = postsBy(u.id).flatMap((p) => p.images ?? []).slice(0, 9);
  // Other people see that a door exists and to whom, never the policy text (the host's agent reads that) or busy dates.
  const pub = u.id === userId ? u : { ...u, openDoor: u.openDoor ? { ...u.openDoor, policy: "" } : undefined, busyDates: undefined };
  return {
    ...pub,
    friends,
    mutualCount: u.id === userId ? 0 : mutualFriends(userId, u.id).length,
    isFriend: requireUser(userId).friendIds.includes(u.id),
    requestPending: db().friendRequests.some((r) => (r.fromId === userId && r.toId === u.id)),
    requestedMe: friendRequestsFor(userId).some((r) => r.fromId === u.id),
    photos,
    posts: postsBy(u.id).map(hydratePost),
    groups: db().groups.filter((g) => g.memberIds.includes(u.id)).map((g) => ({ id: g.id, name: g.name, cover: g.cover, members: g.memberIds.length })),
    reels: db().reels.filter((r) => r.authorId === u.id),
    card: cardFor(u.id),
  };
});

import { route } from "@/server/http";
import { cardFor, db, friendRequestsFor, friendsOf, mutualFriends, requireUser, userCard } from "@/server/db";
export const GET = route((_req, { userId }) => {
  const me = requireUser(userId);
  const suggestions = db().users.filter((u) => u.id !== userId && !me.friendIds.includes(u.id) && !db().friendRequests.some((r) => (r.fromId === userId && r.toId === u.id) || (r.toId === userId && r.fromId === u.id))).map((u) => ({ ...userCard(u), mutuals: mutualFriends(userId, u.id).length })).sort((a, b) => b.mutuals - a.mutuals);
  return { friends: friendsOf(userId).map(userCard), requests: friendRequestsFor(userId).map((r) => ({ ...cardFor(r.fromId), mutuals: mutualFriends(userId, r.fromId).length, createdAt: r.createdAt })), suggestions };
});

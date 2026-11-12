import { route } from "@/server/http";
import { cardFor, db, requireUser } from "@/server/db";
export const GET = route((_req, { userId }) => {
  const me = requireUser(userId);
  return db().games.map((g) => ({ ...g, leaderboard: g.leaderboard.map((e) => ({ ...e, user: cardFor(e.userId), isFriend: me.friendIds.includes(e.userId) || e.userId === userId })), friendsPlaying: g.leaderboard.filter((e) => me.friendIds.includes(e.userId)).map((e) => cardFor(e.userId)) }));
});

import { route } from "@/server/http";
import { cardFor, db, requireUser } from "@/server/db";
export const GET = route((_req, { userId }) => {
  const me = requireUser(userId);
  return db().stories.filter((s) => me.friendIds.includes(s.userId) || s.userId === userId).map((s) => ({ ...s, user: cardFor(s.userId) }));
});

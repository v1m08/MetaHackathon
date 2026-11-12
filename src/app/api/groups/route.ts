import { route } from "@/server/http";
import { db, postsInGroup, requireUser } from "@/server/db";
export const GET = route((_req, { userId }) => {
  requireUser(userId);
  return db().groups.map((g) => ({ ...g, memberCount: g.memberIds.length, isMember: g.memberIds.includes(userId), lastPostAt: postsInGroup(g.id)[0]?.createdAt, newPosts: postsInGroup(g.id).filter((p) => Date.now() - new Date(p.createdAt).getTime() < 3 * 864e5).length }));
});

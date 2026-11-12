import { route } from "@/server/http";
import { cardFor, getGroup, hydratePost, postsInGroup } from "@/server/db";
export const GET = route<{ id: string }>((_req, { userId, params }) => {
  const g = getGroup(params.id);
  if (!g) throw Object.assign(new Error("Group not found"), { status: 404 });
  return { ...g, memberCount: g.memberIds.length, isMember: g.memberIds.includes(userId), isAdmin: g.adminIds.includes(userId), members: g.memberIds.map(cardFor), admins: g.adminIds.map(cardFor), posts: postsInGroup(g.id).map(hydratePost) };
});

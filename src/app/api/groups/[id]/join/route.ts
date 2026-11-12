import { route } from "@/server/http";
import { toggleGroupMembership } from "@/server/db";
export const POST = route<{ id: string }>((_req, { userId, params }) => {
  const g = toggleGroupMembership(params.id, userId);
  return { isMember: g.memberIds.includes(userId), memberCount: g.memberIds.length };
});

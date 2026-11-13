import { recordFeedbackSignal } from "@/lib/context";
import { topicsOfGroup } from "@/lib/context/taxonomy";
import { toggleGroupMembership } from "@/server/db";
import { route } from "@/server/http";
export const POST = route<{ id: string }>((_req, { userId, params }) => {
  const g = toggleGroupMembership(params.id, userId);
  const isMember = g.memberIds.includes(userId);
  const top = topicsOfGroup(g)[0];
  if (top && isMember) recordFeedbackSignal(userId, "group", g.id, top, "in");
  return { isMember, memberCount: g.memberIds.length };
});

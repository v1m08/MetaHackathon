import { route } from "@/server/http";
import { getConversation } from "@/server/db";
import { ideasFor } from "@/lib/demo/museIdeas";

// GET ?ref=<game>: Muse's group-specific plans for this chat after that game (members only).
export const GET = route<{ id: string }>(async (req, { userId, params }) => {
  const c = getConversation(params.id);
  if (!c || !c.participantIds.includes(userId)) throw Object.assign(new Error("Not in this chat"), { status: 404 });
  return ideasFor(c.id, req.nextUrl.searchParams.get("ref") ?? "", userId);
});

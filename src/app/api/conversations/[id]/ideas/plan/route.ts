import { route } from "@/server/http";
import { makeIdeaEvent } from "@/lib/demo/museIdeas";

// POST { ref, index }: turns one of Muse's ideas into an invite-only Facebook Event for the whole chat.
export const POST = route<{ id: string }>(async (_req, { userId, params, body }) => {
  const b = await body();
  return makeIdeaEvent(params.id, String(b.ref ?? ""), Number(b.index ?? 0), userId);
});

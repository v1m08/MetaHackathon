import { route } from "@/server/http";
import { dropGame } from "@/lib/demo/drop";

// POST { topic?, conversationId?, by? }: drops today's game into the demo chat and notifies every other member.
export const POST = route(async (_req, { body }) => {
  const b = await body();
  return dropGame({ topic: b.topic ? String(b.topic) : undefined, conversationId: b.conversationId ? String(b.conversationId) : undefined, by: b.by ? String(b.by) : undefined });
});

import { route } from "@/server/http";
import { hydratePost, toggleReaction } from "@/server/db";
import type { ReactionType } from "@/types";
export const POST = route<{ id: string }>(async (_req, { userId, params, body }) => {
  const b = await body();
  return hydratePost(toggleReaction(params.id, userId, (b.type as ReactionType) ?? "like"));
});

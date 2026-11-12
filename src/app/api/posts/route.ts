import { route } from "@/server/http";
import { createPost, hydratePost } from "@/server/db";
export const POST = route(async (_req, { userId, body }) => {
  const b = await body();
  if (!b.text || typeof b.text !== "string") throw Object.assign(new Error("text required"), { status: 400 });
  return hydratePost(createPost(userId, b as Parameters<typeof createPost>[1]));
});

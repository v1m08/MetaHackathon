import { route } from "@/server/http";
import { createPost, hydratePost } from "@/server/db";
export const POST = route(async (_req, { userId, body }) => {
  const b = await body();
  const text = typeof b.text === "string" ? b.text : "";
  const images = Array.isArray(b.images) ? b.images.filter((x): x is string => typeof x === "string" && !!x) : [];
  if (!text.trim() && !images.length) throw Object.assign(new Error("write something or add a photo"), { status: 400 });
  return hydratePost(createPost(userId, { ...(b as Parameters<typeof createPost>[1]), text, images }));
});

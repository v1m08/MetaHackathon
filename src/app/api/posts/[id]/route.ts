import { route } from "@/server/http";
import { getPost, hydratePost } from "@/server/db";
export const GET = route<{ id: string }>((_req, { params }) => {
  const p = getPost(params.id);
  if (!p) throw Object.assign(new Error("Post not found"), { status: 404 });
  return hydratePost(p);
});

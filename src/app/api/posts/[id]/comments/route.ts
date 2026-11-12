import { route } from "@/server/http";
import { addComment, getPost, hydratePost } from "@/server/db";
export const POST = route<{ id: string }>(async (_req, { userId, params, body }) => {
  const b = await body();
  addComment(params.id, userId, String(b.text ?? ""), b.parentId as string | undefined);
  return hydratePost(getPost(params.id)!);
});

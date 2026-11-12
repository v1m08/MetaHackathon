import { route } from "@/server/http";
import { feedFor, hydratePost } from "@/server/db";
export const GET = route((req, { userId }) => {
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 40);
  return feedFor(userId).slice(0, limit).map(hydratePost);
});

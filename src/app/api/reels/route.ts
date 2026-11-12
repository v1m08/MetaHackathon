import { route } from "@/server/http";
import { cardFor, db } from "@/server/db";
export const GET = route((req, { userId }) => {
  const saved = req.nextUrl.searchParams.get("saved") === "1";
  return db()
    .reels.filter((r) => !saved || r.savedBy.includes(userId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((r) => ({ ...r, author: cardFor(r.authorId), liked: r.likes.includes(userId), saved: r.savedBy.includes(userId), likeCount: r.likes.length + Math.floor(r.views / 23) }));
});

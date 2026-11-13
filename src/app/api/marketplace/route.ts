import { route } from "@/server/http";
import { cardFor, createListing, db } from "@/server/db";
import { socialMatchCache, socialMatchFor } from "@/lib/context";
import { topicsOfListing } from "@/lib/context/taxonomy";
export const GET = route((req, { userId }) => {
  const q = req.nextUrl.searchParams.get("q")?.toLowerCase();
  const cat = req.nextUrl.searchParams.get("category");
  const cache = socialMatchCache(userId);
  const list = db()
    .listings.filter((l) => (!q || l.title.toLowerCase().includes(q) || l.description.toLowerCase().includes(q)) && (!cat || l.category === cat))
    .map((l) => {
      const m = l.sellerId === userId || l.status !== "available" ? { fit: 0 } : socialMatchFor(userId, topicsOfListing(l), cache);
      return { ...l, seller: cardFor(l.sellerId), saved: l.savedBy.includes(userId), fit: m.fit, fitLabel: m.fitLabel, shareTarget: m.shareTarget };
    });
  return !q && !cat ? [...list].sort((a, b) => (b.fit ?? 0) - (a.fit ?? 0)) : list;
});
export const POST = route(async (_req, { userId, body }) => {
  const b = await body();
  return createListing(userId, { title: String(b.title), price: Number(b.price), description: String(b.description ?? ""), category: String(b.category ?? "Misc"), condition: (b.condition as "Good") ?? "Good", images: b.images as string[] | undefined });
});

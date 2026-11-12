import { route } from "@/server/http";
import { cardFor, createListing, db } from "@/server/db";
export const GET = route((req, { userId }) => {
  const q = req.nextUrl.searchParams.get("q")?.toLowerCase();
  const cat = req.nextUrl.searchParams.get("category");
  return db()
    .listings.filter((l) => (!q || l.title.toLowerCase().includes(q) || l.description.toLowerCase().includes(q)) && (!cat || l.category === cat))
    .map((l) => ({ ...l, seller: cardFor(l.sellerId), saved: l.savedBy.includes(userId) }));
});
export const POST = route(async (_req, { userId, body }) => {
  const b = await body();
  return createListing(userId, { title: String(b.title), price: Number(b.price), description: String(b.description ?? ""), category: String(b.category ?? "Misc"), condition: (b.condition as "Good") ?? "Good", images: b.images as string[] | undefined });
});

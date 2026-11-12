import { route } from "@/server/http";
import { cardFor, db, getListing, requireUser } from "@/server/db";
export const GET = route<{ id: string }>((_req, { userId, params }) => {
  const l = getListing(params.id);
  if (!l) throw Object.assign(new Error("Listing not found"), { status: 404 });
  const seller = requireUser(l.sellerId);
  return { ...l, seller: { ...cardFor(seller.id), joined: seller.joined, location: seller.location }, saved: l.savedBy.includes(userId), similar: db().listings.filter((x) => x.id !== l.id && x.category === l.category).slice(0, 4).map((x) => ({ ...x, seller: cardFor(x.sellerId) })) };
});

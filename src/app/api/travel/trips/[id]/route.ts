import { getTrip } from "@/lib/travel/store";
import { route } from "@/server/http";

export const GET = route<{ id: string }>((_req, { params, userId }) => {
  const t = getTrip(params.id);
  if (!t || t.viewerId !== userId) throw Object.assign(new Error("Trip not found"), { status: 404 });
  return t;
});

import { getTrip, travelStore } from "@/lib/travel/store";
import { getUser, notify } from "@/server/db";
import { route } from "@/server/http";

export const GET = route<{ id: string }>((_req, { params, userId }) => {
  const t = getTrip(params.id);
  if (!t || t.viewerId !== userId) throw Object.assign(new Error("Trip not found"), { status: 404 });
  return t;
});

/** POST { action: "confirm" | "unconfirm" }: the traveler's final yes on the assembled plan. Agents never do this. */
export const POST = route<{ id: string }>(async (_req, { params, userId, body }) => {
  const t = getTrip(params.id);
  if (!t || t.viewerId !== userId) throw Object.assign(new Error("Trip not found"), { status: 404 });
  const { action } = (await body()) as { action?: string };
  if (action === "unconfirm") { t.confirmedAt = undefined; return t; }
  t.confirmedAt = new Date().toISOString();
  const me = getUser(userId)!;
  for (const r of travelStore().requests.filter((r) => r.tripId === t.id && r.conversationId)) notify(r.hostId, { actorId: userId, type: "travel", text: `**${me.name}** confirmed the plan: ${t.cityName}, ${t.start} → ${t.end}.`, href: `/messages/${r.conversationId}` });
  return t;
});

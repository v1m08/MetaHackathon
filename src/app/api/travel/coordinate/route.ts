// POST { tripId } → shared dates + drafted messages (stored as drafts in Messenger, awaiting approval).
// GET ?tripId= → the same without drafting anything new.
import { draftConfirmAsk, draftMessages, existingDrafts, sharedDates } from "@/lib/travel/coordinate";
import { getTrip } from "@/lib/travel/store";
import { route } from "@/server/http";

export const maxDuration = 60;

export const POST = route(async (_req, { userId, body }) => {
  const b = (await body()) as { tripId?: string; action?: "confirm"; personId?: string };
  if (!b.tripId) throw Object.assign(new Error("tripId required"), { status: 400 });
  if (b.action === "confirm") {
    const trip = getTrip(b.tripId);
    if (!trip || trip.viewerId !== userId) throw Object.assign(new Error("Trip not found"), { status: 404 });
    if (!b.personId) throw Object.assign(new Error("personId required"), { status: 400 });
    const ask = draftConfirmAsk(userId, b.personId, trip.start, trip.end, trip.id);
    return { ask, dates: await sharedDates(userId, trip), drafts: existingDrafts(userId, trip.id) };
  }
  return draftMessages(userId, b.tripId);
});

export const GET = route(async (req, { userId }) => {
  const tripId = req.nextUrl.searchParams.get("tripId") ?? "";
  const trip = getTrip(tripId);
  if (!trip || trip.viewerId !== userId) throw Object.assign(new Error("Trip not found"), { status: 404 });
  return { dates: await sharedDates(userId, trip), drafts: existingDrafts(userId, tripId) };
});

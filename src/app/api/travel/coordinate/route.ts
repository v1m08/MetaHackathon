// POST { tripId } → shared dates + drafted messages (stored as drafts in Messenger, awaiting approval).
// GET ?tripId= → the same without drafting anything new.
import { draftMessages, existingDrafts, sharedDates } from "@/lib/travel/coordinate";
import { getTrip } from "@/lib/travel/store";
import { route } from "@/server/http";

export const maxDuration = 60;

export const POST = route(async (_req, { userId, body }) => {
  const { tripId } = (await body()) as { tripId?: string };
  if (!tripId) throw Object.assign(new Error("tripId required"), { status: 400 });
  return draftMessages(userId, tripId);
});

export const GET = route((req, { userId }) => {
  const tripId = req.nextUrl.searchParams.get("tripId") ?? "";
  const trip = getTrip(tripId);
  if (!trip || trip.viewerId !== userId) throw Object.assign(new Error("Trip not found"), { status: 404 });
  return { dates: sharedDates(userId, trip), drafts: existingDrafts(userId, tripId) };
});

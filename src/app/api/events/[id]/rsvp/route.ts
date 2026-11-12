import { route } from "@/server/http";
import { db, declareRide, rsvp } from "@/server/db";
export const POST = route<{ id: string }>(async (_req, { userId, params, body }) => {
  const b = await body();
  if (typeof b.drivingSeats === "number") {
    const r = declareRide(params.id, userId, b.drivingSeats);
    const e = db().events.find((x) => x.id === params.id)!;
    return { going: e.going.length, interested: e.interested.length, myStatus: e.going.includes(userId) ? "going" : "none", myRide: r ? { id: r.id, seatsOpen: r.seatsOpen } : null };
  }
  const e = rsvp(params.id, userId, (b.status as "going" | "interested" | "none") ?? "going");
  return { going: e.going.length, interested: e.interested.length, myStatus: b.status };
});

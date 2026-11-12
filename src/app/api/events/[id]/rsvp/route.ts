import { route } from "@/server/http";
import { rsvp } from "@/server/db";
export const POST = route<{ id: string }>(async (_req, { userId, params, body }) => {
  const b = await body();
  const e = rsvp(params.id, userId, (b.status as "going" | "interested" | "none") ?? "going");
  return { going: e.going.length, interested: e.interested.length, myStatus: b.status };
});

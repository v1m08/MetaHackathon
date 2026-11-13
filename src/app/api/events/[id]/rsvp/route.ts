import { recordFeedbackSignal } from "@/lib/context";
import { topicsOfEvent } from "@/lib/context/taxonomy";
import { rsvp } from "@/server/db";
import { route } from "@/server/http";
export const POST = route<{ id: string }>(async (_req, { userId, params, body }) => {
  const b = await body();
  const status = (b.status as "going" | "interested" | "none") ?? "going";
  const e = rsvp(params.id, userId, status);
  const top = topicsOfEvent(e)[0];
  if (top && status === "going") recordFeedbackSignal(userId, "event", e.id, top, "in");
  return { going: e.going.length, interested: e.interested.length, myStatus: status };
});

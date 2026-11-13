import { route } from "@/server/http";
import { eventPicksFor, markEventPicksShown } from "@/lib/events/forChat";
// GET ?ref=<game>: the Event unlock popup for the game you just finished, or why it doesn't show. No side effects.
export const GET = route<{ id: string }>((req, { userId, params }) => eventPicksFor(params.id, userId, req.nextUrl.searchParams.get("ref") ?? ""));
// POST { ref }: the popup was shown, so it counts toward once-per-game and once-a-day.
export const POST = route<{ id: string }>(async (_req, { userId, params, body }) => {
  const b = await body();
  markEventPicksShown(params.id, userId, String(b.ref ?? ""));
  return { ok: true };
});

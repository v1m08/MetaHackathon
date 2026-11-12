// POST { tripId } or { city, start, end, guests } → SSE: one `turn` per negotiation step, then `result`.
import { NextRequest } from "next/server";
import { negotiate } from "@/lib/travel/negotiate";
import { getTrip } from "@/lib/travel/store";
import { getUser } from "@/server/db";
import { currentUserId } from "@/server/http";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const bad = (error: string) => new Response(JSON.stringify({ error }), { status: 400, headers: { "content-type": "application/json" } });
  const header = req.headers.get("x-user-id") ?? req.nextUrl.searchParams.get("as");
  if (header && !getUser(header)) return bad(`unknown user ${header}`);
  const userId = currentUserId(req);
  const b = (await req.json().catch(() => ({}))) as { tripId?: string; city?: string; start?: string; end?: string; guests?: number };
  let input: { tripId?: string; city?: string; start: string; end: string; guests?: number };
  if (b.tripId) {
    const t = getTrip(b.tripId);
    if (!t || t.viewerId !== userId) return bad("trip not found");
    input = { tripId: t.id, city: t.city, start: b.start ?? t.start, end: b.end ?? t.end, guests: b.guests };
  } else {
    if (!b.city || !b.start || !b.end) return bad("city, start, end required");
    input = { city: b.city, start: b.start, end: b.end, guests: b.guests };
  }
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        const res = await negotiate(userId, input, (t) => send("turn", t));
        send("result", { ...res, requests: res.requests.map((r) => ({ id: r.id, hostId: r.hostId, status: r.status, decision: r.decision, conditions: r.conditions, alternativeDates: r.alternativeDates, anon: r.anon.forTraveler, fit: r.fit, ask: r.ask, tier: r.tier })) });
      } catch (err) {
        send("error", { message: (err as Error).message });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive", "x-accel-buffering": "no" } });
}

// POST { tripId } → SSE steps, then the guide.
import { NextRequest } from "next/server";

import { buildGuide } from "@/lib/travel/guide";
import { currentUserId } from "@/server/http";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const userId = currentUserId(req);
  const { tripId } = (await req.json().catch(() => ({}))) as { tripId?: string };
  if (!tripId) return new Response(JSON.stringify({ error: "tripId required" }), { status: 400 });
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        const guide = await buildGuide(userId, tripId, (s) => send("step", s));
        send("result", guide);
      } catch (err) {
        send("error", { message: (err as Error).message });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", "x-accel-buffering": "no" } });
}

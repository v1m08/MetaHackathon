// POST { start, end, budget, hint? } → Server-Sent Events: one `step` event per agent step, then `result`.
import { NextRequest } from "next/server";

import { discover } from "@/lib/travel/agent";
import { currentUserId } from "@/server/http";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const userId = currentUserId(req);
  const body = (await req.json().catch(() => ({}))) as { start?: string; end?: string; budget?: number; hint?: string };
  const start = body.start ?? "";
  const end = body.end ?? start;
  const budget = Number(body.budget ?? 150);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start) {
    return new Response(JSON.stringify({ error: "start/end must be YYYY-MM-DD" }), { status: 400, headers: { "content-type": "application/json" } });
  }
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        const run = await discover(userId, { start, end, budget: Math.max(10, Math.min(5000, budget)), hint: body.hint?.slice(0, 200) }, (s) => send("step", s));
        send("result", { runId: run.id, trips: run.trips, declineReason: run.declineReason, mode: run.mode, costUsd: run.costUsd, latencyMs: run.latencyMs, model: run.model });
      } catch (err) {
        send("error", { message: (err as Error).message });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive", "x-accel-buffering": "no" } });
}

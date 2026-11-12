// POST { start, end, budget, hint? } → Server-Sent Events: one `step` event per agent step, then `result`.
import { NextRequest } from "next/server";

import { discover } from "@/lib/travel/agent";
import { getUser } from "@/server/db";
import { currentUserId } from "@/server/http";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const bad = (error: string) => new Response(JSON.stringify({ error }), { status: 400, headers: { "content-type": "application/json" } });
  const header = req.headers.get("x-user-id") ?? req.nextUrl.searchParams.get("as");
  if (header && !getUser(header)) return bad(`unknown user ${header}`);
  const userId = currentUserId(req);
  const body = (await req.json().catch(() => ({}))) as { start?: string; end?: string; budget?: unknown; hint?: string };
  const start = body.start ?? "";
  const end = body.end ?? start;
  const budget = typeof body.budget === "number" ? body.budget : Number(body.budget);
  const today = new Date();
  today.setDate(today.getDate() - 1);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return bad("start and end must be YYYY-MM-DD");
  if (end < start) return bad("end must be on or after start");
  if (start < today.toISOString().slice(0, 10)) return bad("that weekend already happened");
  if ((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000 > 7) return bad("keep it to a week or less");
  if (!Number.isFinite(budget) || budget < 10 || budget > 5000) return bad("budget must be a number between 10 and 5000");
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        const run = await discover(userId, { start, end, budget: Math.round(budget), hint: body.hint?.slice(0, 200) }, (s) => send("step", s));
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

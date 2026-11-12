// POST { personIds, crewId?, crewName? } → Server-Sent Events: one `step` per agent step, then `result`.
import { NextRequest } from "next/server";
import { planGathering } from "@/lib/reconnect/plan";
import { db, getUser } from "@/server/db";
import { currentUserId } from "@/server/http";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const userId = currentUserId(req);
  const b = (await req.json().catch(() => ({}))) as { personIds?: string[]; crewId?: string };
  let personIds = Array.isArray(b.personIds) ? b.personIds.filter((id) => getUser(id)) : [];
  let crewName: string | undefined;
  if (b.crewId) {
    const c = db().conversations.find((c) => c.id === b.crewId && c.participantIds.includes(userId));
    if (c) { personIds = [...new Set([...personIds, ...c.participantIds.filter((id) => id !== userId)])]; crewName = c.name ?? undefined; }
    else if (b.crewId.startsWith("label:")) crewName = b.crewId.slice(6);
  }
  if (!personIds.length) return new Response(JSON.stringify({ error: "personIds required" }), { status: 400, headers: { "content-type": "application/json" } });
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        const run = await planGathering(userId, { personIds: personIds.slice(0, 8), crewId: b.crewId, crewName }, (s) => send("step", s));
        send("result", { runId: run.id, plans: run.plans, declineReason: run.declineReason, mode: run.mode, costUsd: run.costUsd, latencyMs: run.latencyMs });
      } catch (err) {
        send("error", { message: (err as Error).message });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive", "x-accel-buffering": "no" } });
}

// GET one unlock card (members of its chat only). POST { action: in | dismiss | undo }:
// "in" does the real RSVP / join / save for the acting member and records it as their own signal.
import { respondUnlock, viewUnlock } from "@/lib/play/recommend";
import { playStore } from "@/lib/play/store";
import { route } from "@/server/http";

export const GET = route<{ id: string }>((_req, { userId, params }) => {
  const u = playStore().unlocks.get(params.id);
  if (!u) throw Object.assign(new Error("Unlock not found"), { status: 404 });
  return viewUnlock(u, userId);
});

export const POST = route<{ id: string }>(async (_req, { userId, params, body }) => {
  const { action } = (await body()) as { action?: string };
  if (action !== "in" && action !== "dismiss" && action !== "undo") throw Object.assign(new Error("unknown action"), { status: 400 });
  return viewUnlock(respondUnlock(params.id, userId, action), userId);
});

// Eval/debug only: one round of a host's agent with an arbitrary ask, returning BOTH the raw model answer and the
// scrubbed one that would actually leave, plus what the scrubber removed. Used by scripts/eval-opendoor.mjs.
import { hostAgentAnswer } from "@/lib/travel/negotiate";
import { getUser } from "@/server/db";
import { route } from "@/server/http";
import { styleConclusions } from "@/lib/travel/style";

export const maxDuration = 60;
export const POST = route(async (_req, { body }) => {
  const b = (await body()) as { hostId: string; travelerId: string; start: string; end: string; guests?: number; message: string; offer?: string };
  if (!getUser(b.hostId) || !getUser(b.travelerId)) throw Object.assign(new Error("unknown user"), { status: 400 });
  const r = await hostAgentAnswer(b.hostId, b.travelerId, { start: b.start, end: b.end, guests: b.guests ?? 1, message: String(b.message ?? ""), offer: b.offer, round: 1 }, styleConclusions(b.travelerId));
  const host = getUser(b.hostId)!;
  return { ...r, host: { id: host.id, policy: host.openDoor?.policy, tier: host.openDoor?.tier, maxGuests: host.openDoor?.maxGuests, work: host.work, relationship: host.relationship, hometown: host.hometown } };
});

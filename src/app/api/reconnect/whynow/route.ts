// POST { personId, triggerId?, force? } → the why-now nudge for one friend (or null with a reason), plus the drift
// and the full shared index so the evidence screen can show what was and was not used.
import { driftFor, recentPostBy } from "@/lib/reconnect/drift";
import { sharedEvidence } from "@/lib/reconnect/evidence";
import { reconnectStore, isMutual, hasMissed } from "@/lib/reconnect/store";
import { whyNow } from "@/lib/reconnect/whynow";
import { getUser } from "@/server/db";
import { route } from "@/server/http";
import { connection } from "@/lib/travel/visibility";

export const POST = route(async (_req, { userId, body }) => {
  const b = (await body()) as { personId?: string; triggerId?: string; force?: boolean };
  const friend = b.personId ? getUser(b.personId) : undefined;
  if (!friend) throw Object.assign(new Error("personId required"), { status: 400 });
  const c = connection(userId, friend.id);
  const nudge = c?.degree === 1 ? await whyNow(userId, friend.id, { triggerId: b.triggerId, force: !!b.force }) : null;
  const last = [...reconnectStore().nudges.values()].filter((n) => n.viewerId === userId && n.friendId === friend.id).at(-1);
  return {
    friend: { id: friend.id, name: friend.name, avatar: friend.avatar, city: friend.city, connection: c?.label ?? "not connected" },
    drift: driftFor(userId, friend.id),
    post: recentPostBy(userId, friend.id, 14),
    nudge,
    reason: nudge ? undefined : last?.dropped ?? (c?.degree !== 1 ? "friends only" : "nothing to say yet"),
    index: sharedEvidence(userId, friend.id),
    missed: hasMissed(userId, friend.id),
    mutual: isMutual(userId, friend.id),
  };
});

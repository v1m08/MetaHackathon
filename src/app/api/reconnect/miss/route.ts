// POST { personId, on? }: a private "I miss them" pick. Nobody else can read it. If the other person picked you too,
// both of you are told, and only then; the nudge for a mutual pair runs even if the friendship looks awake.
import { whyNow } from "@/lib/reconnect/whynow";
import { setMiss, hasMissed } from "@/lib/reconnect/store";
import { getUser, notify } from "@/server/db";
import { route } from "@/server/http";
import { connection } from "@/lib/travel/visibility";

export const POST = route(async (_req, { userId, body }) => {
  const b = (await body()) as { personId?: string; on?: boolean };
  const other = b.personId ? getUser(b.personId) : undefined;
  if (!other || connection(userId, other.id)?.degree !== 1) throw Object.assign(new Error("friends only"), { status: 400 });
  const on = b.on ?? !hasMissed(userId, other.id);
  const r = setMiss(userId, other.id, on);
  if (r.mutual) {
    const me = getUser(userId)!;
    notify(userId, { actorId: other.id, type: "reconnect", text: `You and **${other.name}** both want to catch up. Here's a way.`, href: `/reconnect/${other.id}` });
    notify(other.id, { actorId: userId, type: "reconnect", text: `You and **${me.name}** both want to catch up. Here's a way.`, href: `/reconnect/${userId}` });
    // warm the nudge for both sides so the page is instant; failures are fine
    void whyNow(userId, other.id, { force: true }).catch(() => null);
    void whyNow(other.id, userId, { force: true }).catch(() => null);
  }
  return r;
});

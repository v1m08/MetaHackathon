import { route } from "@/server/http";
import { cardFor, db } from "@/server/db";
import { fitFor, fitLabel } from "@/lib/play/recommend";
import { affinityFor } from "@/lib/play/score";
import { topicsOfEvent } from "@/lib/play/taxonomy";
export const GET = route((_req, { userId }) => {
  const me = db().users.find((u) => u.id === userId)!;
  const aff = affinityFor(userId);
  return db()
    .events.map((e) => { const f = fitFor(userId, topicsOfEvent(e), aff); return { ...e, host: e.hostId ? cardFor(e.hostId) : undefined, hostGroup: e.hostGroupId ? db().groups.find((g) => g.id === e.hostGroupId)?.name : undefined, myStatus: e.going.includes(userId) ? "going" : e.interested.includes(userId) ? "interested" : "none", friendsGoing: e.going.filter((id) => me.friendIds.includes(id)).map(cardFor), fit: f.fit, fitLabel: fitLabel(f) }; })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
});

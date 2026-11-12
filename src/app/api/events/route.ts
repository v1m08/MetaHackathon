import { route } from "@/server/http";
import { cardFor, db } from "@/server/db";
export const GET = route((_req, { userId }) => {
  const me = db().users.find((u) => u.id === userId)!;
  return db()
    .events.map((e) => ({ ...e, host: e.hostId ? cardFor(e.hostId) : undefined, hostGroup: e.hostGroupId ? db().groups.find((g) => g.id === e.hostGroupId)?.name : undefined, myStatus: e.going.includes(userId) ? "going" : e.interested.includes(userId) ? "interested" : "none", friendsGoing: e.going.filter((id) => me.friendIds.includes(id)).map(cardFor) }))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
});

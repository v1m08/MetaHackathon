import { route } from "@/server/http";
import { cardFor, db } from "@/server/db";
import { socialMatchCache, socialMatchFor } from "@/lib/context";
import { topicsOfEvent } from "@/lib/context/taxonomy";
export const GET = route((_req, { userId }) => {
  const me = db().users.find((u) => u.id === userId)!;
  const cache = socialMatchCache(userId);
  return db()
    .events.map((e) => {
      const m = socialMatchFor(userId, topicsOfEvent(e), cache, { tier: "event", startsAt: e.startsAt, alreadyInIds: [...e.going, ...(e.hostId ? [e.hostId] : [])] });
      return {
        ...e,
        host: e.hostId ? cardFor(e.hostId) : undefined,
        hostGroup: e.hostGroupId ? db().groups.find((g) => g.id === e.hostGroupId)?.name : undefined,
        myStatus: e.going.includes(userId) ? "going" : e.interested.includes(userId) ? "interested" : "none",
        friendsGoing: e.going.filter((id) => me.friendIds.includes(id)).map(cardFor),
        fit: m.fit,
        fitLabel: m.fitLabel,
        shareTarget: m.shareTarget,
      };
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
});

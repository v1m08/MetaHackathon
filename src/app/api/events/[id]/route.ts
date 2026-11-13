import { socialMatchCache, socialMatchFor } from "@/lib/context";
import { topicsOfEvent } from "@/lib/context/taxonomy";
import { canSeeEvent } from "@/lib/context/visibility";
import { route } from "@/server/http";
import { cardFor, db, getEvent, hydratePost, postsInEvent } from "@/server/db";
export const GET = route<{ id: string }>((_req, { userId, params }) => {
  const e = getEvent(params.id);
  if (!e || !canSeeEvent(userId, e)) throw Object.assign(new Error("Event not found"), { status: 404 });
  const me = db().users.find((u) => u.id === userId)!;
  const m = socialMatchFor(userId, topicsOfEvent(e), socialMatchCache(userId), {
    tier: "event",
    startsAt: e.startsAt,
    alreadyInIds: [...e.going, ...(e.hostId ? [e.hostId] : [])],
  });
  return {
    ...e,
    host: e.hostId ? cardFor(e.hostId) : undefined,
    hostGroup: e.hostGroupId ? db().groups.find((g) => g.id === e.hostGroupId) : undefined,
    myStatus: e.going.includes(userId) ? "going" : e.interested.includes(userId) ? "interested" : "none",
    goingUsers: e.going.map(cardFor),
    interestedUsers: e.interested.map(cardFor),
    friendsGoing: e.going.filter((id) => me.friendIds.includes(id)).map(cardFor),
    posts: postsInEvent(e.id).map(hydratePost),
    fit: m.fit,
    fitLabel: m.fitLabel,
    shareTarget: m.shareTarget,
  };
});

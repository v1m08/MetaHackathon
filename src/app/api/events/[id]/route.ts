import { route } from "@/server/http";
import { cardFor, db, getEvent, hydratePost, postsInEvent } from "@/server/db";
export const GET = route<{ id: string }>((_req, { userId, params }) => {
  const e = getEvent(params.id);
  if (!e) throw Object.assign(new Error("Event not found"), { status: 404 });
  const me = db().users.find((u) => u.id === userId)!;
  return { ...e, host: e.hostId ? cardFor(e.hostId) : undefined, hostGroup: e.hostGroupId ? db().groups.find((g) => g.id === e.hostGroupId) : undefined, myStatus: e.going.includes(userId) ? "going" : e.interested.includes(userId) ? "interested" : "none", goingUsers: e.going.map(cardFor), interestedUsers: e.interested.map(cardFor), friendsGoing: e.going.filter((id) => me.friendIds.includes(id)).map(cardFor), posts: postsInEvent(e.id).map(hydratePost), myRide: (() => { const r = db().rides.find((x) => x.eventId === e.id && x.driverId === userId); return r ? { id: r.id, seatsOpen: r.seatsOpen } : null; })(), outOfTownForMe: !!e.city && !!me.city && e.city !== me.city };
});

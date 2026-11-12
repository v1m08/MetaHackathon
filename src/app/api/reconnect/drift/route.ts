// GET: the viewer's drift list (friends, napping first), crews, places and culture cards. All code, no model.
import { crewsFor, cultureFor, driftList, placesFor, reactivationStats } from "@/lib/reconnect/drift";
import { missesOf, isMutual } from "@/lib/reconnect/store";
import { route } from "@/server/http";

export const GET = route((_req, { userId }) => {
  const people = driftList(userId);
  const mutual = [...missesOf(userId)].filter((f) => isMutual(userId, f));
  return { people, crews: crewsFor(userId), places: placesFor(userId), culture: cultureFor(userId), stats: reactivationStats(userId), mutual };
});

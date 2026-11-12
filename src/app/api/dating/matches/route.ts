import { route } from "@/server/http";
import { cardFor, datingMatchesFor, db, requireUser } from "@/server/db";
export const GET = route((_req, { userId }) => {
  const mine = db().dating.find((d) => d.userId === userId);
  return {
    matches: datingMatchesFor(userId).map((d) => ({ ...cardFor(d.userId), photo: d.photos[0], age: requireUser(d.userId).age })),
    likedYou: mine ? mine.likedBy.filter((id) => !db().dating.find((d) => d.userId === id)?.likedBy.includes(userId)).map((id) => ({ ...cardFor(id), photo: db().dating.find((d) => d.userId === id)?.photos[0] })) : [],
  };
});

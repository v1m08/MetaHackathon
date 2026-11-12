import { route } from "@/server/http";
import { datingDeckFor, db, mutualFriends, requireUser } from "@/server/db";
export const GET = route((_req, { userId }) => {
  const mine = db().dating.find((d) => d.userId === userId);
  return {
    hasProfile: !!mine,
    deck: datingDeckFor(userId).map((d) => {
      const u = requireUser(d.userId);
      return { ...d, name: u.name.split(" ")[0], age: u.age, pronouns: u.pronouns, location: u.location, interests: u.interests, mutuals: mutualFriends(userId, u.id).length, likedYou: mine ? d.userId !== userId && mine.likedBy.includes(d.userId) : false };
    }),
  };
});

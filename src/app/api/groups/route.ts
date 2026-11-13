import { route } from "@/server/http";
import { db, postsInGroup, requireUser } from "@/server/db";
import { socialMatchCache, socialMatchFor } from "@/lib/context";
import { topicsOfGroup } from "@/lib/context/taxonomy";
export const GET = route((_req, { userId }) => {
  requireUser(userId);
  const cache = socialMatchCache(userId);
  return db().groups.map((g) => {
    const m = socialMatchFor(userId, topicsOfGroup(g), cache, { tier: "group", alreadyInIds: g.memberIds });
    return {
      ...g,
      memberCount: g.memberIds.length,
      isMember: g.memberIds.includes(userId),
      lastPostAt: postsInGroup(g.id)[0]?.createdAt,
      newPosts: postsInGroup(g.id).filter((p) => Date.now() - new Date(p.createdAt).getTime() < 3 * 864e5).length,
      fit: m.fit,
      fitLabel: m.fitLabel,
      shareTarget: m.shareTarget,
    };
  });
});

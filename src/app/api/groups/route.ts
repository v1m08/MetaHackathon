import { route } from "@/server/http";
import { db, postsInGroup, requireUser } from "@/server/db";
import { fitFor, fitLabel } from "@/lib/play/recommend";
import { affinityFor } from "@/lib/play/score";
import { topicsOfGroup } from "@/lib/play/taxonomy";
export const GET = route((_req, { userId }) => {
  requireUser(userId);
  const aff = affinityFor(userId); // the viewer's own topic affinity only; `fit` lets "Suggested" re-rank
  return db().groups.map((g) => { const f = fitFor(userId, topicsOfGroup(g), aff); return { ...g, memberCount: g.memberIds.length, isMember: g.memberIds.includes(userId), lastPostAt: postsInGroup(g.id)[0]?.createdAt, newPosts: postsInGroup(g.id).filter((p) => Date.now() - new Date(p.createdAt).getTime() < 3 * 864e5).length, fit: f.fit, fitLabel: fitLabel(f) }; });
});

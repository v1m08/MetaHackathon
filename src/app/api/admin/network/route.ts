// The viewer's travel network as a graph: direct friends (degree 1) and friends-of-friends (degree 2, each with
// the named mutual that makes them visible). Built from the same visibility rules the agent's tools use, so the
// graph shows exactly what Discover can reason over, and nothing more.
import { cityById } from "@/data/cities";
import { canSeeUser, connection, mutuals } from "@/lib/travel/visibility";
import { travelStore } from "@/lib/travel/store";
import { db, getUser, requireUser } from "@/server/db";
import { route } from "@/server/http";

export const GET = route((_req, { userId }) => {
  const me = requireUser(userId);
  const all = db().users;
  const node = (id: string, degree: 0 | 1 | 2) => {
    const u = getUser(id)!;
    const c = connection(userId, id);
    return {
      id, degree, name: u.name, avatar: u.avatar, city: u.city, cityName: cityById(u.city ?? "")?.name ?? u.location ?? "",
      openToHosting: !!u.openToHosting, hasCar: !!u.hasCar, restricted: u.privacy === "friends",
      connection: degree === 0 ? "you" : c?.label ?? "", via: c?.via, mutuals: degree === 2 ? mutuals(userId, id) : [],
    };
  };
  const friends = me.friendIds.filter((id) => getUser(id));
  const fof = all.filter((u) => u.id !== userId && !friends.includes(u.id) && canSeeUser(userId, u)).map((u) => u.id);
  const nodes = [node(userId, 0), ...friends.map((id) => node(id, 1)), ...fof.map((id) => node(id, 2))];
  const ids = new Set(nodes.map((n) => n.id));
  const edges: { a: string; b: string; label: string }[] = [];
  for (const u of all) {
    if (!ids.has(u.id)) continue;
    for (const f of u.friendIds) {
      if (!ids.has(f) || u.id > f) continue;
      edges.push({ a: u.id, b: f, label: u.friendLabels?.[f] ?? getUser(f)?.friendLabels?.[u.id] ?? "friends" });
    }
  }
  const hidden = all.length - nodes.length; // people the viewer cannot see at all (no mutual)
  // The latest Discover run for this viewer, reduced to the ids it touched, so the graph can show what the agent did.
  const run = travelStore().runs.find((r) => r.viewerId === userId);
  const latestRun = run && {
    id: run.id, input: run.input, mode: run.mode, latencyMs: run.latencyMs, costUsd: run.costUsd, declineReason: run.declineReason,
    considered: [...new Set(run.steps.flatMap((s) => s.ids ?? []).filter((id) => ids.has(id)))],
    trips: run.trips.map((t) => ({
      id: t.id, title: t.title, cityName: t.cityName, price: t.prices.ifYes.total, otherwise: t.prices.otherwise.total,
      host: t.host?.id, driver: t.ride?.driver.id, people: t.people.map((p) => p.id), going: t.event?.goingYouKnow.map((g) => g.id) ?? [],
    })),
  };
  return { me: userId, nodes, edges, hidden, cities: [...new Set(nodes.map((n) => n.city).filter(Boolean))], latestRun };
});

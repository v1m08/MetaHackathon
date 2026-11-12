// Debug/eval helper: dump a slice of the store. GET /api/admin/dump?what=rides|events|users|trips|runs
import { travelStore } from "@/lib/travel/store";
import { db } from "@/server/db";
import { route } from "@/server/http";

export const GET = route((req) => {
  const what = req.nextUrl.searchParams.get("what") ?? "counts";
  const d = db();
  switch (what) {
    case "rides":
      return d.rides;
    case "events":
      return d.events.map((e) => ({ id: e.id, title: e.title, city: e.city, startsAt: e.startsAt, going: e.going }));
    case "users":
      return d.users.map((u) => ({ id: u.id, name: u.name, city: u.city, openToHosting: u.openToHosting, hasCar: u.hasCar, privacy: u.privacy, busyDates: u.busyDates, friends: u.friendIds.length }));
    case "trips":
      return [...travelStore().trips.values()];
    case "runs":
      return travelStore().runs.map((r) => ({ id: r.id, viewerId: r.viewerId, input: r.input, trips: r.trips.length, mode: r.mode, costUsd: r.costUsd, latencyMs: r.latencyMs }));
    default:
      return { users: d.users.length, posts: d.posts.length, postsWithCity: d.posts.filter((p) => p.city).length, reels: d.reels.length, events: d.events.length, rides: d.rides.length, groups: d.groups.length, conversations: d.conversations.length, cities: d.cities.length };
  }
});

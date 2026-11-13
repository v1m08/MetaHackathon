import { db } from "@/server/db";
import { route } from "@/server/http";

export const GET = route((req) => {
  const what = req.nextUrl.searchParams.get("what") ?? "counts";
  const d = db();
  switch (what) {
    case "events":
      return d.events.map((e) => ({ id: e.id, title: e.title, city: e.city, startsAt: e.startsAt, going: e.going }));
    case "users":
      return d.users.map((u) => ({ id: u.id, name: u.name, city: u.city, privacy: u.privacy, interests: u.interests, friends: u.friendIds.length, friendIds: u.friendIds }));
    case "posts":
      return d.posts.map((p) => ({ id: p.id, authorId: p.authorId, text: p.text, city: p.city, audience: p.audience, createdAt: p.createdAt }));
    default:
      return { users: d.users.length, posts: d.posts.length, reels: d.reels.length, events: d.events.length, groups: d.groups.length, conversations: d.conversations.length };
  }
});

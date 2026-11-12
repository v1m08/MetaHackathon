import { route } from "@/server/http";
import { hydratePost, search, userCard } from "@/server/db";
export const GET = route((req) => {
  const r = search(req.nextUrl.searchParams.get("q") ?? "");
  return { ...r, people: r.people.map(userCard), posts: r.posts.map(hydratePost) };
});

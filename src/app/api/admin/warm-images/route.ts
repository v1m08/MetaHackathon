// Pre-fetches every image the seed references into the local cache. `npm run warm` calls this.
import { route } from "@/server/http";
import { db } from "@/server/db";
import { cacheImage } from "@/server/images";

export const maxDuration = 300;

export const GET = route(async () => {
  const d = db();
  const urls = new Set<string>();
  const add = (u?: string) => {
    if (!u) return;
    const m = u.match(/^\/api\/img\?u=(.+)$/);
    if (m) urls.add(decodeURIComponent(m[1]));
  };
  d.users.forEach((u) => (add(u.avatar), add(u.cover)));
  d.posts.forEach((p) => p.images?.forEach(add));
  d.stories.forEach((s) => add(s.image));
  d.groups.forEach((g) => add(g.cover));
  d.events.forEach((e) => add(e.cover));
  d.listings.forEach((l) => l.images.forEach(add));
  d.reels.forEach((r) => add(r.image));
  d.dating.forEach((p) => p.photos.forEach(add));
  d.conversations.forEach((c) => c.messages.forEach((m) => m.attachment?.type === "image" && add(m.attachment.ref)));
  const list = [...urls];
  let ok = 0;
  const failedUrls: string[] = [];
  // modest concurrency to be polite to the placeholder services; one retry for stragglers
  for (let i = 0; i < list.length; i += 6) {
    const batch = list.slice(i, i + 6);
    const results = await Promise.all(batch.map(cacheImage));
    for (let j = 0; j < batch.length; j++) {
      if (results[j]) ok++;
      else if (await cacheImage(batch[j])) ok++;
      else failedUrls.push(batch[j]);
    }
  }
  return { total: list.length, cached: ok, failed: failedUrls.length, failedUrls: failedUrls.slice(0, 12) };
});

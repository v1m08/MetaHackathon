import type { Database, Notification } from "@/types";
import { conversations } from "./conversations";
import { demoConversation, demoDMs, demoEvents, demoPosts, demoStories, demoUsers, museUser } from "./demo";
import { dayStartMs } from "@/lib/context/day";
import { dating } from "./dating";
import { events } from "./events";
import { feedPosts, stories } from "./feedPosts";
import { games } from "./games";
import { groupPosts } from "./groupPosts";
import { groups } from "./groups";
import { hoursAgo } from "./helpers";
import { listings } from "./listings";
import { reels } from "./reels";
import { users } from "./users";

// Notifications are derived from the seed so they always point at real content.
function buildNotifications(): Notification[] {
  const out: Notification[] = [];
  let n = 0;
  const push = (p: Omit<Notification, "id">) => out.push({ id: `n_${++n}`, ...p });
  const allPosts = [...feedPosts, ...groupPosts];

  for (const u of users) {
    const mine = allPosts.filter((p) => p.authorId === u.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4);
    for (const p of mine) {
      const likers = p.reactions.like ?? [];
      if (likers.length) {
        const first = users.find((x) => x.id === likers[0])!;
        const others = likers.length - 1;
        push({
          userId: u.id, actorId: first.id, type: "like", read: false,
          text: `**${first.name}**${others > 0 ? ` and ${others} other${others > 1 ? "s" : ""}` : ""} reacted to your post: "${p.text.slice(0, 48)}…"`,
          href: `/post/${p.id}`, createdAt: hoursAgo(1 + (n % 9)),
        });
      }
      const lastComment = p.comments[p.comments.length - 1];
      if (lastComment && lastComment.authorId !== u.id) {
        const c = users.find((x) => x.id === lastComment.authorId)!;
        push({ userId: u.id, actorId: c.id, type: "comment", read: n % 3 === 0, text: `**${c.name}** commented on your post: "${lastComment.text.slice(0, 60)}"`, href: `/post/${p.id}`, createdAt: hoursAgo(2 + (n % 14)) });
      }
    }
    for (const e of events) {
      if (e.invited?.includes(u.id) || (e.interested.includes(u.id) && new Date(e.startsAt).getTime() > Date.now())) {
        const host = users.find((x) => x.id === e.hostId);
        push({ userId: u.id, actorId: host?.id, type: "event_invite", read: false, text: `**${host?.name ?? "A group"}** invited you to **${e.title}**`, href: `/events/${e.id}`, createdAt: hoursAgo(5 + (n % 20)) });
      }
    }
    for (const g of groups.filter((g) => g.memberIds.includes(u.id)).slice(0, 2)) {
      const latest = groupPosts.filter((p) => p.groupId === g.id && p.authorId !== u.id)[0];
      if (latest) {
        const a = users.find((x) => x.id === latest.authorId)!;
        push({ userId: u.id, actorId: a.id, type: "group_post", read: n % 2 === 0, text: `**${a.name}** posted in **${g.name}**: "${latest.text.slice(0, 50)}…"`, href: `/groups/${g.id}`, createdAt: hoursAgo(3 + (n % 30)) });
      }
    }
    const saved = listings.find((l) => l.savedBy.includes(u.id));
    if (saved) push({ userId: u.id, actorId: saved.sellerId, type: "marketplace", read: true, text: `Price drop? **${saved.title}** is still available in Marketplace`, href: `/marketplace/${saved.id}`, createdAt: hoursAgo(26 + (n % 10)) });
    const friendWithBday = users.find((x) => u.friendIds.includes(x.id) && x.birthday);
    if (friendWithBday) push({ userId: u.id, actorId: friendWithBday.id, type: "birthday", read: true, text: `**${friendWithBday.name}** has a birthday coming up. Wish them well!`, href: `/profile/${friendWithBday.id}`, createdAt: hoursAgo(40) });
    push({ userId: u.id, type: "memory", read: true, text: `You have a new memory to look back on today`, href: `/profile/${u.id}`, createdAt: hoursAgo(50) });
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function buildSeed(): Database {
  return {
    users: structuredClone([...users, ...demoUsers, museUser]),
    posts: structuredClone([...feedPosts, ...groupPosts, ...demoPosts]).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    stories: structuredClone([...demoStories, ...stories]),
    groups: structuredClone(groups),
    events: structuredClone([...events, ...demoEvents]),
    listings: structuredClone(listings),
    reels: structuredClone(reels),
    conversations: structuredClone([demoConversation, ...demoDMs(Date.now(), dayStartMs()), ...conversations]),
    dating: structuredClone(dating),
    games: structuredClone(games),
    notifications: buildNotifications(),
    friendRequests: [
      { fromId: "tyler", toId: "maya", createdAt: hoursAgo(5) },
      { fromId: "zoe", toId: "maya", createdAt: hoursAgo(30) },
      { fromId: "grace", toId: "jordan", createdAt: hoursAgo(12) },
      { fromId: "marcus", toId: "priya", createdAt: hoursAgo(8) },
    ].filter((fr) => !users.find((u) => u.id === fr.fromId)!.friendIds.includes(fr.toId)),
  };
}

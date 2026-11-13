// Server-side tools the model can call. They read the same in-memory store the UI uses,
// so anything the app knows, the model can be given access to. Add yours here.
import { db, feedFor, getGroup, getUser, postsInGroup, search } from "@/server/db";
import type { ToolDef } from "./types";

const summarizePost = (p: { authorId: string; text: string; createdAt: string; comments: { authorId: string; text: string }[]; reactions: Record<string, string[] | undefined> }) => ({
  author: getUser(p.authorId)?.name ?? p.authorId,
  when: p.createdAt.slice(0, 10),
  text: p.text,
  reactions: Object.values(p.reactions).reduce((n, a) => n + (a?.length ?? 0), 0),
  comments: p.comments.map((c) => `${getUser(c.authorId)?.name.split(" ")[0] ?? c.authorId}: ${c.text}`),
});

export const getUserProfile: ToolDef<{ userId: string }> = {
  name: "get_user_profile",
  description: "Get a user's public profile: bio, work, school, interests, friends, groups.",
  parameters: { type: "object", properties: { userId: { type: "string", description: "User id such as 'maya'" } }, required: ["userId"] },
  run: ({ userId }) => {
    const u = getUser(userId);
    if (!u) return { error: "no such user" };
    return { id: u.id, name: u.name, age: u.age, pronouns: u.pronouns, bio: u.bio, work: u.work, school: u.school, location: u.location, interests: u.interests, friends: u.friendIds.map((f) => getUser(f)?.name), groups: db().groups.filter((g) => g.memberIds.includes(u.id)).map((g) => g.name) };
  },
};

export const getGroupPosts: ToolDef<{ groupId: string; limit?: number }> = {
  name: "get_group_posts",
  description: "Get recent posts (with comments) from a group, newest first.",
  parameters: { type: "object", properties: { groupId: { type: "string", description: "Group id such as 'g_runclub'" }, limit: { type: "integer", description: "Max posts, default 15" } }, required: ["groupId"] },
  run: ({ groupId, limit }) => {
    const g = getGroup(groupId);
    if (!g) return { error: "no such group" };
    return { group: g.name, description: g.description, members: g.memberIds.length, posts: postsInGroup(groupId).slice(0, limit ?? 15).map(summarizePost) };
  },
};

export const getFeed: ToolDef<{ userId: string; limit?: number }> = {
  name: "get_feed",
  description: "Get the posts a user would see on their home feed (friends + groups), newest first.",
  parameters: { type: "object", properties: { userId: { type: "string" }, limit: { type: "integer" } }, required: ["userId"] },
  run: ({ userId, limit }) => feedFor(userId).slice(0, limit ?? 20).map(summarizePost),
};

export const searchEverything: ToolDef<{ query: string }> = {
  name: "search",
  description: "Full-text search across people, groups, events, marketplace listings and posts.",
  parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  run: ({ query }) => {
    const r = search(query);
    return { people: r.people.map((u) => ({ id: u.id, name: u.name, bio: u.bio })), groups: r.groups.map((g) => ({ id: g.id, name: g.name })), events: r.events.map((e) => ({ id: e.id, title: e.title, startsAt: e.startsAt, location: e.location })), listings: r.listings.map((l) => ({ id: l.id, title: l.title, price: l.price })), posts: r.posts.slice(0, 5).map(summarizePost) };
  },
};

export const getUpcomingEvents: ToolDef<{ userId: string }> = {
  name: "get_upcoming_events",
  description: "Upcoming events, with whether the user and their friends are going.",
  parameters: { type: "object", properties: { userId: { type: "string" } }, required: ["userId"] },
  run: ({ userId }) => {
    const me = getUser(userId);
    return db()
      .events.filter((e) => new Date(e.startsAt).getTime() > Date.now() && (!e.inviteOnly || e.hostId === userId || e.going.includes(userId) || !!e.invited?.includes(userId)))
      .map((e) => ({ id: e.id, title: e.title, startsAt: e.startsAt, location: e.location, going: e.going.length, meGoing: e.going.includes(userId), friendsGoing: e.going.filter((id) => me?.friendIds.includes(id)).map((id) => getUser(id)?.name) }));
  },
};

export const getConversations: ToolDef<{ userId: string; limit?: number }> = {
  name: "get_recent_messages",
  description: "The user's recent Messenger conversations with the last few messages of each.",
  parameters: { type: "object", properties: { userId: { type: "string" }, limit: { type: "integer" } }, required: ["userId"] },
  run: ({ userId, limit }) =>
    db()
      .conversations.filter((c) => c.participantIds.includes(userId))
      .slice(0, limit ?? 6)
      .map((c) => ({ id: c.id, name: c.name ?? c.participantIds.filter((p) => p !== userId).map((p) => getUser(p)?.name).join(", "), last: c.messages.slice(-5).map((m) => `${getUser(m.senderId)?.name.split(" ")[0]}: ${m.text}`) })),
};

export const allTools: ToolDef[] = [getUserProfile as ToolDef, getGroupPosts as ToolDef, getFeed as ToolDef, searchEverything as ToolDef, getUpcomingEvents as ToolDef, getConversations as ToolDef];

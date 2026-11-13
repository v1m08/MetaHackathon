// In-memory store. Seeded at boot, survives hot reloads via globalThis, resets on restart.
// Every mutation the UI needs lives here so API routes stay thin and AI tools can reuse them.
import { buildSeed } from "@/data";
import { seedSidequestIntoDb } from "@/lib/context/seed";
import { photoUrl } from "@/lib/img";
import type { Comment, Conversation, Database, FBEvent, Group, ID, Listing, Message, Notification, Post, ReactionType, User } from "@/types";

const g = globalThis as unknown as { __fbdb?: Database };
export function db(): Database {
  if (!g.__fbdb) {
    g.__fbdb = buildSeed();
    seedSidequestIntoDb(g.__fbdb);
  }
  return g.__fbdb;
}
export function resetDb() {
  g.__fbdb = buildSeed();
  seedSidequestIntoDb(g.__fbdb);
  return g.__fbdb;
}

let seq = 1000;
export const newId = (p: string) => `${p}_${Date.now().toString(36)}${(seq++).toString(36)}`;
const now = () => new Date().toISOString();

// ---------- users ----------
export const getUser = (id: ID): User | undefined => db().users.find((u) => u.id === id);
export const requireUser = (id: ID): User => {
  const u = getUser(id);
  if (!u) throw Object.assign(new Error(`Unknown user ${id}`), { status: 404 });
  return u;
};
export const friendsOf = (id: ID) => requireUser(id).friendIds.map(getUser).filter(Boolean) as User[];
export const mutualFriends = (a: ID, b: ID) => requireUser(a).friendIds.filter((f) => requireUser(b).friendIds.includes(f));

/** Public-safe user card. */
export const userCard = (u: User) => ({ id: u.id, name: u.name, username: u.username, avatar: u.avatar, pronouns: u.pronouns });
export const cardFor = (id: ID) => {
  const u = getUser(id);
  return u ? userCard(u) : { id, name: "Facebook User", username: id, avatar: "", pronouns: "" };
};

// ---------- posts ----------
export function hydratePost(p: Post) {
  const hydrateComment = (c: Comment): HydratedComment => ({ ...c, author: cardFor(c.authorId), replies: c.replies?.map(hydrateComment) });
  const group = p.groupId ? db().groups.find((g) => g.id === p.groupId) : undefined;
  return {
    ...p,
    author: cardFor(p.authorId),
    group: group ? { id: group.id, name: group.name, cover: group.cover } : undefined,
    tagged: p.taggedIds?.map(cardFor),
    comments: p.comments.map(hydrateComment),
    reactionCount: Object.values(p.reactions).reduce((n, arr) => n + (arr?.length ?? 0), 0),
    commentCount: p.comments.reduce((n, c) => n + 1 + (c.replies?.length ?? 0), 0),
  };
}
export type HydratedComment = Omit<Comment, "replies"> & { author: ReturnType<typeof cardFor>; replies?: HydratedComment[] };
export type HydratedPost = ReturnType<typeof hydratePost>;

/** Home feed: friends' posts + posts in my groups + public posts, newest first. */
export function feedFor(userId: ID): Post[] {
  const me = requireUser(userId);
  const myGroups = db().groups.filter((g) => g.memberIds.includes(userId)).map((g) => g.id);
  return db()
    .posts.filter((p) => {
      if (p.eventId) return false;
      if (p.groupId) return myGroups.includes(p.groupId);
      return p.authorId === userId || me.friendIds.includes(p.authorId) || p.audience === "public";
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export const postsBy = (userId: ID) => db().posts.filter((p) => p.authorId === userId && !p.groupId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
export const postsInGroup = (groupId: ID) => db().posts.filter((p) => p.groupId === groupId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
export const postsInEvent = (eventId: ID) => db().posts.filter((p) => p.eventId === eventId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
export const getPost = (id: ID) => db().posts.find((p) => p.id === id);

export function createPost(authorId: ID, input: { text: string; images?: string[]; groupId?: ID; eventId?: ID; feeling?: string; location?: string; audience?: "public" | "friends" }): Post {
  requireUser(authorId);
  const post: Post = { id: newId("p"), authorId, createdAt: now(), text: input.text.trim(), images: input.images?.filter(Boolean), groupId: input.groupId, eventId: input.eventId, feeling: input.feeling, location: input.location, reactions: {}, comments: [], shares: 0, audience: input.audience ?? "friends" };
  db().posts.unshift(post);
  return post;
}

export function toggleReaction(postId: ID, userId: ID, type: ReactionType = "like") {
  const p = getPost(postId);
  if (!p) throw Object.assign(new Error("Post not found"), { status: 404 });
  const existing = (Object.keys(p.reactions) as ReactionType[]).find((t) => p.reactions[t]?.includes(userId));
  if (existing) p.reactions[existing] = p.reactions[existing]!.filter((id) => id !== userId);
  if (existing !== type) {
    p.reactions[type] = [...(p.reactions[type] ?? []), userId];
    if (p.authorId !== userId) notify(p.authorId, { actorId: userId, type: "like", text: `**${requireUser(userId).name}** reacted to your post`, href: `/post/${p.id}` });
  }
  return p;
}

export function addComment(postId: ID, userId: ID, text: string, parentId?: ID) {
  const p = getPost(postId);
  if (!p) throw Object.assign(new Error("Post not found"), { status: 404 });
  const c: Comment = { id: newId("c"), authorId: userId, text: text.trim(), createdAt: now(), likes: [] };
  if (parentId) {
    const parent = p.comments.find((x) => x.id === parentId);
    if (parent) (parent.replies ??= []).push(c);
    else p.comments.push(c);
  } else p.comments.push(c);
  if (p.authorId !== userId) notify(p.authorId, { actorId: userId, type: "comment", text: `**${requireUser(userId).name}** commented: "${c.text.slice(0, 60)}"`, href: `/post/${p.id}` });
  return c;
}

// ---------- groups / events ----------
export const getGroup = (id: ID): Group | undefined => db().groups.find((g) => g.id === id);
export const groupsFor = (userId: ID) => db().groups.filter((g) => g.memberIds.includes(userId));
export function toggleGroupMembership(groupId: ID, userId: ID) {
  const g = getGroup(groupId);
  if (!g) throw Object.assign(new Error("Group not found"), { status: 404 });
  g.memberIds = g.memberIds.includes(userId) ? g.memberIds.filter((m) => m !== userId) : [...g.memberIds, userId];
  return g;
}
export const getEvent = (id: ID): FBEvent | undefined => db().events.find((e) => e.id === id);
export function rsvp(eventId: ID, userId: ID, status: "going" | "interested" | "none") {
  const e = getEvent(eventId);
  if (!e) throw Object.assign(new Error("Event not found"), { status: 404 });
  e.going = e.going.filter((id) => id !== userId);
  e.interested = e.interested.filter((id) => id !== userId);
  if (status === "going") e.going.push(userId);
  if (status === "interested") e.interested.push(userId);
  return e;
}

// ---------- marketplace / reels ----------
export const getListing = (id: ID): Listing | undefined => db().listings.find((l) => l.id === id);
export function toggleSaveListing(id: ID, userId: ID) {
  const l = getListing(id);
  if (!l) throw Object.assign(new Error("Listing not found"), { status: 404 });
  l.savedBy = l.savedBy.includes(userId) ? l.savedBy.filter((x) => x !== userId) : [...l.savedBy, userId];
  return l;
}
export function createListing(sellerId: ID, input: Pick<Listing, "title" | "price" | "description" | "category" | "condition"> & { images?: string[]; location?: string }) {
  const l: Listing = { id: newId("l"), sellerId, createdAt: now(), status: "available", savedBy: [], images: input.images?.length ? input.images : [photoUrl(input.title, 800, 800)], location: input.location ?? requireUser(sellerId).location, ...input };
  db().listings.unshift(l);
  return l;
}
export const getReel = (id: ID) => db().reels.find((r) => r.id === id);
export function toggleReel(id: ID, userId: ID, field: "likes" | "savedBy") {
  const r = getReel(id);
  if (!r) throw Object.assign(new Error("Reel not found"), { status: 404 });
  r[field] = r[field].includes(userId) ? r[field].filter((x) => x !== userId) : [...r[field], userId];
  return r;
}

// ---------- messenger ----------
export const conversationsFor = (userId: ID) =>
  db()
    .conversations.filter((c) => c.participantIds.includes(userId))
    .sort((a, b) => (b.messages.at(-1)?.createdAt ?? "").localeCompare(a.messages.at(-1)?.createdAt ?? ""));
export const getConversation = (id: ID) => db().conversations.find((c) => c.id === id);
export function getOrCreateDM(a: ID, b: ID): Conversation {
  const existing = db().conversations.find((c) => !c.isGroup && c.participantIds.includes(a) && c.participantIds.includes(b));
  if (existing) return existing;
  const c: Conversation = { id: newId("c"), participantIds: [a, b], isGroup: false, messages: [] };
  db().conversations.push(c);
  return c;
}
export function sendMessage(conversationId: ID, senderId: ID, text: string, attachment?: Message["attachment"]) {
  const c = getConversation(conversationId);
  if (!c) throw Object.assign(new Error("Conversation not found"), { status: 404 });
  if (!c.participantIds.includes(senderId)) throw Object.assign(new Error("Not a participant"), { status: 403 });
  const m: Message = { id: newId("m"), senderId, text: text.trim(), createdAt: now(), attachment, readBy: [senderId] };
  c.messages.push(m);
  return m;
}
export function markConversationRead(conversationId: ID, userId: ID) {
  const c = getConversation(conversationId);
  if (!c) return;
  for (const m of c.messages) if (!m.readBy?.includes(userId)) (m.readBy ??= []).push(userId);
}
export const unreadCount = (userId: ID) => conversationsFor(userId).reduce((n, c) => n + c.messages.filter((m) => m.senderId !== userId && !m.readBy?.includes(userId)).length, 0);

// ---------- dating ----------
export const datingDeckFor = (userId: ID) =>
  db().dating.filter((d) => d.userId !== userId && !d.likedBy.includes(userId) && !d.passedBy.includes(userId));
export function datingSwipe(userId: ID, targetId: ID, action: "like" | "pass") {
  const target = db().dating.find((d) => d.userId === targetId);
  if (!target) throw Object.assign(new Error("Profile not found"), { status: 404 });
  (action === "like" ? target.likedBy : target.passedBy).push(userId);
  const mine = db().dating.find((d) => d.userId === userId);
  const matched = action === "like" && !!mine && mine.likedBy.includes(targetId);
  return { matched };
}
export const datingMatchesFor = (userId: ID) => {
  const mine = db().dating.find((d) => d.userId === userId);
  if (!mine) return [];
  return db().dating.filter((d) => d.likedBy.includes(userId) && mine.likedBy.includes(d.userId));
};

// ---------- games ----------
export function submitScore(gameId: ID, userId: ID, score: number, lowerIsBetter: boolean) {
  const g = db().games.find((x) => x.id === gameId);
  if (!g) throw Object.assign(new Error("Game not found"), { status: 404 });
  const existing = g.leaderboard.find((e) => e.userId === userId);
  if (!existing) g.leaderboard.push({ userId, score });
  else if (lowerIsBetter ? score < existing.score : score > existing.score) existing.score = score;
  g.leaderboard.sort((a, b) => (lowerIsBetter ? a.score - b.score : b.score - a.score));
  return g;
}

// ---------- notifications / friends ----------
export function notify(userId: ID, n: Omit<Notification, "id" | "userId" | "createdAt" | "read">) {
  db().notifications.unshift({ id: newId("n"), userId, createdAt: now(), read: false, ...n });
}
export const notificationsFor = (userId: ID) => db().notifications.filter((n) => n.userId === userId);
export function markNotificationsRead(userId: ID, ids?: ID[]) {
  for (const n of notificationsFor(userId)) if (!ids || ids.includes(n.id)) n.read = true;
}
export const friendRequestsFor = (userId: ID) => db().friendRequests.filter((r) => r.toId === userId);
export function respondFriendRequest(userId: ID, fromId: ID, accept: boolean) {
  db().friendRequests = db().friendRequests.filter((r) => !(r.toId === userId && r.fromId === fromId));
  if (accept) {
    requireUser(userId).friendIds.push(fromId);
    requireUser(fromId).friendIds.push(userId);
    notify(fromId, { actorId: userId, type: "friend_request", text: `**${requireUser(userId).name}** accepted your friend request`, href: `/profile/${userId}` });
  }
}
export function sendFriendRequest(fromId: ID, toId: ID) {
  if (db().friendRequests.some((r) => r.fromId === fromId && r.toId === toId)) return;
  db().friendRequests.push({ fromId, toId, createdAt: now() });
  notify(toId, { actorId: fromId, type: "friend_request", text: `**${requireUser(fromId).name}** sent you a friend request`, href: `/friends` });
}

// ---------- search ----------
export function search(q: string) {
  const s = q.trim().toLowerCase();
  if (!s) return { people: [], groups: [], events: [], listings: [], posts: [] };
  const has = (...fields: (string | undefined)[]) => fields.some((f) => f?.toLowerCase().includes(s));
  return {
    people: db().users.filter((u) => has(u.name, u.username, u.bio, u.work, u.school, ...u.interests)).slice(0, 8),
    groups: db().groups.filter((g) => has(g.name, g.description, ...g.tags)).slice(0, 5),
    events: db().events.filter((e) => has(e.title, e.description, e.location)).slice(0, 5),
    listings: db().listings.filter((l) => has(l.title, l.description, l.category)).slice(0, 6),
    posts: db().posts.filter((p) => has(p.text)).slice(0, 8),
  };
}

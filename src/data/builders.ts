import type { Comment, Post, ReactionType } from "@/types";
import { daysAgo, hoursAgo, uid } from "./helpers";
import { users } from "./users";

const everyone = users.map((u) => u.id);

/** Pick n deterministic reactors, excluding the author. */
export function reactors(seed: string, n: number, exclude: string[] = []): string[] {
  const pool = everyone.filter((id) => !exclude.includes(id));
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const out: string[] = [];
  for (let i = 0; i < n && pool.length; i++) {
    const idx = (h + i * 7919) % pool.length;
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

export type CommentSpec = [author: string, text: string, replies?: CommentSpec[]];

export function C(spec: CommentSpec, baseIso: string, i: number): Comment {
  const [authorId, text, replies] = spec;
  const createdAt = new Date(new Date(baseIso).getTime() + (i + 1) * 23 * 60_000).toISOString();
  return {
    id: uid("c"),
    authorId,
    text,
    createdAt,
    likes: reactors(text, (text.length % 4), [authorId]),
    replies: replies?.map((r, j) => C(r, createdAt, j)),
  };
}

export interface PostOpts {
  group?: string;
  event?: string;
  images?: string[];
  comments?: CommentSpec[];
  likes?: number;
  love?: number;
  haha?: number;
  wow?: number;
  care?: number;
  sad?: number;
  shares?: number;
  feeling?: string;
  location?: string;
  tagged?: string[];
  hours?: boolean; // interpret `when` as hours ago instead of days ago
  audience?: "public" | "friends";
}

export function P(authorId: string, when: number, text: string, o: PostOpts = {}): Post {
  const createdAt = o.hours ? hoursAgo(when) : daysAgo(when, 9 + (text.length % 11));
  const reactions: Partial<Record<ReactionType, string[]>> = {};
  const likeN = o.likes ?? 3 + (text.length % 9);
  reactions.like = reactors(text, likeN, [authorId]);
  if (o.love) reactions.love = reactors(text + "love", o.love, [authorId, ...reactions.like]);
  if (o.haha) reactions.haha = reactors(text + "haha", o.haha, [authorId, ...reactions.like]);
  if (o.wow) reactions.wow = reactors(text + "wow", o.wow, [authorId, ...reactions.like]);
  if (o.care) reactions.care = reactors(text + "care", o.care, [authorId, ...reactions.like]);
  if (o.sad) reactions.sad = reactors(text + "sad", o.sad, [authorId, ...reactions.like]);
  return {
    id: uid("p"),
    authorId,
    createdAt,
    text,
    images: o.images,
    groupId: o.group,
    eventId: o.event,
    feeling: o.feeling,
    location: o.location,
    taggedIds: o.tagged,
    reactions,
    comments: (o.comments ?? []).map((c, i) => C(c, createdAt, i)),
    shares: o.shares ?? (text.length % 3),
    audience: o.audience ?? (o.group ? undefined : "friends"),
  };
}

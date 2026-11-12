// Shared domain types. Every surface reads from these; add fields freely.

export type ID = string;

export type ReactionType = "like" | "love" | "haha" | "wow" | "sad" | "angry" | "care";

export interface User {
  id: ID;
  name: string;
  username: string;
  avatar: string;
  cover: string;
  age: number;
  pronouns: string;
  bio: string;
  location: string;
  hometown?: string;
  school?: string;
  work?: string;
  relationship?: string;
  joined: string; // ISO
  friendIds: ID[];
  interests: string[];
  birthday?: string; // MM-DD
}

export interface Comment {
  id: ID;
  authorId: ID;
  text: string;
  createdAt: string;
  likes: ID[];
  replies?: Comment[];
}

export interface Post {
  id: ID;
  authorId: ID;
  createdAt: string;
  text: string;
  images?: string[];
  groupId?: ID;
  eventId?: ID;
  feeling?: string;
  location?: string;
  taggedIds?: ID[];
  reactions: Partial<Record<ReactionType, ID[]>>;
  comments: Comment[];
  shares: number;
  /** Who this post is visible to when not in a group. */
  audience?: "public" | "friends";
}

export interface Story {
  id: ID;
  userId: ID;
  image: string;
  caption?: string;
  createdAt: string;
}

export interface Group {
  id: ID;
  name: string;
  cover: string;
  description: string;
  privacy: "public" | "private";
  memberIds: ID[];
  adminIds: ID[];
  tags: string[];
  createdAt: string;
  rules?: string[];
  postsPerDay?: number;
}

export interface FBEvent {
  id: ID;
  title: string;
  cover: string;
  startsAt: string;
  endsAt?: string;
  location: string;
  address?: string;
  hostId?: ID;
  hostGroupId?: ID;
  description: string;
  going: ID[];
  interested: ID[];
  invited?: ID[];
  category: string;
  price?: string;
}

export interface Listing {
  id: ID;
  sellerId: ID;
  title: string;
  price: number;
  images: string[];
  description: string;
  category: string;
  location: string;
  createdAt: string;
  condition: "New" | "Like new" | "Good" | "Fair";
  status: "available" | "pending" | "sold";
  savedBy: ID[];
}

export interface Reel {
  id: ID;
  authorId: ID;
  image: string;
  videoUrl?: string;
  caption: string;
  audio: string;
  likes: ID[];
  commentCount: number;
  shares: number;
  views: number;
  savedBy: ID[];
  tags: string[];
  createdAt: string;
}

export interface Message {
  id: ID;
  senderId: ID;
  text: string;
  createdAt: string;
  reactions?: Record<ID, string>;
  attachment?: { type: "image" | "listing" | "event"; ref: string };
  readBy?: ID[];
}

export interface Conversation {
  id: ID;
  participantIds: ID[];
  isGroup: boolean;
  name?: string;
  emoji?: string;
  messages: Message[];
}

export interface DatingProfile {
  userId: ID;
  photos: string[];
  prompts: { question: string; answer: string }[];
  lookingFor: string;
  height?: string;
  job?: string;
  education?: string;
  distanceMiles: number;
  likedBy: ID[];
  passedBy: ID[];
}

export interface Game {
  id: ID;
  name: string;
  icon: string;
  genre: string;
  players: string;
  description: string;
  leaderboard: { userId: ID; score: number }[];
  playable?: boolean;
}

export type NotificationType =
  | "like"
  | "comment"
  | "friend_request"
  | "event_invite"
  | "group_post"
  | "birthday"
  | "marketplace"
  | "memory"
  | "mention";

export interface Notification {
  id: ID;
  userId: ID; // recipient
  actorId?: ID;
  type: NotificationType;
  text: string;
  href: string;
  createdAt: string;
  read: boolean;
}

export interface Database {
  users: User[];
  posts: Post[];
  stories: Story[];
  groups: Group[];
  events: FBEvent[];
  listings: Listing[];
  reels: Reel[];
  conversations: Conversation[];
  dating: DatingProfile[];
  games: Game[];
  notifications: Notification[];
  friendRequests: { fromId: ID; toId: ID; createdAt: string }[];
}

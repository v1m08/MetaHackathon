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
  /** City id (see data/cities.ts). Derived from location when missing. */
  city?: string;
  /** Travel: hosting is opt-in. Only people who turned this on are ever proposed as hosts. */
  openToHosting?: boolean;
  hostingNote?: string;
  hasCar?: boolean;
  /** Dates (YYYY-MM-DD) this person is busy; used by availability checks. */
  busyDates?: string[];
  /** Default visibility of this person's posts, photos and Reels. "friends" = restricted profile. */
  privacy?: "public" | "friends";
  /** How this person knows each friend, by friend id ("UT Design classmates"). */
  friendLabels?: Record<ID, string>;
  /** Open Door: this person's hosting policy in their own words, plus who it is open to and what they offer.
   *  `openToHosting`/`hostingNote` are kept in sync from it (couch offered + on) so older code keeps working. */
  openDoor?: OpenDoor;
}

export type OpenDoorTier = "friends" | "fof" | "network";
export type OpenDoorOffer = "couch" | "ride" | "show-around";
export interface OpenDoor {
  on: boolean;
  /** Free text, their words: "Couch open for college friends and their friends. Not during finals. One person max." */
  policy: string;
  tier: OpenDoorTier;
  offers: OpenDoorOffer[];
  maxGuests: number;
  updatedAt?: string;
}

export interface City {
  id: ID;
  name: string;
  state: string;
  lat: number;
  lng: number;
  /** Seeded nightly prices in USD, used by code (never by the model) for the two-price cost math. */
  hotelNight: number;
  hostelNight: number;
  tags: string[];
}

/** Someone driving to an event or city with open seats. */
export interface Ride {
  id: ID;
  driverId: ID;
  eventId?: ID;
  fromCity: ID;
  toCity: ID;
  departAt: string; // ISO
  returnAt: string; // ISO
  seatsOpen: number;
  riderIds: ID[];
  note?: string;
  /** What the driver asks per rider, round trip, in their own words/number. Code uses this over the gas formula. */
  costShareUsd?: number;
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
  /** City id the post/photos are from, when away from home. */
  city?: string;
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
  city?: string;
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
  city?: string;
  audience?: "public" | "friends";
}

export interface Message {
  id: ID;
  senderId: ID;
  text: string;
  createdAt: string;
  reactions?: Record<ID, string>;
  attachment?: { type: "image" | "listing" | "event" | "trip" | "opendoor"; ref: string };
  readBy?: ID[];
  /** Drafts written by the travel agent sit here until the sender approves them. Only the sender sees drafts. */
  status?: "draft" | "sent";
  draftReason?: string;
  /** Context card written by code when an Open Door match is revealed; rendered as a system line, not a bubble. */
  system?: boolean;
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
  | "mention"
  | "travel";

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
  cities: City[];
  rides: Ride[];
}

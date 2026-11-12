// Hang Again domain types. Shared by seed data, the server pipeline and the UI.
// Everything here is a prototype over seeded mock data: no real Facebook APIs, no real chats.

export type ID = string;

export interface Person {
  id: ID;
  name: string;
  avatarPhoto: string;
  city?: string;
}

export interface Friend extends Person {
  isCloseCircle: boolean;
  isBlocked: boolean;
  isResting: boolean;
  /** False once unfriended. Guardrails drop anyone who isn't a friend. */
  isFriend: boolean;
  /** Canned replies the friend "sends" when a demo trigger fires. Never model-written. */
  replies: string[];
}

// ---------- seed items (every one has an id the model can cite) ----------

export interface Photo {
  id: ID;
  date: string; // YYYY-MM-DD
  place: string;
  caption?: string;
  /** Everyone in the photo, including "me" when the user is in it. */
  taggedFriendIds: ID[];
  imagePath: string;
}

export interface FeedPost {
  id: ID;
  friendId: ID;
  date: string;
  text: string;
  place?: string;
  imagePath?: string;
  taggedFriendIds?: ID[];
  /** "life_update" marks posts like moves, new jobs, graduations. */
  kind?: "post" | "life_update";
}

export interface ReelItem {
  id: ID;
  friendId: ID;
  date: string;
  caption: string;
  topicTags: string[];
  imagePath?: string;
}

export interface Gathering {
  id: ID;
  kind: "event" | "group_meetup";
  name: string;
  groupName?: string;
  date: string;
  place: string;
  attendeeIds: ID[];
}

export interface ChatSnippet {
  id: ID;
  friendId: ID; // the 1:1 thread this belongs to
  date: string; // ISO datetime
  sender: ID; // "me" or the friend id
  text: string;
  /** Runtime only: a shared photo attached from a nudge. */
  photoId?: ID;
}

/** Likes and reactions. Kept in the seed to prove they never count as contact. */
export interface Reaction {
  id: ID;
  friendId: ID;
  date: string;
  by: ID;
  emoji: string;
  target: string;
}

export interface CalendarSlot {
  id: string; // e.g. "sun_pm"
  label: string; // "Sun 1–5pm"
  start: string; // ISO datetime
}

export interface Calendar {
  personId: ID;
  free: string[]; // slot ids
}

export interface Place {
  name: string;
  costPerPerson: number;
  kind: string; // "ramen", "park", "coffee"…
}

// ---------- AI outputs ----------

export interface SharedPlace {
  name: string;
  count: number;
  firstDate: string;
  lastDate: string;
  photoIds: ID[];
}
export interface InsideJoke {
  phrase: string;
  sourceIds: ID[];
}
export type TimelineType = "two_way_chat" | "one_way" | "meetup";
export interface TimelineEvent {
  date: string; // YYYY-MM-DD
  type: TimelineType;
  sourceIds: ID[];
}

export interface CritterDesign {
  body: string;
  color: string;
  accessory: string;
  keepsakes: string[];
  /** One short line on why Muse picked these parts. */
  why?: string;
  /** Muse's plush-animal version of this friendship, drawn by Muse Image. */
  art?: CritterArtDesign;
}

export interface CritterArtDesign {
  animal: string;
  color: string;
  detail: string;
  caption: string;
}

export interface MemoryFile {
  friendId: ID;
  sharedPlaces: SharedPlace[];
  insideJokes: InsideJoke[];
  timeline: TimelineEvent[];
  rhythmDays: number;
  critter: CritterDesign;
}

export type NudgeType = "place" | "joke" | "life_update" | "drift";
export type NudgeAction = "send_photo" | "say_hi" | "suggest_plan";
export type NudgeStatus = "shown" | "sent" | "dismissed" | "rested";

export interface Nudge {
  id: ID;
  friendId: ID;
  type: NudgeType;
  reason: string;
  evidenceIds: ID[];
  action: NudgeAction;
  photoId?: ID;
  /** The new post / Reel / update that triggered it. */
  triggerId: ID;
  createdAt: string; // demo date, YYYY-MM-DD
  status: NudgeStatus;
  bannerSeen?: boolean;
}

export interface Plan {
  friendId: ID;
  place: string;
  slotId: string;
  dayTime: string;
  estCostPerPerson: number;
  reason: string;
  confirmedBy: ID[];
  /** Muse's suggestion stays a private draft until the user shares it in the chat. */
  sharedOn?: string;
  metUpOn?: string;
  keepsake?: string;
}

export type CritterState = "awake" | "sleepy" | "napping" | "celebrating" | "resting" | "egg" | "hatching";

/** A new post, Reel or life update from a friend, plus what the eval expects to happen. */
export interface Scenario {
  id: string;
  label: string;
  friendId: ID;
  trigger: { kind: "post" | "reel" | "life_update"; item: FeedPost | ReelItem };
  expect: { outcome: "nudge"; type: NudgeType; mustCite?: string[] } | { outcome: "no_nudge" } | { outcome: "filtered"; reason: string };
}

// The shapes the API returns and the UI renders. Shared contract between server (play.ts, recommend.ts) and components.
// Privacy rule baked into these shapes: a viewer gets the chat's totals and their OWN affinity, never another member's.
// Chat topics carry no score: with few members, a chat-level number plus the viewer's own would give the others' away.
import type { ID } from "@/types";
import type { RoundResult } from "./results";
import type { Choice, Format, Round, UnlockTier } from "./store";
import type { TopicId } from "./taxonomy";

export interface MemberCard { id: ID; name: string; first: string; avatar: string }

export interface GameView {
  id: string;
  conversationId: ID;
  date: string;
  format: Format;
  formatLabel: string;
  topic: TopicId;
  topicLabel: string; // "🎸 live music"
  title: string;
  premise: string;
  /** `answer` is stripped from every round until the viewer has completed the game. */
  rounds: Round[];
  subject?: MemberCard;
  /** True when the viewer is the Hot Seat subject (they answer about themselves). */
  iAmSubject: boolean;
  members: MemberCard[];
  /** The viewer's own answers so far, by round id. */
  mine: Record<string, Choice>;
  done: boolean;
  /** Who has finished. */
  players: MemberCard[];
  memberCount: number;
  /** Only present once the viewer is done. */
  results?: RoundResult[];
  /** 0..1, how well the viewer read the room; only once done and comparable. */
  performance?: number | null;
  /** Cited source lines, shown on the "made from" screen; only once done (Receipts would leak otherwise). */
  madeFrom?: { id: string; kind: string; by?: string; text: string }[];
  /** live | cached | mock, as labelled everywhere else in the app. */
  mode: string;
  reacted?: string;
}

export interface ChatView {
  conversationId: ID;
  muted: boolean;
  score: number;
  parts: { participation: number; streak: number; reciprocity: number; confidence: number };
  streakDays: number;
  /** Snapchat-style streak details for the score bar. Chat totals only: the game card already shows who played. */
  streak: {
    days: number;
    today: { hasGame: boolean; finished: number; members: number; needed: number; lockedIn: boolean };
    /** Evening and today isn't locked in yet. */
    hourglass: boolean;
    /** 3 / 7 / 14 / 30 on the day it's reached. */
    milestone?: number;
    /** A freeze is holding the streak over a missed day. */
    freezeUsed: boolean;
  };
  games: number;
  /** Chat-level topics, best first (top 5): names and how many played games touched each. In a chat of two, only topics it has played, most played first. */
  topics: { topic: TopicId; label: string; games: number }[];
  /** The viewer's own top topics only. */
  myTopics: { topic: TopicId; label: string; score: number }[];
  /** The lowest tier this chat hasn't been given yet. `ready`: score and topic gate are met and no card came today, so it arrives on the next finished game or reaction. */
  next?: { tier: UnlockTier; at: number; ready?: boolean };
  thresholds: Record<UnlockTier, number>;
  unlocks: UnlockView[];
  todayGameId?: string;
}

export interface UnlockView {
  id: string;
  conversationId: ID;
  tier: UnlockTier;
  refId: string;
  href: string; // /events/<id> | /groups/<id> | /marketplace/<id>
  topic: TopicId;
  topicLabel: string;
  title: string;
  sub: string;
  image?: string;
  why: string;
  score: number;
  /** Members who said yes (cards), and the viewer's own response. */
  inMembers: MemberCard[];
  my?: "in" | "dismiss";
  mode: string;
}

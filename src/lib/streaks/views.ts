// What the Hangout (streaks) is sent. Types only, so client pages can import them.
import type { DesignLike } from "@/components/hangout/Critter";
import type { CritterState } from "@/lib/hangout/types";
import type { ID } from "@/types";

/** Today, for one friend: both played, one of you did, neither did with a streak running, a streak that ended, or never played. */
export type StreakStatus = "done" | "yourTurn" | "theirTurn" | "atRisk" | "lost" | "new";
/** One day in the strip: both finished its game, one did, nobody did, or there was no game that day. */
export type DayMark = "both" | "one" | "none" | "nogame";

export interface StreakCard {
  friendId: ID;
  name: string;
  first: string;
  avatar: string;
  /** The 1:1 chat; absent until one of you writes. */
  conversationId?: ID;
  /** Days in a row you both finished the daily game (Chat Games' streakDays). Today counts once you both have. */
  streak: number;
  status: StreakStatus;
  state: CritterState;
  design: DesignLike;
  animal: string;
}

export interface StreaksView {
  host: { image: string };
  /** Every critter friend, most urgent first: your turn, ending tonight, waiting on them, safe, never played, ended. */
  friends: StreakCard[];
  /** When today's game day ends (the streak cutoff). */
  endsAt: string;
}

export interface StreakDetail extends StreakCard {
  /** The last 14 days, oldest first; the last one is today. */
  days: { date: string; mark: DayMark }[];
  endsAt: string;
  /** Today's status for each of you. */
  today: { gameId?: string; me: boolean; them: boolean };
}

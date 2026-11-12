// Sleep math. Plain code, no AI.
//   timeline   two_way_chat / one_way / meetup events built from chats, gatherings and photos
//   rhythm     median gap between real contacts (two-way chats + meetups), clamped 7–120, default 30
//   state      days since last real contact / rhythm → awake (<1), sleepy (1–1.5), napping (>1.5)
// A two-way chat means both people sent at least one message within 48 hours.
// Likes and reactions never count.
import type { ChatSnippet, CritterState, Gathering, Photo, Reaction, TimelineEvent } from "./types";

const DAY = 86_400_000;
const WINDOW = 48 * 3_600_000;
export const RHYTHM_MIN = 7;
export const RHYTHM_MAX = 120;
export const RHYTHM_DEFAULT = 30;
export const CELEBRATE_DAYS = 3;

const dayOf = (iso: string) => iso.slice(0, 10);
const ms = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso.endsWith("Z") ? iso : `${iso}Z`).getTime();
export const daysBetween = (fromDay: string, toDay: string) => Math.round((ms(dayOf(toDay)) - ms(dayOf(fromDay))) / DAY);

/**
 * Group a 1:1 thread into exchanges: each cluster starts at a message and takes everything sent in the
 * next 48 hours. Both people in the cluster → two_way_chat, otherwise one_way.
 */
export function chatEvents(snippets: ChatSnippet[], meId = "me"): TimelineEvent[] {
  const sorted = [...snippets].sort((a, b) => ms(a.date) - ms(b.date));
  const out: TimelineEvent[] = [];
  let i = 0;
  while (i < sorted.length) {
    const start = ms(sorted[i].date);
    const cluster: ChatSnippet[] = [];
    while (i < sorted.length && ms(sorted[i].date) - start <= WINDOW) cluster.push(sorted[i++]);
    const twoWay = cluster.some((c) => c.sender === meId) && cluster.some((c) => c.sender !== meId);
    out.push({ date: dayOf(cluster.at(-1)!.date), type: twoWay ? "two_way_chat" : "one_way", sourceIds: cluster.map((c) => c.id) });
  }
  return out;
}

/** Meetups: gatherings both attended, plus photos both are tagged in. One event per day. */
export function meetupEvents(friendId: string, gatherings: Gathering[], photos: Photo[], meId = "me"): TimelineEvent[] {
  const byDay = new Map<string, string[]>();
  const add = (date: string, id: string) => byDay.set(date, [...(byDay.get(date) ?? []), id]);
  for (const g of gatherings) if (g.attendeeIds.includes(meId) && g.attendeeIds.includes(friendId)) add(g.date, g.id);
  for (const p of photos) if (p.taggedFriendIds.includes(meId) && p.taggedFriendIds.includes(friendId)) add(p.date, p.id);
  return [...byDay].map(([date, sourceIds]) => ({ date, type: "meetup" as const, sourceIds }));
}

export interface TimelineInput {
  friendId: string;
  chats: ChatSnippet[];
  gatherings: Gathering[];
  photos: Photo[];
  /** Accepted so callers can pass everything they have; deliberately ignored. */
  reactions?: Reaction[];
  meId?: string;
}

export function buildTimeline({ friendId, chats, gatherings, photos, meId = "me" }: TimelineInput): TimelineEvent[] {
  const thread = chats.filter((c) => c.friendId === friendId);
  return [...chatEvents(thread, meId), ...meetupEvents(friendId, gatherings, photos, meId)].sort((a, b) => a.date.localeCompare(b.date));
}

const isReal = (e: TimelineEvent) => e.type === "two_way_chat" || e.type === "meetup";

export function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Median gap in days between real contacts (unique days), clamped 7–120. Default 30 with fewer than 3 events. */
export function rhythmDays(timeline: TimelineEvent[], today?: string): number {
  const days = [...new Set(timeline.filter((e) => isReal(e) && (!today || e.date <= today)).map((e) => e.date))].sort();
  if (days.length < 3) return RHYTHM_DEFAULT;
  const gaps = days.slice(1).map((d, i) => daysBetween(days[i], d));
  return Math.round(Math.min(RHYTHM_MAX, Math.max(RHYTHM_MIN, median(gaps))));
}

export interface SleepResult {
  state: CritterState;
  ratio: number | null;
  rhythmDays: number;
  daysSince: number | null;
  lastRealContact: TimelineEvent | null;
  lastTwoWayChat: TimelineEvent | null;
}

/** Thresholds: under 1 awake, 1 to 1.5 sleepy, over 1.5 napping. */
export function stateForRatio(ratio: number): "awake" | "sleepy" | "napping" {
  if (ratio < 1) return "awake";
  if (ratio <= 1.5) return "sleepy";
  return "napping";
}

export function sleepState(timeline: TimelineEvent[], today: string, opts: { isResting?: boolean } = {}): SleepResult {
  const past = timeline.filter((e) => e.date <= today);
  const rhythm = rhythmDays(past);
  const real = past.filter(isReal);
  const lastRealContact = real.at(-1) ?? null;
  const lastTwoWayChat = past.filter((e) => e.type === "two_way_chat").at(-1) ?? null;
  const lastMeetup = past.filter((e) => e.type === "meetup").at(-1) ?? null;
  const daysSince = lastRealContact ? daysBetween(lastRealContact.date, today) : null;
  const ratio = daysSince === null ? null : daysSince / rhythm;
  const base = { ratio, rhythmDays: rhythm, daysSince, lastRealContact, lastTwoWayChat };

  // Resting = in the hammock. It never changes state.
  if (opts.isResting) return { ...base, state: "resting" };
  if (lastMeetup && daysBetween(lastMeetup.date, today) < CELEBRATE_DAYS) return { ...base, state: "celebrating" };
  if (ratio === null) return { ...base, state: "napping" };
  return { ...base, state: stateForRatio(ratio) };
}

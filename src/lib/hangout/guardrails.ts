// Guardrail filter. Plain code, no AI.
// Runs twice: before the why-now model call (so blocked/resting people's data never reaches the model)
// and after it (status again, one nudge per day, no mood or health words).
import type { Friend, Nudge } from "./types";

export type GuardReason = "blocked" | "unfriended" | "resting" | "not_close_circle" | "daily_cap" | "mood_health_words";
export type GuardResult = { ok: true } | { ok: false; reason: GuardReason; detail?: string };

export const MAX_NUDGES_PER_DAY = 1;

/** Words that guess at someone's mood or health. A reason containing any of these is dropped. */
export const MOOD_HEALTH_WORDS = [
  "sad", "sadness", "lonely", "loneliness", "alone", "depressed", "depression", "struggling", "struggle", "sick", "ill", "illness",
  "anxious", "anxiety", "stressed", "stress", "upset", "hurting", "hurt", "grieving", "grief", "heartbroken", "breakup", "crying",
  "unwell", "hospital", "therapy", "burnout", "burned out", "burnt out", "mental health", "isolated", "down bad", "rough time", "going through",
];
const MOOD_RE = new RegExp(`\\b(${MOOD_HEALTH_WORDS.map((w) => w.replace(/ /g, "\\s+")).join("|")})\\b`, "i");

export function findMoodHealthWord(text: string): string | null {
  return text.match(MOOD_RE)?.[1]?.toLowerCase() ?? null;
}

/** Who may be nudged at all. */
export function statusGuard(friend: Friend | undefined): GuardResult {
  if (!friend || friend.isBlocked) return { ok: false, reason: "blocked" };
  if (!friend.isFriend) return { ok: false, reason: "unfriended" };
  if (friend.isResting) return { ok: false, reason: "resting" };
  if (!friend.isCloseCircle) return { ok: false, reason: "not_close_circle" };
  return { ok: true };
}

/** Full check on a model-proposed nudge. `nudges` is every nudge so far; `today` is the demo date. */
export function nudgeGuard(friend: Friend | undefined, candidate: { reason: string }, nudges: Pick<Nudge, "createdAt">[], today: string): GuardResult {
  const status = statusGuard(friend);
  if (!status.ok) return status;
  const todayCount = nudges.filter((n) => n.createdAt === today).length;
  if (todayCount >= MAX_NUDGES_PER_DAY) return { ok: false, reason: "daily_cap", detail: `${todayCount} nudge already shown on ${today}` };
  const word = findMoodHealthWord(candidate.reason);
  if (word) return { ok: false, reason: "mood_health_words", detail: `"${word}"` };
  return { ok: true };
}

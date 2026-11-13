// One "today" for Chat Games, on the server and in the UI alike: the calendar day in the chats' home city.
// The daily drop, the streak, "one unlock a day" and the Wager wait all roll over at local midnight together.
// Pure (no store, no db) so client components can import it.

/** The chats' home city. Every seeded chat is in Austin; a per-chat zone can come from the members' city later. */
export const PLAY_TZ = "America/Chicago";

const dateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: PLAY_TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const hourFmt = new Intl.DateTimeFormat("en-US", { timeZone: PLAY_TZ, hour: "numeric", hourCycle: "h23" });

/** YYYY-MM-DD in PLAY_TZ. A YYYY-MM-DD string is already a day and passes through; a full timestamp is converted. */
export const dayKey = (d: Date | string | number = new Date()) =>
  typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : dateFmt.format(typeof d === "object" ? d : new Date(d));

/** The calendar day before `key` (string arithmetic at UTC noon, so daylight-saving changes can't skip or repeat a day). */
export function prevDay(key: string) {
  const t = new Date(`${key}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() - 1);
  return t.toISOString().slice(0, 10);
}

/** The hour (0–23) in PLAY_TZ. */
export const localHour = (d: Date | number = new Date()) => Number(hourFmt.format(typeof d === "number" ? new Date(d) : d));

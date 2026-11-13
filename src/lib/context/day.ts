// Local calendar day helpers (Austin `America/Chicago`) so streaks, freezes, and evening hourglass roll over at local midnight.
export const PLAY_TZ = "America/Chicago";

const dateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: PLAY_TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const hourFmt = new Intl.DateTimeFormat("en-US", { timeZone: PLAY_TZ, hour: "numeric", hourCycle: "h23" });

export const dayKey = (d: Date | string | number = new Date()) =>
  typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : dateFmt.format(typeof d === "object" ? d : new Date(d));

export function prevDay(key: string) {
  const t = new Date(`${key}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() - 1);
  return t.toISOString().slice(0, 10);
}

export const localHour = (d: Date | number = new Date()) => Number(hourFmt.format(typeof d === "number" ? new Date(d) : d));

/** First epoch ms of `now`'s calendar day in `PLAY_TZ` (DST-safe). */
export function dayStartMs(now = Date.now()): number {
  const today = dayKey(now);
  let t = Math.floor(now / 1e3) * 1e3;
  for (const step of [3600e3, 60e3, 1e3]) while (dayKey(t - step) === today) t -= step;
  return t;
}

/** ISO timestamp when `now`'s calendar day ends (local midnight in `PLAY_TZ`). */
export function dayEndsAt(now = Date.now()): string {
  const today = dayKey(now);
  let t = Math.floor(now / 1e3) * 1e3;
  for (const step of [3600e3, 60e3, 1e3]) while (dayKey(t + step) === today) t += step;
  return new Date(t + 1e3).toISOString();
}

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

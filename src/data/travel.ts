// Shared helpers for the travel seed: upcoming weekends (relative to boot, so the data is always "coming up"),
// media lookups for the licensed city photos, and the merge of the wider network into the user list.
import type { User } from "@/types";
import { proxied } from "@/lib/img";
import mediaJson from "./media.json";
import mediaIndexJson from "./mediaIndex.json";

export interface MediaItem {
  id: string;
  city: string;
  query: string;
  title: string;
  pageUrl: string;
  url: string;
  width: number;
  height: number;
  author: string;
  license: string;
  description: string;
}
export interface MediaNote {
  description: string;
  tags: string[];
  activities: string[];
  food: string[];
  vibe: string[];
  setting: string;
  timeOfDay: string;
  goodFor: string[];
  model: string;
  indexedAt: string;
  costUsd: number;
  mode: string;
}

export const media = mediaJson as Record<string, MediaItem>;
export const mediaIndex = mediaIndexJson as Record<string, MediaNote>;

/** The app URL (through the caching proxy) for a seeded photo id such as "nash-broadway". */
export function mediaUrl(id: string) {
  const m = media[id];
  if (!m) throw new Error(`unknown media id ${id}`);
  return proxied(m.url);
}
/** Reverse lookup: which seeded photo is this URL? */
export function mediaIdForUrl(url: string) {
  const raw = url.startsWith("/api/img?u=") ? decodeURIComponent(url.slice("/api/img?u=".length)) : url;
  return Object.values(media).find((m) => m.url === raw)?.id;
}

// ---------- weekends ----------
const DAY = 86_400_000;
const BOOT = new Date();
/** Friday of the nth upcoming weekend (n = 1 is the first Friday at least 3 days out). */
export function weekendFriday(n: number): Date {
  const d = new Date(BOOT);
  d.setHours(0, 0, 0, 0);
  // move to the next Friday that is >= 3 days away
  const daysToFri = (5 - d.getDay() + 7) % 7;
  d.setTime(d.getTime() + (daysToFri < 3 ? daysToFri + 7 : daysToFri) * DAY);
  d.setTime(d.getTime() + (n - 1) * 7 * DAY);
  return d;
}
/** ISO timestamp on weekend n: dayOffset 0 = Fri, 1 = Sat, 2 = Sun; hour local. */
export function wk(n: number, dayOffset: number, hour: number, minute = 0) {
  const d = weekendFriday(n);
  d.setTime(d.getTime() + dayOffset * DAY);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** YYYY-MM-DD for Fri/Sat/Sun of weekend n. */
export function weekendDates(n: number): string[] {
  const f = weekendFriday(n);
  return [0, 1, 2].map((o) => ymd(new Date(f.getTime() + o * DAY)));
}
/** Short label like "Dec 4–6". */
export function weekendLabel(n: number) {
  const f = weekendFriday(n);
  const s = new Date(f.getTime() + 2 * DAY);
  const mo = (d: Date) => d.toLocaleString("en-US", { month: "short" });
  return mo(f) === mo(s) ? `${mo(f)} ${f.getDate()}–${s.getDate()}` : `${mo(f)} ${f.getDate()}–${mo(s)} ${s.getDate()}`;
}

/** Resolve "w3"-style busy markers into concrete dates. */
export function resolveBusy(u: User & { busy?: string[] }): User {
  const { busy, ...rest } = u;
  const dates = (busy ?? []).flatMap((b) => {
    const m = b.match(/^w(\d+)$/);
    return m ? weekendDates(Number(m[1])) : [b];
  });
  return { ...rest, busyDates: dates.length ? dates : rest.busyDates };
}

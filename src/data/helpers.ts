// Seed helpers. All timestamps are relative to boot so the data always looks fresh.

const NOW = Date.now();
const H = 3600_000;
const D = 24 * H;

export const hoursAgo = (h: number) => new Date(NOW - h * H).toISOString();
export const daysAgo = (d: number, hourOfDay = 12) => {
  const t = new Date(NOW - d * D);
  t.setHours(hourOfDay, Math.floor((d * 37) % 60), 0, 0);
  return t.toISOString();
};
export const inDays = (d: number, hourOfDay = 19) => {
  const t = new Date(NOW + d * D);
  t.setHours(hourOfDay, 0, 0, 0);
  return t.toISOString();
};
export const addHours = (iso: string, h: number) => new Date(new Date(iso).getTime() + h * H).toISOString();

import { faceUrl, photoUrl } from "@/lib/img";
/** Deterministic placeholder photo (served through the caching proxy). */
export const photo = photoUrl;
/** Deterministic avatar (real-looking portrait, served through the caching proxy). */
export const face = faceUrl;

let counter = 0;
export const uid = (prefix: string) => `${prefix}_${(++counter).toString(36).padStart(4, "0")}`;

export const r = <T>(arr: T[], i: number) => arr[i % arr.length];

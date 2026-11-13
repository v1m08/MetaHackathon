export function timeAgo(iso: string, short = true): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "Just now";
  const m = Math.floor(s / 60);
  if (m < 60) return short ? `${m}m` : `${m} minute${m > 1 ? "s" : ""} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return short ? `${h}h` : `${h} hour${h > 1 ? "s" : ""} ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return short ? `${d}d` : `${d} day${d > 1 ? "s" : ""} ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return short ? `${w}w` : `${w} week${w > 1 ? "s" : ""} ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
export const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K` : String(n));
export const money = (n: number) => (n === 0 ? "Free" : `$${Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
export function eventDate(iso: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day} at ${time}`;
}
export function eventDay(iso: string) {
  const d = new Date(iso);
  return { mon: d.toLocaleDateString(undefined, { month: "short" }).toUpperCase(), day: d.getDate() };
}
export function messageTime(iso: string) {
  const d = new Date(iso);
  const sameDay = new Date().toDateString() === d.toDateString();
  return sameDay ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
}
export const firstName = (name: string) => name.split(" ")[0];

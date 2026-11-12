// Date labels for seed dates (YYYY-MM-DD or ISO without zone). Parsed as UTC so they never shift a day.
const parse = (d: string) => new Date(d.length === 10 ? `${d}T12:00:00Z` : `${d.slice(0, 19)}Z`);

export function prettyDate(d: string, short = false) {
  return parse(d).toLocaleDateString("en-US", short ? { month: "short", year: "numeric", timeZone: "UTC" } : { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
export function monthYear(d: string) {
  return parse(d).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}
/** "today", "yesterday", "3 days ago", "8 months ago". Relative to the demo date, not the real clock. */
export function ago(days: number | null) {
  if (days === null) return "never";
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  if (days < 365) return `${Math.round(days / 30)} months ago`;
  const y = Math.round(days / 365);
  return `${y} year${y > 1 ? "s" : ""} ago`;
}
/** "every ~4 weeks" from a rhythm in days. */
export function rhythm(days: number) {
  if (days < 12) return `about every ${days} days`;
  if (days < 60) return `about every ${Math.round(days / 7)} weeks`;
  return `about every ${Math.round(days / 30)} months`;
}
export function timeOfDay(iso: string) {
  return parse(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
}

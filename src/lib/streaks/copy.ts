// Words for the Hangout (streaks), written by code from the view (no model). Pure, so pages and tests share it.
import type { StreakCard, StreakStatus, StreaksView } from "./views";

export const STATUS: Record<StreakStatus, { label: string; chip: string }> = {
  done: { label: "Played today", chip: "bg-[#e3f6e8] text-[#1e7b3b]" },
  yourTurn: { label: "Your turn", chip: "bg-[#e7f3ff] text-messenger" },
  theirTurn: { label: "Waiting", chip: "bg-[#f0f2f5] text-ink-2" },
  atRisk: { label: "Ends tonight", chip: "bg-[#fff1d6] text-[#a35a00]" },
  lost: { label: "Streak ended", chip: "bg-[#eceff3] text-[#5d6673]" },
  new: { label: "No streak yet", chip: "bg-[#fdf3dc] text-[#8a6a2b]" },
};

/** "6pm", "5:30pm": when the streak cutoff lands in the viewer's own time zone. */
export function endsLabel(iso: string) {
  const d = new Date(iso);
  const h = d.getHours() % 12 || 12, m = d.getMinutes();
  return `${h}${m ? `:${String(m).padStart(2, "0")}` : ""}${d.getHours() < 12 ? "am" : "pm"}`;
}
/** "3h 12m", "45m": how long until the cutoff. */
export function timeLeft(iso: string, now = Date.now()) {
  const mins = Math.max(0, Math.round((new Date(iso).getTime() - now) / 60e3));
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
}

const list = (names: string[]) => (names.length <= 2 ? names.join(" and ") : `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`);

export function statusLine(c: StreakCard, ends: string) {
  switch (c.status) {
    case "done": return c.streak === 1 ? "You both played today. A new streak hatched!" : "You both played today";
    case "yourTurn": return `${c.first} played today. Your turn`;
    case "theirTurn": return `You played. Waiting on ${c.first}`;
    case "atRisk": return `Play today's game before ${ends}`;
    case "lost": return "Streak ended. Play today to start again";
    default: return "Play a game together to hatch a streak";
  }
}

/** The streaks page's list, top to bottom. Empty sections are left out. */
export const SECTIONS: { title: string; statuses: StreakStatus[] }[] = [
  { title: "Needs you today", statuses: ["yourTurn", "atRisk"] },
  { title: "Waiting on them", statuses: ["theirTurn"] },
  { title: "Safe today", statuses: ["done"] },
  { title: "Hatch a streak", statuses: ["new"] },
  { title: "Ended", statuses: ["lost"] },
];
/** Friends whose streak needs the viewer to play today. */
export const needsYou = (friends: StreakCard[]) => friends.filter((c) => c.status === "yourTurn" || c.status === "atRisk");

/** The host's speech bubble: at most two sentences, the most useful thing first. */
export function hostLine(v: StreaksView, ends: string) {
  const by = (s: StreakStatus) => v.friends.filter((c) => c.status === s).map((c) => c.first);
  const your = by("yourTurn"), risk = by("atRisk"), theirs = by("theirTurn"), done = by("done"), eggs = by("new");
  const live = v.friends.filter((c) => ["yourTurn", "atRisk", "theirTurn", "done"].includes(c.status));
  const top = [...live].sort((a, b) => b.streak - a.streak)[0];
  const first = your.length ? `${list(your)} already played today. Your turn!`
    : top && top.streak >= 7 ? `${top.first}'s at ${top.streak} days!`
    : done.length ? `You and ${list(done)} played today.`
    : eggs.length ? `${list(eggs)}'s egg is waiting.`
    : "Welcome back.";
  const second = risk.length ? `${risk.length === 1 ? `${risk[0]}'s streak ends` : `${risk.length} streaks end`} at ${ends} unless you play.`
    : theirs.length ? `Waiting on ${list(theirs)}.`
    : live.length && done.length === live.length ? "Every streak is safe today."
    : eggs.length ? "Play a game together to hatch one."
    : "";
  return `${first} ${second}`.trim();
}

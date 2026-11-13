// Rarity trivia ("name a ___, rarer answers score more"), shared by server and client.

export const PROMPTS_PER_GAME = 7;
export const SECONDS_PER_PROMPT = 25;
export const TIER_POINTS = [10, 20, 35, 50, 75, 100] as const; // tier 1 (everyone says it) .. 6 (almost nobody)
export const ONLY_YOU_BONUS = 25; // valid answer nobody else in the room gave

export const FONTS = ["Rubik", "Bricolage Grotesque", "Fraunces", "Space Grotesk", "Saira Condensed", "Baloo 2", "DM Serif Display", "Archivo Black"] as const;
export type Font = (typeof FONTS)[number];

export interface Answer {
  a: string; // canonical display form
  alias?: string[];
  r: number; // rarity tier 1..6
  note?: string; // short fun fact shown on reveal
}
export interface Prompt {
  q: string; // "Name a famous climbing route"
  hint?: string; // what counts
  answers: Answer[];
}
export interface World {
  interest: string;
  title: string;
  tagline: string;
  host: { name: string; emoji: string; intro: string };
  /** Progress metaphor: total points * perPoint, shown as e.g. "4,350 m of altitude". */
  meter: { label: string; unit: string; perPoint: number; up: boolean; icon: string };
  /** Six tier names, most common to rarest, in the interest's language. */
  tiers: [string, string, string, string, string, string];
  palette: { bg: string; bg2: string; card: string; primary: string; accent: string; text: string };
  font: Font;
}
export interface Pack extends World {
  prompts: Prompt[];
}
/** What the client gets: no answer lists. */
export type PublicPack = World & { prompts: { q: string; hint?: string }[] };

export const publicPack = (p: Pack): PublicPack => ({ ...p, prompts: p.prompts.map(({ q, hint }) => ({ q, hint })) });

/** Result of one submitted answer, from the server. */
export interface Verdict {
  ok: boolean;
  /** Why it was rejected (when !ok). */
  reason?: string;
  answer?: string; // canonical
  tier?: number; // 1..6
  points?: number;
  note?: string;
  /** Rarest answer on the list for this prompt, revealed after you answer. */
  gem?: { a: string; note?: string };
  /** Friends who gave the same answer so far. */
  same?: string[];
  /** True once the prompt is locked for you (valid answer or timed out). */
  locked: boolean;
}

// ---------- matching ----------

export function norm(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(the|a|an)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function lev(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** Find the listed answer a guess refers to: exact/alias match, then small typos, then plural/singular. */
export function matchAnswer(guess: string, answers: Answer[]): Answer | null {
  const g = norm(guess);
  if (!g) return null;
  const keys = answers.map((ans) => ({ ans, keys: [ans.a, ...(ans.alias ?? [])].map(norm).filter(Boolean) }));
  for (const k of keys) if (k.keys.includes(g)) return k.ans;
  const strip = (s: string) => s.replace(/(es|s)$/, "");
  for (const k of keys) if (k.keys.some((x) => strip(x) === strip(g))) return k.ans;
  const tol = g.length <= 4 ? 0 : g.length <= 8 ? 1 : 2;
  if (tol) {
    let best: { ans: Answer; d: number } | null = null;
    for (const k of keys)
      for (const x of k.keys) {
        const d = lev(g, x, tol);
        if (d <= tol && (!best || d < best.d)) best = { ans: k.ans, d };
      }
    if (best) return best.ans;
  }
  return null;
}

export const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

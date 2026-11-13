// Rarity trivia ("name a ___, rarer answers score more"), shared by server and client.

export const PROMPTS_PER_GAME = 4;
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
/** Pixel-art world the player travels through as they score. */
export const SCENES = ["cliff", "track", "ocean", "space", "tower", "dig", "trail", "kitchen"] as const;
export type SceneKind = (typeof SCENES)[number];
export interface Scene {
  kind: SceneKind;
  /** Sky (or water) gradient at the start and at the far end of the journey. */
  start: [string, string];
  end: [string, string];
  /** Main material color (rock, asphalt, soil, building, counter). */
  ground: string;
  /** 3-6 emoji drawn as pixel props along the way. */
  props: string[];
  /** Generated backdrop image (server path like /bg/chess.png). When present it replaces the drawn world. */
  bg?: string;
}

export interface World {
  interest: string;
  scene: Scene;
  /** The player's marker in the scene. */
  avatar: string;
  /** Submit button word, in the interest's language ("Send", "Push", "Bake"). */
  verb: string;
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

export const publicPack = (p: Pack): PublicPack => ({ ...withScene(p), prompts: p.prompts.map(({ q, hint }) => ({ q, hint })) });

// ---------- scene defaults (also used for packs made before scenes existed) ----------
export const SCENE_DEFAULTS: Record<SceneKind, Omit<Scene, "kind"> & { avatar: string; verb: string }> = {
  cliff: { start: ["#7cc4f2", "#d8eefb"], end: ["#16224a", "#3b4f8a"], ground: "#8a7a6a", props: ["🪢", "🦅", "☁️", "🪨"], avatar: "🧗", verb: "Send" },
  track: { start: ["#6fb6e8", "#cfe9f7"], end: ["#ff9a5a", "#ffd39a"], ground: "#3a3d46", props: ["🏁", "🛞", "🚧", "🏆"], avatar: "🏎️", verb: "Push" },
  ocean: { start: ["#4fb6e6", "#2a7fb8"], end: ["#06142a", "#0b2546"], ground: "#c9b48a", props: ["🐠", "🐙", "🪸", "🐚"], avatar: "🤿", verb: "Drop" },
  space: { start: ["#78b8f0", "#cfe6fa"], end: ["#05060f", "#151a3a"], ground: "#5b5f6e", props: ["🛰️", "🪐", "☄️", "⭐"], avatar: "🚀", verb: "Launch" },
  tower: { start: ["#8fc9f5", "#f3d6e9"], end: ["#24123d", "#5b2a7a"], ground: "#5a5f7a", props: ["🎤", "🎸", "💡", "⭐"], avatar: "🕺", verb: "Go" },
  dig: { start: ["#86c56a", "#c9e7a8"], end: ["#1a0f0a", "#3a2416"], ground: "#8a5a3a", props: ["🦴", "🏺", "💎", "🪙"], avatar: "⛏️", verb: "Dig" },
  trail: { start: ["#8fd0f0", "#e3f4fb"], end: ["#f6a35b", "#ffd9a0"], ground: "#4f8a3a", props: ["🌲", "🌼", "🦋", "🍄"], avatar: "🥾", verb: "Go" },
  kitchen: { start: ["#ffe9c9", "#fff6ea"], end: ["#ffb98a", "#ffd9b8"], ground: "#c98a5a", props: ["🥖", "🧈", "🥚", "☕"], avatar: "🧑‍🍳", verb: "Serve" },
};
const SCENE_HINTS: [RegExp, SceneKind][] = [
  [/climb|boulder|mountain|alpin|summit|everest/i, "cliff"],
  [/f1|formula|racing|race|nascar|motor|kart|cycl|bike|marathon|running|track/i, "track"],
  [/ocean|sea|dive|diving|scuba|fish|sail|surf|shark|whale|marine|boat/i, "ocean"],
  [/space|nasa|astro|planet|star wars|star trek|rocket|sci-?fi|galax/i, "space"],
  [/dino|fossil|ancient|rome|egypt|history|archae|geolog|mining|crime|medieval|viking/i, "dig"],
  [/bake|baking|bread|sourdough|cook|chef|coffee|tea|food|pizza|sushi|wine|beer|cocktail|cake/i, "kitchen"],
  [/garden|plant|hike|camp|forest|bird|dog|cat|pet|golf|soccer|football|nature|horse/i, "trail"],
];
export function guessScene(interest: string): SceneKind {
  for (const [re, k] of SCENE_HINTS) if (re.test(interest)) return k;
  return "tower";
}
const isHex = (v: unknown) => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
export function withScene<T extends Omit<World, "scene" | "avatar" | "verb"> & Partial<Pick<World, "scene" | "avatar" | "verb">>>(w: T): T & Pick<World, "scene" | "avatar" | "verb"> {
  const raw = (w.scene ?? {}) as Partial<Scene>;
  const kind: SceneKind = (SCENES as readonly string[]).includes(raw.kind as string) ? (raw.kind as SceneKind) : guessScene(w.interest);
  const d = SCENE_DEFAULTS[kind];
  const pair = (v: unknown, def: [string, string]): [string, string] => (Array.isArray(v) && isHex(v[0]) && isHex(v[1]) ? [v[0], v[1]] : def);
  const props = Array.isArray(raw.props) ? raw.props.filter((e) => typeof e === "string" && e.length <= 8).slice(0, 6) : [];
  return {
    ...w,
    scene: { kind, start: pair(raw.start, d.start), end: pair(raw.end, d.end), ground: isHex(raw.ground) ? raw.ground! : d.ground, props: props.length >= 2 ? props : d.props, ...(typeof raw.bg === "string" && /^\/bg\/[a-z0-9-]+\.png$/.test(raw.bg) ? { bg: raw.bg } : {}) },
    avatar: typeof w.avatar === "string" && w.avatar.length <= 10 && w.avatar ? w.avatar : d.avatar,
    verb: typeof w.verb === "string" && w.verb.trim() ? w.verb.trim().slice(0, 10) : d.verb,
  };
}

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

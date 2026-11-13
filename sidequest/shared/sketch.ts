// Sketch Off: draw a word from the topic in pixels, friends (and the AI) guess it.
import { rng } from "./kitchen";

export const GRID = 96; // drawing is a 96x96 pixel canvas
export const DRAW_SECONDS = 30;
export const GUESS_SECONDS = 25;
export const MAX_GUESS_ROUNDS = 3; // drawings you guess per visit
export const INK = ["#1d1d26", "#e8492f", "#ff9f1c", "#ffd23f", "#2fa36b", "#2f6fd1", "#8e44ad", "#8a5a3a", "#ffffff"]; // last = eraser
export const BRUSH = [2, 5];

export interface Word {
  w: string;
  tier: 1 | 2 | 3; // 1 easy … 3 hard
  alias?: string[];
}
export interface SketchPack {
  interest: string;
  title: string;
  tagline: string;
  host: { name: string; emoji: string; line: string };
  palette: { wall: string; wall2: string; primary: string; accent: string };
  words: Word[];
}
/** One stroke: ink index, brush index, then flattened grid points [x0,y0,x1,y1,…]. */
export type Stroke = [number, number, number[]];

export const guessPoints = (secondsLeft: number) => 60 + Math.round((Math.max(0, secondsLeft) / GUESS_SECONDS) * 90);
export const ARTIST_PER_GUESS = 40;
export const ARTIST_AI_BONUS = 50;

/** The word a player draws: players take words in join order from a seeded shuffle, easy first. */
export function wordOrder(pack: SketchPack, seed: number): number[] {
  const r = rng(seed);
  const idx = pack.words.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.sort((a, b) => pack.words[a].tier - pack.words[b].tier);
}

// ---------- validation ----------
const str = (v: unknown, max: number, d = "") => (typeof v === "string" && v.trim() ? v.trim().replace(/\s+/g, " ").slice(0, max) : d);
const hex = (v: unknown, d: string) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : d);
export function sanitizeSketch(raw: unknown, interest: string): SketchPack | null {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const seen = new Set<string>();
  const words: Word[] = [];
  for (const x of Array.isArray(o.words) ? o.words : []) {
    const r = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    const w = str(r.w, 24).toLowerCase();
    if (!w || seen.has(w) || w.split(" ").length > 3) continue;
    seen.add(w);
    const tier = Math.min(3, Math.max(1, Math.round(Number(r.tier) || 2))) as Word["tier"];
    words.push({ w, tier, alias: (Array.isArray(r.alias) ? r.alias : []).map((a) => str(a, 24).toLowerCase()).filter(Boolean).slice(0, 4) });
    if (words.length === 20) break;
  }
  if (words.length < 8) return null;
  const h = (o.host && typeof o.host === "object" ? o.host : {}) as Record<string, unknown>;
  const p = (o.palette && typeof o.palette === "object" ? o.palette : {}) as Record<string, unknown>;
  const em = typeof h.emoji === "string" && h.emoji.length <= 8 ? h.emoji : "🎨";
  return {
    interest,
    title: str(o.title, 26, `${interest} Sketch Off`),
    tagline: str(o.tagline, 60, "Draw it. Guess it. Judge everyone."),
    host: { name: str(h.name, 18, "The Critic"), emoji: em, line: str(h.line, 90, "Stick figures are art if you believe hard enough.") },
    palette: { wall: hex(p.wall, "#f3e9dc"), wall2: hex(p.wall2, "#e6d3bd"), primary: hex(p.primary, "#e8492f"), accent: hex(p.accent, "#2f6fd1") },
    words,
  };
}

export const PRESET_SKETCH: SketchPack[] = [
  {
    interest: "animals",
    title: "Zoo Doodles",
    tagline: "Draw the beast. Pray your friends recognise it.",
    host: { name: "Professor Paws", emoji: "🦉", line: "Every animal is a circle with legs. Prove me wrong." },
    palette: { wall: "#e8f4e1", wall2: "#cfe6c2", primary: "#2fa36b", accent: "#ff9f1c" },
    words: [
      { w: "cat", tier: 1 }, { w: "fish", tier: 1 }, { w: "snake", tier: 1 }, { w: "giraffe", tier: 1 }, { w: "snail", tier: 1 },
      { w: "octopus", tier: 2 }, { w: "penguin", tier: 2 }, { w: "elephant", tier: 2 }, { w: "crab", tier: 2 }, { w: "bat", tier: 2 },
      { w: "flamingo", tier: 3 }, { w: "hedgehog", tier: 3 }, { w: "jellyfish", tier: 3 }, { w: "peacock", tier: 3 }, { w: "seahorse", tier: 3, alias: ["sea horse"] },
    ],
  },
  {
    interest: "space",
    title: "Cosmic Doodles",
    tagline: "Draw the universe. Badly.",
    host: { name: "Captain Crayon", emoji: "👩‍🚀", line: "In space, no one can hear you misdraw a planet." },
    palette: { wall: "#1c1f3a", wall2: "#2c2f5a", primary: "#7b61ff", accent: "#ffd166" },
    words: [
      { w: "rocket", tier: 1 }, { w: "moon", tier: 1 }, { w: "star", tier: 1 }, { w: "sun", tier: 1 }, { w: "alien", tier: 1 },
      { w: "saturn", tier: 2, alias: ["ringed planet"] }, { w: "satellite", tier: 2 }, { w: "astronaut", tier: 2 }, { w: "comet", tier: 2 }, { w: "ufo", tier: 2, alias: ["flying saucer"] },
      { w: "black hole", tier: 3 }, { w: "telescope", tier: 3 }, { w: "space station", tier: 3 }, { w: "galaxy", tier: 3 }, { w: "eclipse", tier: 3 },
    ],
  },
  {
    interest: "movies",
    title: "Frame by Frame",
    tagline: "Draw the movie thing. No words, no letters.",
    host: { name: "Director Doodle", emoji: "🎬", line: "Lights, camera, questionable linework." },
    palette: { wall: "#2a1d2e", wall2: "#3d2840", primary: "#ff4f6d", accent: "#ffd166" },
    words: [
      { w: "popcorn", tier: 1 }, { w: "camera", tier: 1 }, { w: "ghost", tier: 1 }, { w: "robot", tier: 1 }, { w: "crown", tier: 1 },
      { w: "dinosaur", tier: 2 }, { w: "shark", tier: 2 }, { w: "spaceship", tier: 2 }, { w: "superhero", tier: 2 }, { w: "wizard", tier: 2 },
      { w: "red carpet", tier: 3 }, { w: "time machine", tier: 3 }, { w: "zombie", tier: 3 }, { w: "treasure map", tier: 3 }, { w: "trophy", tier: 3, alias: ["award", "oscar"] },
    ],
  },
];

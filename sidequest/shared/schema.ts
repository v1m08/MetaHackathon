// GameConfig contract between the LLM and the engine. `GameConfigSchema` is the strict shape a
// sanitized config always satisfies; `sanitizeConfig` repairs anything (LLM output, a URL hash) into it
// field by field, falling back to the template's defaults. It never throws.
import { z } from "zod";
import { TEMPLATES, TEMPLATE_IDS } from "./registry";
import { DISPLAY_FONTS, SURFACES, type Copy, type DisplayFont, type GameConfig, type Palette, type Sprites, type Surface, type TemplateId, type TriviaQuestion, type WordHuntConfig } from "./types";

export * from "./types";
export { TEMPLATES, TEMPLATE_IDS } from "./registry";

export const LIMITS = { interest: 60, title: 28, tagline: 60, howToPlay: 80, line: 28, rank: 20, question: 120, choice: 40, hint: 70 };

const hex = z.string().regex(/^#[0-9a-f]{6}$/);
const unit = z.number().min(0).max(1);

export const GameConfigSchema = z.object({
  version: z.literal(1),
  template: z.enum(TEMPLATE_IDS as [TemplateId, ...TemplateId[]]),
  interest: z.string().min(1).max(LIMITS.interest),
  title: z.string().min(1).max(LIMITS.title),
  tagline: z.string().max(LIMITS.tagline),
  howToPlay: z.string().max(LIMITS.howToPlay),
  palette: z.object({ background: hex, surface: hex, primary: hex, accent: hex, danger: hex, text: hex }).strict(),
  sprites: z
    .object({
      player: z.string().min(1),
      obstacles: z.array(z.string()).min(2).max(4),
      pickups: z.array(z.string()).min(1).max(3),
      scenery: z.array(z.string()).max(4),
    })
    .strict(),
  copy: z
    .object({
      start: z.string().min(1).max(LIMITS.line),
      hit: z.array(z.string().min(1).max(LIMITS.line)).min(2).max(4),
      miss: z.array(z.string().min(1).max(LIMITS.line)).min(2).max(4),
      combo: z.array(z.string().min(1).max(LIMITS.line)).min(2).max(4),
      win: z.string().min(1).max(LIMITS.tagline),
      lose: z.string().min(1).max(LIMITS.tagline),
      ranks: z.tuple([z.string(), z.string(), z.string(), z.string()]),
    })
    .strict(),
  modifiers: z.array(z.string()).min(1).max(2),
  tuning: z.record(z.string(), unit).and(z.object({ difficulty: unit })),
  trivia: z
    .object({
      questions: z
        .array(
          z.object({
            q: z.string().min(1).max(LIMITS.question),
            choices: z.tuple([z.string(), z.string(), z.string(), z.string()]),
            answer: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
          }),
        )
        .min(3)
        .max(5),
    })
    .optional(),
  wordhunt: z
    .object({
      themed: z.array(z.object({ word: z.string().regex(/^[A-Z]{3,10}$/), hint: z.string().max(LIMITS.hint) })).min(4).max(16),
      surface: z.enum(SURFACES),
      font: z.enum(DISPLAY_FONTS),
      labels: z.object({ word: z.string().min(1).max(LIMITS.line), themed: z.string().min(1).max(LIMITS.line), repeat: z.string().min(1).max(LIMITS.line) }).strict(),
    })
    .strict()
    .optional(),
}).strict();

// ---------- primitives ----------

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

const BAD_WORDS = ["fuck", "shit", "bitch", "cunt", "dick", "pussy", "nigg", "fag", "retard", "whore", "slut", "rape", "nazi", "porn", "cock"];
const badRe = new RegExp(BAD_WORDS.join("|"), "i");
export const isProfane = (s: string) => badRe.test(s);

/** Trim, collapse whitespace, strip control chars, cut to `max` graphemes with no dangling half-word mess. */
export function cleanText(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  let s = v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (isProfane(s)) return "";
  if (s.length <= max) return s;
  // cut on grapheme boundaries (never split an emoji), measuring in UTF-16 units like the schema does
  let out = "";
  for (const g of graphemes(s)) {
    if (out.length + g.length > max - 1) break;
    out += g;
  }
  return out.trimEnd() + "…";
}

function graphemes(s: string): string[] {
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter;
  if (!Seg) return Array.from(s);
  return Array.from(new Seg(undefined, { granularity: "grapheme" }).segment(s), (x) => x.segment);
}

const PICTO = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
/** A single emoji grapheme, or null. */
export function asEmoji(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  const g = graphemes(s);
  if (g.length !== 1) return null;
  return PICTO.test(g[0]) ? g[0] : null;
}

function emojiList(v: unknown, fallback: string[], min: number, max: number): string[] {
  const out: string[] = [];
  for (const e of arr(v)) {
    const ok = asEmoji(e);
    if (ok && !out.includes(ok)) out.push(ok);
    if (out.length >= max) break;
  }
  for (const f of fallback) {
    if (out.length >= min) break;
    if (!out.includes(f)) out.push(f);
  }
  return out.slice(0, max);
}

function lines(v: unknown, fallback: string[], max: number): string[] {
  const out = arr(v).map((x) => cleanText(x, max)).filter(Boolean).slice(0, 4);
  return out.length >= 2 ? out : fallback;
}

const clamp01 = (n: unknown, d: number) => (typeof n === "number" && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : d);

// ---------- color ----------

export function parseHex(v: unknown): [number, number, number] | null {
  if (typeof v !== "string") return null;
  let s = v.trim().toLowerCase();
  if (!s.startsWith("#")) s = "#" + s;
  if (/^#[0-9a-f]{3}$/.test(s)) s = "#" + [...s.slice(1)].map((c) => c + c).join("");
  if (!/^#[0-9a-f]{6}$/.test(s)) return null;
  return [0, 2, 4].map((i) => parseInt(s.slice(1 + i, 3 + i), 16)) as [number, number, number];
}
const toHex = (rgb: number[]) => "#" + rgb.map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, "0")).join("");

function luminance([r, g, b]: number[]) {
  const f = (c: number) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export function contrast(a: string, b: string) {
  const la = luminance(parseHex(a)!), lb = luminance(parseHex(b)!);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function rgbToHsl([r, g, b]: number[]): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
function hslToRgb([h, s, l]: number[]): number[] {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const t = (x: number) => {
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [t(h + 1 / 3) * 255, t(h) * 255, t(h - 1 / 3) * 255];
}

/** Move `fg` lightness away from `bg` until contrast >= min. Keeps hue, never rejects. */
export function ensureContrast(fg: string, bg: string, min: number): string {
  if (contrast(fg, bg) >= min) return fg;
  const [h, s, l0] = rgbToHsl(parseHex(fg)!);
  const bgDark = luminance(parseHex(bg)!) < 0.25;
  for (let step = 1; step <= 20; step++) {
    const l = bgDark ? l0 + ((1 - l0) * step) / 20 : l0 * (1 - step / 20);
    const c = toHex(hslToRgb([h, s, l]));
    if (contrast(c, bg) >= min) return c;
  }
  return bgDark ? "#ffffff" : "#000000";
}

function palette(v: unknown, d: Palette): Palette {
  const o = isObj(v) ? v : {};
  const pick = (k: keyof Palette) => {
    const p = parseHex(o[k]);
    return p ? toHex(p) : d[k];
  };
  const p: Palette = { background: pick("background"), surface: pick("surface"), primary: pick("primary"), accent: pick("accent"), danger: pick("danger"), text: pick("text") };
  p.text = ensureContrast(p.text, p.background, 4.5);
  p.primary = ensureContrast(p.primary, p.background, 3);
  p.accent = ensureContrast(p.accent, p.background, 2);
  p.danger = ensureContrast(p.danger, p.background, 2.5);
  if (contrast(p.surface, p.background) < 1.15) p.surface = ensureContrast(p.surface, p.background, 1.3);
  // cards put text on surface: pull surface toward background until text reads on it
  const bg = parseHex(p.background)!;
  for (let k = 0.2; contrast(p.text, p.surface) < 4.5 && k <= 1; k += 0.2) {
    const sf = parseHex(p.surface)!;
    p.surface = toHex(sf.map((c, i) => c + (bg[i] - c) * k));
  }
  return p;
}

function sprites(v: unknown, d: Sprites): Sprites {
  const o = isObj(v) ? v : {};
  return {
    player: asEmoji(o.player) ?? d.player,
    obstacles: emojiList(o.obstacles, d.obstacles, 2, 4),
    pickups: emojiList(o.pickups, d.pickups, 1, 3),
    scenery: emojiList(o.scenery, d.scenery, 0, 4),
  };
}

function copy(v: unknown, d: Copy): Copy {
  const o = isObj(v) ? v : {};
  const r = arr(o.ranks).map((x) => cleanText(x, LIMITS.rank));
  return {
    start: cleanText(o.start, LIMITS.line) || d.start,
    hit: lines(o.hit, d.hit, LIMITS.line),
    miss: lines(o.miss, d.miss, LIMITS.line),
    combo: lines(o.combo, d.combo, LIMITS.line),
    win: cleanText(o.win, LIMITS.tagline) || d.win,
    lose: cleanText(o.lose, LIMITS.tagline) || d.lose,
    ranks: [0, 1, 2, 3].map((i) => r[i] || d.ranks[i]) as Copy["ranks"],
  };
}

function trivia(v: unknown): TriviaQuestion[] {
  const o = isObj(v) ? v : {};
  const out: TriviaQuestion[] = [];
  for (const q of arr(o.questions)) {
    if (!isObj(q)) continue;
    const text = cleanText(q.q, LIMITS.question);
    const choices = arr(q.choices).map((c) => cleanText(String(c ?? ""), LIMITS.choice));
    const ans = q.answer;
    if (!text || choices.length !== 4 || choices.some((c) => !c) || new Set(choices).size !== 4) continue;
    if (ans !== 0 && ans !== 1 && ans !== 2 && ans !== 3) continue;
    out.push({ q: text, choices: choices as TriviaQuestion["choices"], answer: ans });
    if (out.length === 5) break;
  }
  return out;
}

function wordhunt(v: unknown): WordHuntConfig | null {
  const o = isObj(v) ? v : {};
  const seen = new Set<string>();
  const themed: WordHuntConfig["themed"] = [];
  for (const t of arr(o.themed)) {
    const word = (isObj(t) ? String(t.word ?? "") : String(t ?? "")).toUpperCase().replace(/[^A-Z]/g, "");
    if (word.length < 3 || word.length > 10 || seen.has(word) || isProfane(word)) continue;
    seen.add(word);
    themed.push({ word, hint: isObj(t) ? cleanText(t.hint, LIMITS.hint) : "" });
    if (themed.length === 16) break;
  }
  if (themed.length < 4) return null;
  const l = isObj(o.labels) ? o.labels : {};
  return {
    themed,
    surface: SURFACES.includes(o.surface as Surface) ? (o.surface as Surface) : "felt",
    font: DISPLAY_FONTS.includes(o.font as DisplayFont) ? (o.font as DisplayFont) : "Rubik",
    labels: {
      word: cleanText(l.word, LIMITS.line) || "Nice",
      themed: cleanText(l.themed, LIMITS.line) || "Theme word",
      repeat: cleanText(l.repeat, LIMITS.line) || "Already found",
    },
  };
}

export function normalizeInterest(s: unknown): string {
  return cleanText(typeof s === "string" ? s : "", LIMITS.interest).replace(/…$/, "");
}

/** Repair anything into a valid GameConfig. Never throws. */
export function sanitizeConfig(input: unknown, fallbackInterest = "fun"): GameConfig {
  const o = isObj(input) ? input : {};
  let template: TemplateId = TEMPLATE_IDS.includes(o.template as TemplateId) ? (o.template as TemplateId) : "catcher";
  let questions: TriviaQuestion[] = [];
  if (template === "trivia") {
    questions = trivia(o.trivia);
    if (questions.length < 3) template = "catcher"; // trivia without questions is not a game
  }
  const wh = template === "wordhunt" ? wordhunt(o.wordhunt) : null;
  if (template === "wordhunt" && !wh) template = "catcher"; // a word hunt needs themed words
  const meta = TEMPLATES[template];
  const d = meta.defaults;
  const interest = normalizeInterest(o.interest) || normalizeInterest(fallbackInterest) || "fun";

  const mods = arr(o.modifiers).filter((m): m is string => typeof m === "string" && m in meta.modifiers);
  const modifiers = [...new Set(mods)].slice(0, 2);
  if (!modifiers.length) modifiers.push(...d.modifiers);

  const t = isObj(o.tuning) ? o.tuning : {};
  const tuning: GameConfig["tuning"] = { difficulty: clamp01(t.difficulty, 0.5) };
  for (const k of Object.keys(meta.tuning)) tuning[k] = clamp01(t[k], 0.5);

  const cfg: GameConfig = {
    version: 1,
    template,
    interest,
    title: cleanText(o.title, LIMITS.title) || cleanText(`${titleCase(interest)} Rush`, LIMITS.title),
    tagline: cleanText(o.tagline, LIMITS.tagline) || `A tiny game about ${interest}.`.slice(0, LIMITS.tagline),
    howToPlay: cleanText(o.howToPlay, LIMITS.howToPlay) || meta.description.split(".")[0].slice(0, LIMITS.howToPlay),
    palette: palette(o.palette, d.palette),
    sprites: sprites(o.sprites, d.sprites),
    copy: copy(o.copy, d.copy),
    modifiers,
    tuning,
  };
  if (template === "trivia") cfg.trivia = { questions };
  if (wh) cfg.wordhunt = wh;
  return cfg;
}

export const titleCase = (s: string) => s.replace(/\b\p{L}/gu, (c) => c.toUpperCase());

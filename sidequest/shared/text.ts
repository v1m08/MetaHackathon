// Small text and color helpers shared by Deep Cuts and Order Up! (input cleanup, readable colors).

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


export function normalizeInterest(s: unknown): string {
  return cleanText(typeof s === "string" ? s : "", 60).replace(/…$/, "");
}


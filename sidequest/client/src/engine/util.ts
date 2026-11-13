export const W = 390;
export const H = 844;

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};
export const easeOutBack = (t: number) => {
  const c = 1.70158;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
};

/** Seedable PRNG (mulberry32) so the headless bot test is reproducible. */
export function rng(seed = Date.now() >>> 0) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (a: number, b: number) => a + (b - a) * next(),
    int: (a: number, b: number) => Math.floor(a + (b - a + 1) * next()),
    pick: <T>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)],
    chance: (p: number) => next() < p,
  };
}
export type Rng = ReturnType<typeof rng>;

/**
 * Round intensity 0..1. The first 5 s are always gentle (0), then it ramps to 1 by the end of the round.
 * `difficulty` (0..1) scales how hard "1" is via `scale()`.
 */
export const ramp = (t: number, total: number) => smooth((t - 5) / Math.max(1, total - 5));
export const diffScale = (difficulty: number) => lerp(0.8, 1.25, difficulty);

export function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
export function mix(a: string, b: string, t: number) {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  const c = [16, 8, 0].map((s) => Math.round(lerp((x >> s) & 255, (y >> s) & 255, t)));
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
}

export const FONT = `"Rubik", system-ui, sans-serif`;
export const font = (px: number, weight = 600) => `${weight} ${px}px ${FONT}`;

export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(" ");
  const out: string[] = [];
  let line = "";
  for (const w of words) {
    const t = line ? line + " " + w : w;
    if (ctx.measureText(t).width > maxW && line) {
      out.push(line);
      line = w;
    } else line = t;
  }
  if (line) out.push(line);
  return out;
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// Pixel art for Order Up!: crisp outlined food sprites (re-drawn from emoji shapes), procedural customers,
// and the restaurant's back wall. Everything renders to small canvases shown with image-rendering: pixelated.

const EMOJI_FONT = `"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
const OUTLINE = [42, 28, 20];
const cache = new Map<string, string>();

function hash(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}
const pick = <T>(arr: T[], r: number) => arr[Math.floor(r * arr.length) % arr.length];

/** Re-draw an emoji as a small pixel sprite: hard alpha edges, a dark 1px outline, a top highlight. */
export function foodSprite(emoji: string, px = 18): string {
  const key = `f|${emoji}|${px}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const S = px + 4;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `${px}px ${EMOJI_FONT}`;
  g.fillText(emoji, S / 2, S / 2 + 1);
  const img = g.getImageData(0, 0, S, S);
  const d = img.data;
  const solid = new Uint8Array(S * S);
  for (let i = 0; i < S * S; i++) {
    const a = d[i * 4 + 3];
    solid[i] = a > 110 ? 1 : 0;
    if (solid[i]) {
      d[i * 4 + 3] = 255;
      // posterize a little so it reads as pixel art, not a shrunken photo
      for (let k = 0; k < 3; k++) d[i * 4 + k] = Math.round(d[i * 4 + k] / 24) * 24;
    } else d[i * 4 + 3] = 0;
  }
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const i = y * S + x;
      if (solid[i]) continue;
      const n = (x > 0 && solid[i - 1]) || (x < S - 1 && solid[i + 1]) || (y > 0 && solid[i - S]) || (y < S - 1 && solid[i + S]);
      if (n) {
        d[i * 4] = OUTLINE[0];
        d[i * 4 + 1] = OUTLINE[1];
        d[i * 4 + 2] = OUTLINE[2];
        d[i * 4 + 3] = 255;
      }
    }
  g.putImageData(img, 0, 0);
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}

export type Mood = "wait" | "worried" | "happy" | "angry";
const SKIN = ["#f6d5b8", "#e9b48c", "#c98b5e", "#9a6440", "#6b4128"];
const HAIR = ["#2b1d14", "#5a3a22", "#a8743a", "#e3c46b", "#b2412c", "#3b3b44", "#d9d9d9", "#6a3fa0", "#2f6fd1"];
const SHIRT = ["#e8492f", "#2fa36b", "#2f6fd1", "#f2b134", "#8e44ad", "#16a085", "#e84393", "#34495e", "#ff7f50"];
const STYLES = ["short", "long", "bun", "cap", "spiky", "bald", "bob"] as const;

/** A customer drawn as a 16x22 pixel person. Same seed → same person. */
export function personSprite(seed: number, mood: Mood): string {
  const key = `p|${seed}|${mood}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const W = 16, H = 22;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const r = (k: number) => hash(seed * 13.7 + k);
  const skin = pick(SKIN, r(1)), hair = pick(HAIR, r(2)), shirt = pick(SHIRT, r(3)), style = pick([...STYLES], r(4));
  const capColor = pick(SHIRT, r(5));
  const px = (x: number, y: number, w: number, h: number, col: string) => {
    g.fillStyle = col;
    g.fillRect(x, y, w, h);
  };
  // body + shoulders
  px(2, 16, 12, 6, shirt);
  px(1, 18, 14, 4, shirt);
  px(6, 15, 4, 2, skin); // neck
  px(7, 16, 2, 2, "rgba(0,0,0,.15)");
  // head
  px(3, 5, 10, 10, skin);
  px(4, 4, 8, 1, skin);
  // hair by style
  if (style === "short" || style === "spiky") {
    px(3, 3, 10, 3, hair);
    px(3, 6, 1, 3, hair);
    px(12, 6, 1, 3, hair);
    if (style === "spiky") for (let x = 3; x < 13; x += 2) px(x, 2, 1, 1, hair);
  } else if (style === "long") {
    px(3, 3, 10, 3, hair);
    px(2, 5, 2, 10, hair);
    px(12, 5, 2, 10, hair);
  } else if (style === "bun") {
    px(3, 3, 10, 3, hair);
    px(6, 0, 4, 3, hair);
    px(3, 6, 1, 2, hair);
    px(12, 6, 1, 2, hair);
  } else if (style === "cap") {
    px(3, 2, 10, 4, capColor);
    px(2, 5, 12, 1, capColor);
    px(11, 5, 4, 1, capColor);
  } else if (style === "bob") {
    px(3, 3, 10, 3, hair);
    px(2, 5, 2, 7, hair);
    px(12, 5, 2, 7, hair);
  } else px(4, 4, 8, 1, "rgba(0,0,0,.08)"); // bald shine line
  // face
  const eye = "#2a1d14";
  if (mood === "angry") {
    px(5, 8, 2, 1, eye);
    px(9, 8, 2, 1, eye);
    px(5, 9, 1, 1, eye);
    px(10, 9, 1, 1, eye);
    px(6, 12, 4, 1, eye);
    px(5, 13, 1, 1, eye);
    px(10, 13, 1, 1, eye);
    px(4, 11, 1, 1, "#e57373");
    px(11, 11, 1, 1, "#e57373");
  } else {
    px(5, 9, 1, 2, eye);
    px(10, 9, 1, 2, eye);
    if (mood === "happy") {
      px(5, 12, 1, 1, eye);
      px(10, 12, 1, 1, eye);
      px(6, 13, 4, 1, eye);
      px(4, 11, 1, 1, "#f4a3a3");
      px(11, 11, 1, 1, "#f4a3a3");
    } else if (mood === "worried") {
      px(4, 7, 2, 1, eye);
      px(10, 7, 2, 1, eye);
      px(7, 12, 2, 2, eye);
      px(12, 8, 1, 2, "#7ec8ff"); // sweat drop
    } else px(6, 12, 4, 1, eye);
  }
  // outline pass
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && d[(y * W + x) * 4 + 3] > 0;
  const out: number[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) out.push(x, y);
  g.fillStyle = "#2a1d14";
  for (let i = 0; i < out.length; i += 2) g.fillRect(out[i], out[i + 1], 1, 1);
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}

/** The restaurant's back wall: tiles, a window with sky, a shelf of jars, hanging lamps. */
export function drawWall(canvas: HTMLCanvasElement, theme: { wall: string; wall2: string; counter: string; accent: string }, jars: string[]) {
  const rect = canvas.getBoundingClientRect();
  const P = 4; // css px per art px
  const W = Math.max(40, Math.ceil(rect.width / P)), H = Math.max(40, Math.ceil(rect.height / P));
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  const px = (x: number, y: number, w: number, h: number, col: string) => {
    g.fillStyle = col;
    g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };
  const mix = (a: string, b: string, t: number) => {
    const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
    const ch = [16, 8, 0].map((s) => Math.round(((x >> s) & 255) * (1 - t) + ((y >> s) & 255) * t));
    return "#" + ch.map((v) => v.toString(16).padStart(2, "0")).join("");
  };
  // banded wall
  for (let y = 0; y < H; y++) px(0, y, W, 1, mix(theme.wall, theme.wall2, Math.floor((y / H) * 6) / 5));
  // tiles on the lower half
  const tileTop = Math.floor(H * 0.55);
  for (let y = tileTop; y < H; y += 6) {
    px(0, y, W, 1, mix(theme.wall2, "#000000", 0.12));
    for (let x = (y / 6) % 2 ? 0 : 4; x < W; x += 8) px(x, y, 1, 6, mix(theme.wall2, "#000000", 0.1));
  }
  px(0, tileTop - 2, W, 2, mix(theme.counter, "#ffffff", 0.15));
  // window (right)
  const wx = Math.floor(W * 0.68), wy = Math.floor(H * 0.12), ww = Math.floor(W * 0.24), wh = Math.floor(H * 0.32);
  px(wx - 1, wy - 1, ww + 2, wh + 2, theme.counter);
  for (let y = 0; y < wh; y++) px(wx, wy + y, ww, 1, mix("#8fd3ff", "#ffe2b8", y / wh));
  px(wx + Math.floor(ww / 2), wy, 1, wh, theme.counter);
  px(wx, wy + Math.floor(wh / 2), ww, 1, theme.counter);
  px(wx + 3, wy + wh - 4, 6, 2, "#ffffff");
  px(wx + 4, wy + wh - 5, 4, 1, "#ffffff");
  // shelf (left) with jars
  const sx = Math.floor(W * 0.06), sy = Math.floor(H * 0.36), sw = Math.floor(W * 0.32);
  px(sx, sy, sw, 2, theme.counter);
  px(sx, sy + 2, sw, 1, mix(theme.counter, "#000000", 0.35));
  jars.slice(0, 3).forEach((e, i) => {
    const jx = sx + 2 + i * Math.floor(sw / 3);
    px(jx, sy - 7, 7, 7, "rgba(255,255,255,.55)");
    px(jx + 1, sy - 8, 5, 1, mix(theme.accent, "#000000", 0.2));
    const img = new Image();
    img.onload = () => g.drawImage(img, jx + 1, sy - 7, 5, 5);
    img.src = foodSprite(e, 10);
  });
  // hanging lamps
  for (const lx of [Math.floor(W * 0.25), Math.floor(W * 0.5)]) {
    px(lx, 0, 1, Math.floor(H * 0.08), "#3a2a20");
    px(lx - 3, Math.floor(H * 0.08), 7, 3, theme.accent);
    px(lx - 2, Math.floor(H * 0.08) + 3, 5, 1, "#fff3b0");
  }
}

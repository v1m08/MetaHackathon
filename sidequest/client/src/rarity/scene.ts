// Pixel-art world the player travels through. Drawn on a low-res canvas scaled up with crisp pixels.
// The camera follows the player's progress (meter units); friends show up as markers on the side gauge.
import type { PublicPack, SceneKind } from "../../../shared/rarity";
import { fmt, TIER_POINTS, PROMPTS_PER_GAME } from "../../../shared/rarity";
import { mix } from "../engine/util";

const PX = 3; // CSS pixels per art pixel
const JOURNEY_POINTS = 480; // a great run; the scene's "far end" colors arrive here

const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const EMOJI_FONT = `"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;

export interface Marker {
  name: string;
  value: number; // meter units
  me?: boolean;
}

export class SceneView {
  private ctx: CanvasRenderingContext2D;
  private W = 0;
  private H = 0;
  private cam = 0; // art px along the journey
  private target = 0;
  private raf = 0;
  private t0 = performance.now();
  private gauge: HTMLElement;
  private ticks: HTMLElement[] = [];
  private markerEls = new Map<string, HTMLElement>();
  private markers: Marker[] = [];
  private onResize = () => this.resize();
  private kind: SceneKind;
  private up: boolean;
  /** art px per meter unit */
  private k: number;
  private step: number;
  private emojiCache = new Map<string, HTMLCanvasElement>();
  /** Where the avatar sits on screen (0..1 of height). */
  anchor: number;
  avatarVisible = true;

  constructor(private host: HTMLElement, private w: PublicPack) {
    this.kind = w.scene.kind;
    this.up = w.meter.up;
    this.anchor = this.up ? 0.62 : 0.4;
    const fullUnits = JOURNEY_POINTS * w.meter.perPoint;
    this.k = 1500 / fullUnits;
    // tick spacing: a round number of units, about 70 art px apart
    const raw = 70 / this.k;
    const p10 = Math.pow(10, Math.floor(Math.log10(raw)));
    this.step = [1, 2, 5, 10].map((m) => m * p10).find((s) => s >= raw) ?? raw;

    host.innerHTML = `<canvas class="scene-canvas"></canvas><div class="gauge" aria-hidden="true"><div class="gauge-line"></div></div>`;
    const canvas = host.querySelector("canvas")!;
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    this.gauge = host.querySelector(".gauge")!;
    for (let i = 0; i < 14; i++) {
      const t = document.createElement("div");
      t.className = "tick";
      this.gauge.appendChild(t);
      this.ticks.push(t);
    }
    this.resize();
    addEventListener("resize", this.onResize);
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      this.frame();
    };
    this.raf = requestAnimationFrame(loop);
  }

  /** Move the camera to a meter value. `instant` skips the glide. */
  setProgress(units: number, instant = false) {
    this.target = Math.max(0, units * this.k);
    if (instant) this.cam = this.target;
  }
  get moving() {
    return Math.abs(this.target - this.cam) > 0.5;
  }
  setMarkers(m: Marker[]) {
    this.markers = m;
    const keep = new Set(m.map((x) => x.name + (x.me ? "*" : "")));
    for (const [k, el] of this.markerEls) if (!keep.has(k)) (el.remove(), this.markerEls.delete(k));
    for (const x of m) {
      const key = x.name + (x.me ? "*" : "");
      if (!this.markerEls.has(key)) {
        const el = document.createElement("div");
        el.className = `marker${x.me ? " me" : ""}`;
        el.textContent = x.me ? "you" : x.name;
        this.gauge.appendChild(el);
        this.markerEls.set(key, el);
      }
    }
  }
  destroy() {
    cancelAnimationFrame(this.raf);
    removeEventListener("resize", this.onResize);
  }

  private resize() {
    const r = this.host.getBoundingClientRect();
    this.W = Math.max(60, Math.ceil(r.width / PX));
    this.H = Math.max(80, Math.ceil(r.height / PX));
    const c = this.ctx.canvas;
    c.width = this.W;
    c.height = this.H;
    c.style.width = `${this.W * PX}px`;
    c.style.height = `${this.H * PX}px`;
    this.ctx.imageSmoothingEnabled = false;
  }

  /** Screen y (art px) of a journey position (art px). */
  private sy(pos: number) {
    const a = this.H * this.anchor;
    return this.up ? a - (pos - this.cam) : a + (pos - this.cam);
  }
  private get frac() {
    return Math.min(1, this.cam / 1500);
  }

  private frame() {
    const t = (performance.now() - this.t0) / 1000;
    this.cam += (this.target - this.cam) * 0.06;
    if (Math.abs(this.target - this.cam) < 0.3) this.cam = this.target;
    const c = this.ctx;
    c.imageSmoothingEnabled = false;
    const draw = SCENES[this.kind] ?? SCENES.tower;
    draw.call(this, c, t);
    if (this.avatarVisible) this.drawAvatar(c, t);
    this.updateGauge();
  }

  // ---------- helpers ----------
  private rect(x: number, y: number, w: number, h: number, color: string) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  private skyGradient(top0: string, bot0: string) {
    const s = this.w.scene;
    const f = this.frac;
    const top = mix(s.start[0], s.end[0], f);
    const bot = mix(s.start[1], s.end[1], f);
    // banded gradient: 8 flat bands reads as pixel art
    const bands = 10;
    for (let i = 0; i < bands; i++) this.rect(0, (this.H * i) / bands, this.W, this.H / bands + 1, mix(top0 === "" ? top : top0, bot0 === "" ? bot : bot0, i / (bands - 1)));
  }
  private emoji(e: string, x: number, y: number, size: number) {
    const key = e + size;
    let img = this.emojiCache.get(key);
    if (!img) {
      img = document.createElement("canvas");
      img.width = img.height = size + 2;
      const g = img.getContext("2d")!;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = `${size}px ${EMOJI_FONT}`;
      g.fillText(e, (size + 2) / 2, (size + 2) / 2 + 1);
      this.emojiCache.set(key, img);
    }
    this.ctx.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height / 2));
  }
  private stars(density: number, seed = 1) {
    if (density <= 0) return;
    for (let i = 0; i < 90; i++) {
      if (hash(i * 7 + seed) > density) continue;
      const x = hash(i * 13 + seed) * this.W;
      const y = (hash(i * 17 + seed) * this.H * 1.4 + this.cam * 0.15) % this.H;
      this.rect(x, y, 1, 1, hash(i) > 0.8 ? "#fff6c8" : "#ffffff");
    }
  }
  private clouds(t: number, parallax = 0.5, color = "#ffffff") {
    for (let i = 0; i < 40; i++) {
      const pos = i * 110 + hash(i) * 60;
      const y = this.up ? this.H * this.anchor - (pos - this.cam * parallax) : 0;
      if (y < -20 || y > this.H + 20) continue;
      const x = ((hash(i * 3) * (this.W + 60) + t * (3 + hash(i) * 4)) % (this.W + 60)) - 30;
      const w = 14 + Math.round(hash(i * 5) * 14);
      this.rect(x, y, w, 4, color);
      this.rect(x + 3, y - 3, w - 8, 3, color);
      this.rect(x + 6, y - 5, w / 3, 2, color);
    }
  }
  /** Props spaced along the journey, alternating sides. */
  private props(xs: (side: number, i: number) => number, every = 150, size = 12) {
    const p = this.w.scene.props;
    if (!p.length) return;
    const first = Math.floor((this.cam - this.H * 1.2) / every);
    for (let i = Math.max(0, first); i < first + Math.ceil((this.H * 2.4) / every) + 2; i++) {
      const pos = i * every + 60 + hash(i * 9) * 40;
      const y = this.sy(pos);
      if (y < -20 || y > this.H + 20) continue;
      const side = i % 2 ? 1 : -1;
      this.emoji(p[i % p.length], xs(side, i), y, size);
    }
  }
  private drawAvatar(c: CanvasRenderingContext2D, t: number) {
    const y = this.H * this.anchor + Math.round(Math.sin(t * 2.4) * 1.5);
    const x = this.avatarX(t);
    this.rect(x - 6, y + 8, 12, 2, "rgba(0,0,0,0.25)");
    this.emoji(this.w.avatar, x, y, 16);
    void c;
  }
  private avatarX(t: number) {
    if (this.kind === "track") return this.roadX(this.cam) + Math.sin(t * 1.3) * 2;
    if (this.kind === "trail") return this.trailX(this.cam);
    return Math.round(this.W / 2);
  }
  private roadX(pos: number) {
    return this.W / 2 + Math.sin(pos / 160) * this.W * 0.14 + Math.sin(pos / 57) * this.W * 0.03;
  }
  private trailX(pos: number) {
    return this.W / 2 + Math.sin(pos / 90) * this.W * 0.22;
  }

  private updateGauge() {
    const H = this.H;
    const first = Math.floor(this.unitsAt(this.up ? H : 0) / this.step) - 1;
    this.ticks.forEach((el, i) => {
      const units = (first + i) * this.step;
      const y = this.sy(units * this.k) * PX;
      if (units < 0 || y < -20 || y > H * PX + 20) {
        el.style.display = "none";
        return;
      }
      el.style.display = "";
      el.style.transform = `translateY(${y}px)`;
      el.textContent = `${fmt(units)}${this.w.meter.unit}`;
    });
    for (const m of this.markers) {
      const el = this.markerEls.get(m.name + (m.me ? "*" : ""));
      if (!el) continue;
      const y = this.sy(m.value * this.k) * PX;
      el.style.transform = `translateY(${Math.max(-30, Math.min(H * PX + 30, y))}px)`;
      el.classList.toggle("off", y < 0 || y > H * PX);
    }
  }
  private unitsAt(screenY: number) {
    const a = this.H * this.anchor;
    const pos = this.up ? this.cam + (a - screenY) : this.cam + (screenY - a);
    return pos / this.k;
  }
}

/** Max possible score for a pack (for gauges). */
export const maxPoints = () => TIER_POINTS[5] * PROMPTS_PER_GAME;

// ---------- the worlds ----------
type Draw = (this: SceneView, c: CanvasRenderingContext2D, t: number) => void;
// Access private helpers inside draw functions.
type S = any; // eslint-disable-line @typescript-eslint/no-explicit-any

const SCENES: Record<SceneKind, Draw> = {
  cliff(this: SceneView, _c, t) {
    const s = this as S;
    const { W, H } = s;
    s.skyGradient("", "");
    s.stars(Math.max(0, s.frac - 0.55) * 1.6);
    // far ranges sink away as you climb
    for (let layer = 0; layer < 2; layer++) {
      const base = s.H * s.anchor + 30 + s.cam * (0.35 + layer * 0.25) - layer * 18;
      if (base - 50 > H) continue;
      const col = mix(s.w.scene.start[1], s.w.scene.ground, 0.35 + layer * 0.25);
      for (let x = 0; x < W; x++) {
        const h = 22 + Math.abs(Math.sin(x / (16 + layer * 7) + layer * 3)) * 26 + hash(Math.floor(x / 3) + layer * 99) * 6;
        s.rect(x, base - h, 1, h + H, col);
      }
    }
    s.clouds(t, 0.55);
    // the wall
    const g = s.w.scene.ground;
    const dark = mix(g, "#000000", 0.28), light = mix(g, "#ffffff", 0.18);
    const top = s.up ? Math.max(0, s.sy(99999)) : 0;
    for (let y = top; y < H; y++) {
      const pos = s.up ? s.cam + (H * s.anchor - y) : 0;
      if (pos < -2) continue;
      const row = Math.floor(pos);
      const l = W * 0.2 + Math.sin(row / 23) * 5 + hash(Math.floor(row / 3)) * 4;
      const r = W * 0.8 + Math.sin(row / 31 + 2) * 6 - hash(Math.floor(row / 3) + 50) * 4;
      s.rect(l, y, r - l, 1, g);
      s.rect(l, y, 2, 1, dark);
      s.rect(r - 2, y, 2, 1, light);
      if (hash(row * 3.1) > 0.82) s.rect(l + hash(row) * (r - l - 8), y, 3 + hash(row * 2) * 6, 1, hash(row * 5) > 0.5 ? dark : light);
    }
    // holds
    const holdCols = [s.w.palette.primary, s.w.palette.accent, "#4fd1ff", "#ff5fa2"];
    for (let i = Math.max(0, Math.floor((s.cam - H) / 9)); i < Math.floor((s.cam + H) / 9); i++) {
      const pos = i * 9 + hash(i) * 5;
      const y = s.sy(pos);
      if (y < 0 || y > H) continue;
      const x = W * 0.26 + hash(i * 7.3) * W * 0.48;
      const col = holdCols[i % holdCols.length];
      s.rect(x, y, 3, 2, col);
      s.rect(x, y + 2, 3, 1, mix(col, "#000000", 0.4));
    }
    // ground at the start
    const gy = s.sy(0);
    if (gy < H) {
      s.rect(0, gy, W, H - gy, "#5c8a3c");
      s.rect(0, gy, W, 2, "#7fb04f");
      for (let x = 2; x < W; x += 9) if (x < W * 0.18 || x > W * 0.82) s.rect(x, gy - 6, 3, 6, "#2f5e2a");
    }
    s.props((side: number) => (side < 0 ? W * 0.1 : W * 0.9), 170, 11);
  },

  track(this: SceneView, _c, t) {
    const s = this as S;
    const { W, H } = s;
    const grass = mix("#4e8f3a", s.w.scene.start[0], 0.15);
    s.rect(0, 0, W, H, grass);
    for (let y = 0; y < H; y++) {
      const pos = s.cam + (H * s.anchor - y);
      const row = Math.floor(pos);
      if (hash(row) > 0.7) s.rect(hash(row * 3) * W, y, 2, 1, mix(grass, "#ffffff", 0.12));
      const cx = s.roadX(pos);
      const half = W * 0.2;
      // run-off, kerbs, asphalt
      s.rect(cx - half - 7, y, half * 2 + 14, 1, "#cdbf9a");
      const kerb = Math.floor(pos / 4) % 2 ? s.w.palette.primary : "#ffffff";
      s.rect(cx - half - 3, y, 3, 1, kerb);
      s.rect(cx + half, y, 3, 1, kerb);
      s.rect(cx - half, y, half * 2, 1, hash(row * 1.7) > 0.93 ? mix(s.w.scene.ground, "#ffffff", 0.08) : s.w.scene.ground);
      if (Math.floor(pos / 8) % 2) s.rect(cx - 1, y, 2, 1, "rgba(255,255,255,0.55)");
      if (pos > -6 && pos < 0) for (let x = 0; x < half * 2; x += 2) s.rect(cx - half + x, y, 2, 1, (Math.floor(x / 2) + Math.floor(pos)) % 2 ? "#ffffff" : "#111111");
    }
    // grandstands
    for (let i = Math.max(0, Math.floor((s.cam - H) / 260)); i < (s.cam + H) / 260 + 1; i++) {
      const y = s.sy(i * 260 + 120);
      if (y < -30 || y > H + 30) continue;
      const side = i % 2 ? 1 : -1;
      const x = side < 0 ? 2 : W - 16;
      s.rect(x, y - 20, 14, 26, "#8a8f9e");
      for (let k = 0; k < 6; k++) for (let j = 0; j < 3; j++) s.rect(x + 1 + j * 4, y - 18 + k * 4, 3, 2, ["#ff6b6b", "#ffd166", "#4fd1ff", "#ffffff"][(k + j + i) % 4]);
    }
    s.props((side: number) => (side < 0 ? W * 0.12 : W * 0.88), 190, 11);
    // sunset tint as the race goes on
    const f = s.frac;
    if (f > 0.05) {
      s.ctx.globalAlpha = f * 0.35;
      s.rect(0, 0, W, H, s.w.scene.end[0]);
      s.ctx.globalAlpha = 1;
    }
    void t;
  },

  ocean(this: SceneView, _c, t) {
    const s = this as S;
    const { W, H } = s;
    const sc = s.w.scene;
    const surface = s.sy(0);
    for (let y = 0; y < H; y++) {
      const pos = s.cam + (y - H * s.anchor);
      if (pos < 0) {
        s.rect(0, y, W, 1, mix("#bfe6ff", "#eaf7ff", Math.min(1, (surface - y) / 40)));
        continue;
      }
      const f = Math.min(1, pos / 1500);
      const band = Math.floor(f * 14) / 14;
      s.rect(0, y, W, 1, mix(sc.start[1], sc.end[1], band));
    }
    if (surface > -10 && surface < H) {
      for (let x = 0; x < W; x++) {
        const wy = surface + Math.round(Math.sin(x / 5 + t * 2) * 1);
        s.rect(x, wy - 1, 1, 2, "#ffffff");
      }
    }
    // light shafts near the top
    s.ctx.globalAlpha = Math.max(0, 0.16 - s.frac * 0.3);
    for (let i = 0; i < 5; i++) {
      const x0 = ((i * 37 + t * 4) % (W + 40)) - 20;
      for (let y = Math.max(0, surface); y < H; y += 1) s.rect(x0 + (y - surface) * 0.4, y, 6, 1, "#ffffff");
    }
    s.ctx.globalAlpha = 1;
    // side rock walls
    const g = sc.ground;
    for (let y = Math.max(0, surface); y < H; y++) {
      const pos = Math.floor(s.cam + (y - H * s.anchor));
      const dk = mix(g, "#000000", Math.min(0.75, s.frac * 0.9));
      const lw = 6 + Math.abs(Math.sin(pos / 19)) * 10 + hash(Math.floor(pos / 2)) * 3;
      const rw = 6 + Math.abs(Math.sin(pos / 23 + 1)) * 12 + hash(Math.floor(pos / 2) + 9) * 3;
      s.rect(0, y, lw, 1, dk);
      s.rect(W - rw, y, rw, 1, dk);
    }
    // bubbles
    for (let i = 0; i < 18; i++) {
      const x = W * 0.3 + hash(i) * W * 0.4;
      const y = H - ((t * (10 + hash(i * 3) * 12) + hash(i * 5) * H) % H);
      if (y > surface) s.rect(x + Math.sin(t * 3 + i) * 1.5, y, 1, 1, "rgba(255,255,255,0.7)");
    }
    s.props((side: number, i: number) => (side < 0 ? W * 0.18 : W * 0.82) + Math.sin(t * 0.8 + i) * 6, 140, 11);
    s.stars(Math.max(0, s.frac - 0.6) * 0.5, 7); // glowing plankton in the deep
  },

  space(this: SceneView, _c, t) {
    const s = this as S;
    const { W, H } = s;
    s.skyGradient("", "");
    s.stars(Math.min(1, s.frac * 2.2));
    s.clouds(t, 0.7);
    const gy = s.sy(0);
    if (gy < H) {
      s.rect(0, gy, W, H - gy, s.w.scene.ground);
      s.rect(W / 2 - 14, gy - 3, 28, 3, mix(s.w.scene.ground, "#ffffff", 0.3));
      s.rect(W / 2 + 18, gy - 26, 3, 26, "#9aa3b5");
    }
    s.props((side: number) => (side < 0 ? W * 0.2 : W * 0.8), 200, 13);
  },

  tower(this: SceneView, _c, t) {
    const s = this as S;
    const { W, H } = s;
    s.skyGradient("", "");
    s.stars(Math.max(0, s.frac - 0.5));
    s.clouds(t, 0.45);
    const g = s.w.scene.ground;
    const l = Math.round(W * 0.24), r = Math.round(W * 0.76);
    for (let y = 0; y < H; y++) {
      const pos = s.cam + (H * s.anchor - y);
      if (pos < -4) continue;
      const row = Math.floor(pos);
      s.rect(l, y, r - l, 1, g);
      s.rect(l, y, 2, 1, mix(g, "#000000", 0.3));
      s.rect(r - 2, y, 2, 1, mix(g, "#ffffff", 0.2));
      if (row % 28 === 0) s.rect(l - 2, y, r - l + 4, 2, mix(g, "#000000", 0.35));
      const floor = Math.floor(row / 28), inFloor = row % 28;
      if (inFloor > 8 && inFloor < 22) {
        for (let wx = l + 5; wx < r - 7; wx += 9) {
          const lit = hash(floor * 31 + wx) > 0.45;
          s.rect(wx, y, 5, 1, lit ? (inFloor < 11 ? "#fff1b0" : "#ffd36b") : mix(g, "#000000", 0.45));
        }
      }
    }
    const gy = s.sy(0);
    if (gy < H) s.rect(0, gy, W, H - gy, mix(g, "#000000", 0.5));
    s.props((side: number) => (side < 0 ? W * 0.11 : W * 0.89), 160, 12);
  },

  dig(this: SceneView, _c, t) {
    const s = this as S;
    const { W, H } = s;
    const sc = s.w.scene;
    const surface = s.sy(0);
    for (let y = 0; y < H; y++) {
      const pos = s.cam + (y - H * s.anchor);
      if (pos < 0) {
        s.rect(0, y, W, 1, mix(sc.start[0], sc.start[1], Math.max(0, 1 - (surface - y) / 60)));
        continue;
      }
      const layer = Math.floor(pos / 90);
      const base = mix(sc.ground, sc.end[1], Math.min(1, pos / 1500));
      const col = layer % 2 ? mix(base, "#000000", 0.12) : base;
      s.rect(0, y, W, 1, col);
      const row = Math.floor(pos);
      if (hash(row * 1.3) > 0.6) s.rect(hash(row * 7) * W, y, 2, 1, mix(col, "#ffffff", 0.15));
      if (hash(row * 2.9) > 0.85) s.rect(hash(row * 11) * W, y, 3, 2, mix(col, "#000000", 0.3));
    }
    if (surface > 0 && surface < H) {
      s.rect(0, surface - 3, W, 3, "#6fb24a");
      for (let x = 3; x < W; x += 13) s.rect(x, surface - 9, 3, 6, "#3f7a32");
    }
    // the shaft you've dug
    const top = Math.max(0, surface);
    const bottom = H * s.anchor + 6;
    if (bottom > top) s.rect(W / 2 - 7, top, 14, bottom - top, "rgba(0,0,0,0.35)");
    s.props((side: number) => (side < 0 ? W * 0.2 : W * 0.8), 120, 12);
    void t;
  },

  trail(this: SceneView, _c, t) {
    const s = this as S;
    const { W, H } = s;
    s.skyGradient("", "");
    s.clouds(t, 0.4);
    const g = s.w.scene.ground;
    for (let y = 0; y < H; y++) {
      const pos = s.cam + (H * s.anchor - y);
      const row = Math.floor(pos);
      const hillTop = s.sy(-20) - 160;
      if (y < hillTop - s.cam * 0.2) continue;
      s.rect(0, y, W, 1, row % 40 < 20 ? g : mix(g, "#000000", 0.06));
      const cx = s.trailX(pos);
      s.rect(cx - 5, y, 10, 1, "#c9a86a");
      if (hash(row * 1.9) > 0.75) s.rect(hash(row * 5) * W, y, 1, 1, mix(g, "#ffffff", 0.25));
    }
    // trees
    for (let i = Math.max(0, Math.floor((s.cam - H) / 23)); i < (s.cam + H) / 23 + 1; i++) {
      const pos = i * 23 + hash(i) * 10;
      const y = s.sy(pos);
      if (y < -14 || y > H + 4) continue;
      const cx = s.trailX(pos);
      const x = hash(i * 3.3) > 0.5 ? cx + 12 + hash(i * 7) * (W * 0.3) : cx - 14 - hash(i * 5) * (W * 0.3);
      const tg = mix(g, "#000000", 0.35);
      s.rect(x - 1, y - 2, 2, 4, "#6b4a2b");
      s.rect(x - 4, y - 6, 8, 4, tg);
      s.rect(x - 3, y - 9, 6, 3, tg);
      s.rect(x - 1, y - 11, 2, 2, tg);
    }
    s.props((side: number, i: number) => s.trailX(i * 150 + 60) + side * 20, 150, 11);
  },

  kitchen(this: SceneView, _c, t) {
    const s = this as S;
    const { W, H } = s;
    const sc = s.w.scene;
    const tile = mix(sc.start[1], sc.end[1], s.frac);
    for (let y = 0; y < H; y++) {
      const pos = s.cam + (H * s.anchor - y);
      const row = Math.floor(pos);
      s.rect(0, y, W, 1, tile);
      if (row % 12 === 0) s.rect(0, y, W, 1, mix(tile, "#000000", 0.08));
    }
    for (let x = 0; x < W; x += 12) s.rect(x, 0, 1, H, mix(tile, "#000000", 0.06));
    // shelves with props sitting on them
    const p = sc.props;
    for (let i = Math.max(0, Math.floor((s.cam - H) / 70)); i < (s.cam + H) / 70 + 1; i++) {
      const y = s.sy(i * 70 + 30);
      if (y < -20 || y > H + 10) continue;
      const left = i % 2 === 0;
      const x0 = left ? 0 : W * 0.55, x1 = left ? W * 0.45 : W;
      s.rect(x0, y, x1 - x0, 3, sc.ground);
      s.rect(x0, y + 3, x1 - x0, 1, mix(sc.ground, "#000000", 0.35));
      for (let k = 0; k < 2; k++) s.emoji(p[(i * 2 + k) % p.length], x0 + 10 + k * 16 + (left ? 0 : 8), y - 6, 11);
    }
    const gy = s.sy(0);
    if (gy < H) {
      s.rect(0, gy, W, H - gy, sc.ground);
      s.rect(0, gy, W, 2, mix(sc.ground, "#ffffff", 0.25));
    }
    void t;
  },
};

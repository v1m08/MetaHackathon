// sq: the game kit generated games run on. It owns everything LLM-written code tends to get wrong:
// canvas scaling, the fixed-step loop, input edges, the house art style, juice and sound. A game is
//   export default function game(sq) { return { update(dt) {...}, render() {...} } }
// and reports its result by setting sq.score and calling sq.end().
// The public surface is documented in kit/API.md, which is also what the model reads.
import { Audio } from "../client/src/engine/audio";
import { Input } from "../client/src/engine/input";
import { Juice } from "../client/src/engine/juice";
import { Sprites } from "../client/src/engine/sprites";
import { clamp, font, hexA, lerp, mix, rng, W } from "../client/src/engine/util";
import { ensureContrast, parseHex } from "../shared/schema";

export interface Palette {
  bg: string;
  bg2: string;
  primary: string;
  accent: string;
  danger: string;
  text: string;
  ink: string;
}
export interface GameModule {
  update(dt: number): void;
  render(): void;
}
export type GameFactory = (sq: Sq) => GameModule;

const STEP = 1 / 120;
const MAX_ROUND = 90;

export type Sq = ReturnType<typeof createKit>;

export interface KitOptions {
  canvas?: HTMLCanvasElement;
  seed?: number;
  palette?: Partial<Palette>;
  /** Headless: no DOM, render() is skipped by the runner. */
  headless?: boolean;
  h?: number;
  onEnd?: (r: { score: number; won: boolean }) => void;
}

function fixPalette(p: Partial<Palette> = {}): Palette {
  const ok = (v: unknown, d: string) => (typeof v === "string" && parseHex(v) ? v : d);
  const bg = ok(p.bg, "#24324a");
  const out: Palette = {
    bg,
    bg2: ok(p.bg2, mix(bg, "#000000", 0.3)),
    primary: ok(p.primary, "#ffb020"),
    accent: ok(p.accent, "#4fd1a5"),
    danger: ok(p.danger, "#ff5a5f"),
    text: ok(p.text, "#ffffff"),
    ink: ok(p.ink, "#1d2330"),
  };
  out.text = ensureContrast(out.text, out.bg, 4.5);
  out.primary = ensureContrast(out.primary, out.bg, 2.6);
  out.accent = ensureContrast(out.accent, out.bg, 2);
  out.danger = ensureContrast(out.danger, out.bg, 2.2);
  return out;
}

export function createKit(opts: KitOptions = {}) {
  const H = opts.h ?? 844;
  const r = rng(opts.seed ?? (Date.now() >>> 0));
  const juice = new Juice();
  const audio = new Audio();
  const input = new Input();
  let ctx: CanvasRenderingContext2D = (opts.canvas?.getContext("2d") ?? nullCtx()) as CanvasRenderingContext2D;
  let sprites: Sprites | null = opts.headless ? null : new Sprites(2);
  const palette = fixPalette(opts.palette);
  let ended = false;
  let lastBanner = -10;
  let comboCount = 0;
  let comboT = 0;

  const rand = Object.assign(() => r.next(), {
    range: r.range,
    int: r.int,
    pick: r.pick,
    chance: r.chance,
  });

  // ---------- drawing: the house style ----------
  const draw = {
    /** Vertical gradient background over the whole stage. */
    bg(top = palette.bg, bottom = palette.bg2) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, top);
      g.addColorStop(1, bottom);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    },
    /** Layered silhouettes (hills, buildings, cliffs) scrolling at different speeds. */
    bands(colors: string[], offset = 0, opts2: { y?: number; amp?: number; jag?: boolean } = {}) {
      const baseY = opts2.y ?? H * 0.55;
      colors.forEach((c, k) => {
        const y = baseY + k * 70;
        const amp = (opts2.amp ?? 40) * (1 - k * 0.15);
        const off = offset * (0.2 + k * 0.25);
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(0, H);
        for (let x = 0; x <= W + 10; x += opts2.jag ? 26 : 10) {
          const s = (x + off) / 70 + k * 13;
          const h = opts2.jag ? Math.abs(Math.sin(s) * amp) + Math.abs(Math.sin(s * 2.3)) * amp * 0.5 : Math.sin(s) * amp + Math.sin(s * 2.7) * amp * 0.35;
          ctx.lineTo(x, y - h);
        }
        ctx.lineTo(W, H);
        ctx.fill();
      });
    },
    /** A chunky rounded block with a darker side, top highlight and soft shadow: the house look for objects. */
    block(x: number, y: number, w: number, h: number, o: { color?: string; r?: number; depth?: number; rot?: number; shadow?: boolean } = {}) {
      const color = o.color ?? palette.primary;
      const rad = o.r ?? Math.min(w, h) * 0.22;
      const d = o.depth ?? Math.min(8, h * 0.18);
      ctx.save();
      ctx.translate(x, y);
      if (o.rot) ctx.rotate(o.rot);
      if (o.shadow !== false) {
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        rr(-w / 2 + 3, -h / 2 + d + 4, w, h, rad);
        ctx.fill();
      }
      ctx.fillStyle = mix(color, "#000000", 0.32);
      rr(-w / 2, -h / 2 + d, w, h, rad);
      ctx.fill();
      const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
      g.addColorStop(0, mix(color, "#ffffff", 0.22));
      g.addColorStop(1, color);
      ctx.fillStyle = g;
      rr(-w / 2, -h / 2, w, h, rad);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.28)";
      rr(-w / 2 + rad * 0.5, -h / 2 + 2, w - rad, Math.max(2, h * 0.12), rad * 0.5);
      ctx.fill();
      ctx.restore();
    },
    /** A shaded ball with highlight. */
    ball(x: number, y: number, rad: number, o: { color?: string; shadow?: boolean } = {}) {
      const color = o.color ?? palette.primary;
      if (o.shadow !== false) {
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.beginPath();
        ctx.ellipse(x + 3, y + rad * 0.95, rad * 0.9, rad * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      const g = ctx.createRadialGradient(x - rad * 0.35, y - rad * 0.4, rad * 0.1, x, y, rad);
      g.addColorStop(0, mix(color, "#ffffff", 0.45));
      g.addColorStop(0.6, color);
      g.addColorStop(1, mix(color, "#000000", 0.3));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    },
    /** Free-form polygon (terrain, walls, ramps) with an outline-free soft fill and optional top edge highlight. */
    poly(points: [number, number][], o: { color?: string; edge?: string; edgeWidth?: number } = {}) {
      if (points.length < 3) return;
      ctx.fillStyle = o.color ?? palette.bg2;
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (const p of points.slice(1)) ctx.lineTo(p[0], p[1]);
      ctx.closePath();
      ctx.fill();
      if (o.edge) {
        ctx.strokeStyle = o.edge;
        ctx.lineWidth = o.edgeWidth ?? 4;
        ctx.lineJoin = "round";
        ctx.stroke();
      }
    },
    /** Thick rounded line (ropes, rails, limbs, trails). */
    line(points: [number, number][], o: { color?: string; width?: number; alpha?: number; dash?: number[] } = {}) {
      if (points.length < 2) return;
      ctx.save();
      ctx.globalAlpha = o.alpha ?? 1;
      ctx.strokeStyle = o.color ?? palette.text;
      ctx.lineWidth = o.width ?? 4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (o.dash) ctx.setLineDash(o.dash);
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (const p of points.slice(1)) ctx.lineTo(p[0], p[1]);
      ctx.stroke();
      ctx.restore();
    },
    /**
     * A character: round head, torso, and four limbs that bend naturally (two-bone IK) to reach the given
     * hand/foot targets. Great for climbers, skaters, dancers, athletes. Omit a target for a relaxed pose.
     */
    figure(f: {
      x: number;
      y: number;
      scale?: number;
      color?: string;
      skin?: string;
      lean?: number;
      lh?: [number, number];
      rh?: [number, number];
      lf?: [number, number];
      rf?: [number, number];
      hat?: string;
      face?: "happy" | "focus" | "ouch";
    }) {
      const s = f.scale ?? 1;
      const color = f.color ?? palette.primary;
      const skin = f.skin ?? "#f2c7a5";
      const lean = f.lean ?? 0;
      const hip: [number, number] = [f.x, f.y];
      const neck: [number, number] = [f.x + Math.sin(lean) * 34 * s, f.y - Math.cos(lean) * 34 * s];
      const sh = (side: number): [number, number] => [neck[0] + side * 9 * s, neck[1] + 4 * s];
      const hp = (side: number): [number, number] => [hip[0] + side * 7 * s, hip[1]];
      const limb = (from: [number, number], to: [number, number] | undefined, len: number, bendDir: number, rest: [number, number]) => {
        const target = to ?? [from[0] + rest[0] * s, from[1] + rest[1] * s];
        const [mx, my] = ik(from, target, len * s, len * s, bendDir);
        return [from, [mx, my] as [number, number], clampReach(from, target, len * 2 * s)];
      };
      const arms = [limb(sh(-1), f.lh, 15, -1, [-14, 22]), limb(sh(1), f.rh, 15, 1, [14, 22])];
      const legs = [limb(hp(-1), f.lf, 18, 1, [-6, 34]), limb(hp(1), f.rf, 18, -1, [6, 34])];
      const dark = mix(color, "#000000", 0.35);
      const lw = 7 * s;
      // back limbs darker for depth
      draw.line(arms[0], { color: dark, width: lw });
      draw.line(legs[0], { color: mix(palette.ink, color, 0.3), width: lw * 1.1 });
      draw.line([hip, neck], { color, width: 15 * s });
      draw.line(legs[1], { color: mix(palette.ink, color, 0.45), width: lw * 1.1 });
      draw.line(arms[1], { color, width: lw });
      for (const a of arms) draw.ball(a[2][0], a[2][1], 4 * s, { color: skin, shadow: false });
      const head: [number, number] = [neck[0] + Math.sin(lean) * 12 * s, neck[1] - Math.cos(lean) * 12 * s];
      draw.ball(head[0], head[1], 11 * s, { color: skin, shadow: false });
      ctx.fillStyle = palette.ink;
      const face = f.face ?? "focus";
      ctx.beginPath();
      ctx.arc(head[0] - 3.5 * s, head[1] - 1 * s, 1.6 * s, 0, Math.PI * 2);
      ctx.arc(head[0] + 3.5 * s, head[1] - 1 * s, 1.6 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = palette.ink;
      ctx.lineWidth = 1.6 * s;
      ctx.beginPath();
      if (face === "happy") ctx.arc(head[0], head[1] + 2.5 * s, 3.5 * s, 0.2, Math.PI - 0.2);
      else if (face === "ouch") ctx.arc(head[0], head[1] + 5 * s, 2.5 * s, 0, Math.PI * 2);
      else {
        ctx.moveTo(head[0] - 3 * s, head[1] + 4 * s);
        ctx.lineTo(head[0] + 3 * s, head[1] + 4 * s);
      }
      ctx.stroke();
      if (f.hat) draw.emoji(f.hat, head[0], head[1] - 12 * s, 18 * s);
    },
    /** An emoji, as a small accent or prop (not as the main character art). */
    emoji(e: string, x: number, y: number, size = 32, o: { rot?: number; alpha?: number; flip?: boolean } = {}) {
      sprites?.draw(ctx, e, x, y, size, o);
    },
    /** Outlined, legible text in the house font. */
    text(str: string, x: number, y: number, o: { size?: number; color?: string; align?: CanvasTextAlign; weight?: number; outline?: boolean; alpha?: number } = {}) {
      ctx.save();
      ctx.globalAlpha = o.alpha ?? 1;
      ctx.font = font(o.size ?? 22, o.weight ?? 700);
      ctx.textAlign = o.align ?? "center";
      ctx.textBaseline = "middle";
      const fill = o.color ?? palette.text;
      if (o.outline !== false) {
        // outline is the opposite of the fill so text reads on any background
        const rgb = parseHex(fill.startsWith("#") ? fill : palette.text) ?? [255, 255, 255];
        const lightFill = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000 > 140;
        ctx.lineWidth = Math.max(3, (o.size ?? 22) / 6);
        ctx.strokeStyle = lightFill ? mix(palette.bg, "#000000", 0.55) : "rgba(255,255,255,0.75)";
        ctx.lineJoin = "round";
        ctx.strokeText(str, x, y);
      }
      ctx.fillStyle = fill;
      ctx.fillText(str, x, y);
      ctx.restore();
    },
    /** Soft ground shadow under an object. */
    shadow(x: number, y: number, w: number, alpha = 0.22) {
      ctx.fillStyle = `rgba(0,0,0,${alpha})`;
      ctx.beginPath();
      ctx.ellipse(x, y, w / 2, w / 7, 0, 0, Math.PI * 2);
      ctx.fill();
    },
    /** A progress/meter bar (stamina, power, grip). value 0..1. */
    meter(x: number, y: number, w: number, value: number, o: { color?: string; label?: string; h?: number } = {}) {
      const h = o.h ?? 12;
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      rr(x, y, w, h, h / 2);
      ctx.fill();
      const v = clamp(value, 0, 1);
      ctx.fillStyle = o.color ?? (v < 0.25 ? palette.danger : palette.accent);
      if (v > 0.01) {
        rr(x, y, w * v, h, h / 2);
        ctx.fill();
      }
      if (o.label) draw.text(o.label, x, y - 12, { size: 13, align: "left", weight: 600 });
    },
    /** Alpha helper: hexA("#ff0000", 0.5) → "rgba(...)". mix(a, b, t) blends two hex colors. */
    hexA,
    mix,
  };
  function rr(x: number, y: number, w: number, h: number, rad: number) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, Math.max(0, Math.min(rad, w / 2, h / 2)));
  }

  // ---------- juice: one call = visual + motion + sound ----------
  const fx = {
    /** Something good happened at (x,y): sparks, a small bump, a rising note. */
    hit(x: number, y: number, text?: string) {
      comboCount = comboT > 0 ? comboCount + 1 : 1;
      comboT = 1.6;
      juice.burst(x, y, palette.accent, 14, 260, { gravity: 300 });
      juice.burst(x, y, "#ffffff", 5, 200, { gravity: 300 });
      juice.shake(0.12);
      audio.step(Math.min(comboCount, 12));
      if (text) juice.float(x, y - 24, text, palette.text, 24);
    },
    /** Collected something worth `points` (adds to sq.score). */
    collect(x: number, y: number, points = 10) {
      sq.score += points;
      fx.hit(x, y, `+${points}`);
    },
    /** Something bad: red burst, big shake, a short freeze, a thud. */
    miss(x: number, y: number, text?: string) {
      comboCount = 0;
      juice.burst(x, y, palette.danger, 24, 340);
      juice.shake(0.65);
      juice.freeze(0.08);
      juice.flash(palette.danger, 0.3);
      audio.thud();
      if (text) juice.float(x, y - 30, text, palette.danger, 26);
    },
    /** Big moment callout (rate limited so it never spams). */
    banner(text: string, color = palette.primary) {
      if (sq.t - lastBanner < 2.2) return;
      lastBanner = sq.t;
      juice.announce(text, color, 1.1);
      audio.word(6, true);
    },
    burst(x: number, y: number, color = palette.accent, n = 12, speed = 240) {
      juice.burst(x, y, color, n, speed);
    },
    float(x: number, y: number, text: string, color = palette.text, size = 22) {
      juice.float(x, y, text, color, size);
    },
    shake(amount = 0.3) {
      juice.shake(amount);
    },
    freeze(sec = 0.06) {
      juice.freeze(sec);
    },
  };

  const sfx = {
    tap: () => audio.step(0),
    note: (i: number) => audio.step(i),
    good: (len = 4) => audio.word(len, false),
    great: () => audio.word(7, true),
    bad: () => audio.thud(),
    whoosh: () => audio.play("whoosh"),
    tick: () => audio.tick(false),
    win: () => audio.finish(),
  };

  const hud = { lives: undefined as number | undefined, maxLives: undefined as number | undefined, time: undefined as number | undefined, label: "" };

  const sq = {
    W,
    H,
    /** Seconds since the round started. */
    t: 0,
    score: 0,
    rand,
    input,
    palette,
    get ctx() {
      return ctx;
    },
    draw,
    fx,
    sfx,
    hud,
    clamp,
    lerp,
    /** Finish the round. Score is sq.score. */
    end(o: { won?: boolean } = {}) {
      if (ended) return;
      ended = true;
      audio.finish();
      opts.onEnd?.({ score: Math.max(0, Math.round(sq.score)), won: o.won ?? true });
    },
    get ended() {
      return ended;
    },
  };

  // ---------- internals used by the runner ----------
  const internals = {
    juice,
    audio,
    setCtx(c: CanvasRenderingContext2D) {
      ctx = c;
    },
    setSprites(s: Sprites) {
      sprites = s;
    },
    /** Called once per fixed step after game.update. */
    afterStep(dt: number) {
      comboT = Math.max(0, comboT - dt);
      if (!ended && sq.t > MAX_ROUND) sq.end();
    },
    drawHud() {
      draw.text(Math.floor(sq.score).toLocaleString(), 16, 34, { size: 32, align: "left", weight: 800 });
      if (hud.label) draw.text(hud.label, 16, 64, { size: 14, align: "left", weight: 600 });
      if (hud.time !== undefined) {
        const t = Math.max(0, hud.time);
        draw.text(`${Math.ceil(t)}s`, W - 16, 34, { size: 26, align: "right", weight: 800, color: t < 5.5 ? palette.danger : palette.text });
      }
      if (hud.lives !== undefined) {
        const max = hud.maxLives ?? hud.lives;
        for (let i = 0; i < max; i++) draw.text("♥", W - 22 - i * 26, hud.time !== undefined ? 64 : 34, { size: 22, color: i < hud.lives ? palette.danger : hexA(palette.text, 0.25) });
      }
    },
  };
  return Object.assign(sq, { _: internals });
}

/** Two-bone IK: elbow/knee position for a limb from `a` reaching toward `b`. */
function ik(a: [number, number], b: [number, number], l1: number, l2: number, bend: number): [number, number] {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const d = clamp(Math.hypot(dx, dy), 1e-3, l1 + l2 - 1e-3);
  const ang = Math.atan2(dy, dx);
  const cos = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const off = Math.acos(cos) * bend;
  return [a[0] + Math.cos(ang + off) * l1, a[1] + Math.sin(ang + off) * l1];
}
function clampReach(a: [number, number], b: [number, number], max: number): [number, number] {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const d = Math.hypot(dx, dy);
  return d <= max ? b : [a[0] + (dx / d) * max, a[1] + (dy / d) * max];
}

/** A canvas context that accepts every call and draws nothing (headless playtests). */
export function nullCtx(): CanvasRenderingContext2D {
  const grad = { addColorStop() {} };
  const handler: ProxyHandler<object> = {
    get(_t, k) {
      if (k === "createLinearGradient" || k === "createRadialGradient" || k === "createPattern") return () => grad;
      if (k === "measureText") return (s: string) => ({ width: String(s).length * 10 });
      if (k === "canvas") return { width: 390, height: 844 };
      return () => undefined;
    },
    set() {
      return true;
    },
  };
  return new Proxy({}, handler) as CanvasRenderingContext2D;
}

export { lerp, clamp };

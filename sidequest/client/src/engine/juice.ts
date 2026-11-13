// Screen shake, particles, hit stop, flashes and floating text. Pure state + a render pass, so templates
// can call it from update() in a headless test too.
import { clamp, font, hexA } from "./util";
import type { Sprites } from "./sprites";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color?: string;
  emoji?: string;
  rot: number;
  vr: number;
  gravity: number;
}
interface Floater {
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  life: number;
  max: number;
}

export class Juice {
  trauma = 0;
  hitstop = 0;
  flashA = 0;
  flashColor = "#ffffff";
  particles: Particle[] = [];
  floaters: Floater[] = [];
  /** Big centered banner (combo callouts, "RUSH HOUR!"). */
  banner: { text: string; color: string; life: number; max: number } | null = null;
  constructor(private rand: () => number = Math.random) {}

  shake(amount: number) {
    this.trauma = clamp(this.trauma + amount, 0, 1);
  }
  freeze(sec: number) {
    this.hitstop = Math.max(this.hitstop, sec);
  }
  flash(color: string, a = 0.35) {
    this.flashColor = color;
    this.flashA = Math.max(this.flashA, a);
  }
  burst(x: number, y: number, color: string, n = 14, speed = 260, opts: { gravity?: number; size?: number; emoji?: string } = {}) {
    for (let i = 0; i < n; i++) {
      const a = this.rand() * Math.PI * 2;
      const s = speed * (0.35 + this.rand() * 0.65);
      const life = 0.35 + this.rand() * 0.4;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life,
        max: life,
        size: (opts.size ?? 6) * (0.6 + this.rand() * 0.8),
        color,
        emoji: opts.emoji,
        rot: this.rand() * 6,
        vr: (this.rand() - 0.5) * 12,
        gravity: opts.gravity ?? 500,
      });
    }
    if (this.particles.length > 400) this.particles.splice(0, this.particles.length - 400);
  }
  float(x: number, y: number, text: string, color: string, size = 26) {
    this.floaters.push({ x, y, text, color, size, life: 0.9, max: 0.9 });
    if (this.floaters.length > 20) this.floaters.shift();
  }
  announce(text: string, color: string, sec = 1.1) {
    this.banner = { text, color, life: sec, max: sec };
  }

  /** Real-time update (runs during hitstop too). */
  update(dt: number) {
    this.trauma = Math.max(0, this.trauma - dt * 1.8);
    this.flashA = Math.max(0, this.flashA - dt * 2.5);
    for (const p of this.particles) {
      p.life -= dt;
      p.vy += p.gravity * dt;
      p.vx *= 1 - 2 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const f of this.floaters) {
      f.life -= dt;
      f.y -= 60 * dt;
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    if (this.banner && (this.banner.life -= dt) <= 0) this.banner = null;
  }

  shakeOffset(t: number): [number, number] {
    const s = this.trauma * this.trauma * 14;
    return [Math.sin(t * 91) * s, Math.cos(t * 77) * s];
  }

  renderParticles(ctx: CanvasRenderingContext2D, sprites: Sprites) {
    for (const p of this.particles) {
      const a = clamp(p.life / p.max, 0, 1);
      if (p.emoji) {
        sprites.draw(ctx, p.emoji, p.x, p.y, p.size * 3, { rot: p.rot, alpha: a });
      } else {
        ctx.fillStyle = hexA(p.color!, a);
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size * a + 1, p.size * a + 1);
      }
    }
  }

  renderOverlay(ctx: CanvasRenderingContext2D, w: number, h: number, textColor: string, outline: string) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const f of this.floaters) {
      const t = 1 - f.life / f.max;
      const scale = t < 0.15 ? 0.6 + (t / 0.15) * 0.6 : 1.2 - Math.min(0.2, (t - 0.15) * 0.6);
      ctx.globalAlpha = clamp(f.life / 0.3, 0, 1);
      ctx.font = font(f.size * scale, 700);
      // keep floating text fully on screen
      const half = ctx.measureText(f.text).width / 2;
      const fx = half * 2 > w - 16 ? w / 2 : clamp(f.x, half + 8, w - half - 8);
      ctx.lineWidth = 5;
      ctx.strokeStyle = outline;
      ctx.strokeText(f.text, fx, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, fx, f.y);
    }
    ctx.globalAlpha = 1;
    if (this.banner) {
      const b = this.banner;
      const t = 1 - b.life / b.max;
      const s = t < 0.12 ? 0.5 + (t / 0.12) * 0.7 : t > 0.8 ? 1.2 - (t - 0.8) * 2 : 1.2 - (t - 0.12) * 0.25;
      ctx.save();
      ctx.translate(w / 2, h * 0.38);
      ctx.rotate(-0.06);
      ctx.font = font(40, 700);
      const fit = Math.min(1, (w - 48) / (ctx.measureText(b.text).width * 1.2));
      ctx.scale(s * fit, s * fit);
      ctx.globalAlpha = clamp(b.life / 0.2, 0, 1);
      ctx.lineWidth = 8;
      ctx.strokeStyle = outline;
      ctx.strokeText(b.text, 0, 0);
      ctx.fillStyle = b.color;
      ctx.fillText(b.text, 0, 0);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    if (this.flashA > 0) {
      ctx.fillStyle = hexA(this.flashColor, this.flashA);
      ctx.fillRect(0, 0, w, h);
    }
    void textColor;
  }
}

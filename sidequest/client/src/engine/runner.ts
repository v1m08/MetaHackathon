// Browser side of the engine: canvas sizing (DPR aware), fixed-timestep loop, pause on tab blur, HUD.
import type { GameConfig } from "../../../shared/schema";
import type { Audio } from "./audio";
import { Engine, type GameInstance, type GameTemplate, type Hud } from "./engine";
import { Sprites } from "./sprites";
import { clamp, font, hexA, mix, W } from "./util";

const STEP = 1 / 120; // fixed update rate; smooth on both 60 and 120 Hz screens

export interface RunResult {
  score: number;
  won: boolean;
  par: number;
}

export class Runner {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private scale = 1;
  private dpr = 1;
  private raf = 0;
  private stopped = false;
  private hidden = false;
  private cleanups: (() => void)[] = [];
  sprites!: Sprites;
  logicalH = 844;
  private engine: Engine | null = null;

  constructor(private host: HTMLElement, private audio: Audio) {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "game-canvas";
    host.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d", { alpha: false })!;
    this.resize();
    const onResize = () => this.resize();
    window.addEventListener("resize", onResize);
    const onVis = () => (this.hidden = document.hidden);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onVis);
    this.cleanups.push(() => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onVis);
    });
  }

  private resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    // Width is always 390 logical px; height follows the screen's aspect so phones fill edge to edge.
    this.logicalH = Math.round(clamp((W * vh) / vw, 640, 900));
    this.scale = Math.min(vw / W, vh / this.logicalH);
    this.dpr = Math.min(3, window.devicePixelRatio || 1);
    const cw = Math.round(W * this.scale), ch = Math.round(this.logicalH * this.scale);
    this.canvas.style.width = cw + "px";
    this.canvas.style.height = ch + "px";
    this.canvas.width = Math.round(cw * this.dpr);
    this.canvas.height = Math.round(ch * this.dpr);
    this.sprites = new Sprites(this.dpr * this.scale);
    if (this.engine) this.engine.sprites = this.sprites;
  }

  /** `seed`: everyone in a room gets the same course. `bot`: the template plays itself (demos, screenshots). */
  run(cfg: GameConfig, template: GameTemplate, onEnd: (r: RunResult) => void, opts: { seed?: number; bot?: boolean } = {}) {
    const engine = new Engine(cfg, { audio: this.audio, h: this.logicalH, seed: opts.seed });
    engine.sprites = this.sprites;
    this.engine = engine;
    const rect = () => this.canvas.getBoundingClientRect();
    engine.input.attach(
      this.canvas,
      (cx, cy) => {
        const r = rect();
        return [((cx - r.left) / r.width) * W, ((cy - r.top) / r.height) * this.logicalH];
      },
      () => this.audio.unlock(),
    );
    const game = template.create(cfg, engine);
    engine.juice.announce(cfg.copy.start, cfg.palette.accent, 1.2);
    this.audio.play("start");

    let last = performance.now();
    let acc = 0;
    let overFor = -1;
    let botX = W / 2;
    const frame = (now: number) => {
      if (this.stopped) return;
      this.raf = requestAnimationFrame(frame);
      let dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (this.hidden) dt = 0;
      engine.juice.update(dt);
      if (overFor < 0) {
        if (engine.juice.hitstop > 0) engine.juice.hitstop -= dt;
        else {
          acc += dt;
          let n = 0;
          while (acc >= STEP && n++ < 24) {
            if (opts.bot) {
              const a = game.bot();
              if (a.targetX !== undefined) engine.input.dragDX = Math.max(-8, Math.min(8, a.targetX - botX)) / 1.15;
              if (a.targetX !== undefined) botX += Math.max(-8, Math.min(8, a.targetX - botX));
              if (a.tap) engine.input.tapped = true;
              if (a.choice !== undefined) engine.input.numKey = a.choice + 1;
            }
            game.update(STEP);
            engine.time += STEP;
            engine.input.endStep(STEP);
            acc -= STEP;
            if (game.isOver()) {
              overFor = 0;
              const r = game.result();
              this.audio.play(r.won ? "win" : "lose");
              engine.juice.announce(r.won ? cfg.copy.win.split(/[.!]/)[0] + "!" : cfg.copy.lose.split(/[.!]/)[0], r.won ? cfg.palette.accent : cfg.palette.danger, 1.4);
              break;
            }
          }
        }
      } else {
        overFor += dt;
        if (overFor > 1.3) {
          const r = game.result();
          this.stop();
          game.destroy();
          engine.input.dispose();
          onEnd({ ...r, par: game.par });
          return;
        }
      }
      this.draw(engine, game);
    };
    this.raf = requestAnimationFrame(frame);
    this.cleanups.push(() => {
      engine.input.dispose();
      game.destroy();
    });
  }

  private draw(engine: Engine, game: GameInstance) {
    const ctx = this.ctx;
    const p = engine.cfg.palette;
    const k = this.scale * this.dpr;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.fillStyle = p.background;
    ctx.fillRect(0, 0, W, this.logicalH);
    const [sx, sy] = engine.juice.shakeOffset(engine.time + performance.now() / 1000);
    ctx.save();
    ctx.translate(sx, sy);
    game.render(ctx);
    engine.juice.renderParticles(ctx, this.sprites);
    ctx.restore();
    this.drawHud(ctx, engine, game.hud());
    engine.juice.renderOverlay(ctx, W, this.logicalH, p.text, mix(p.background, "#000000", 0.35));
  }

  private drawHud(ctx: CanvasRenderingContext2D, e: Engine, h: Hud) {
    const p = e.cfg.palette;
    const outline = mix(p.background, "#000000", 0.35);
    if (h.timeFrac !== undefined) {
      ctx.fillStyle = hexA(p.text, 0.15);
      ctx.fillRect(0, 0, W, 6);
      const low = (h.timeLeft ?? 99) < 5.5;
      ctx.fillStyle = low ? p.danger : p.primary;
      ctx.fillRect(0, 0, W * clamp(h.timeFrac, 0, 1), 6);
    }
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.lineWidth = 5;
    ctx.strokeStyle = outline;
    ctx.font = font(34, 700);
    const s = Math.floor(h.score).toLocaleString();
    ctx.strokeText(s, 16, 18);
    ctx.fillStyle = p.text;
    ctx.fillText(s, 16, 18);
    let y = 58;
    ctx.font = font(15, 600);
    if (h.label) {
      ctx.strokeText(h.label, 16, y);
      ctx.fillStyle = hexA(p.text, 0.85);
      ctx.fillText(h.label, 16, y);
      y += 20;
    }
    if (h.multiplier && h.multiplier > 1) {
      const t = `×${h.multiplier % 1 ? h.multiplier.toFixed(1) : h.multiplier}`;
      ctx.font = font(18, 700);
      ctx.strokeText(t, 16, y);
      ctx.fillStyle = p.accent;
      ctx.fillText(t, 16, y);
      y += 24;
    }
    if (h.combo && h.combo >= 2) {
      const pulse = 1 + Math.max(0, Math.sin(e.time * 10)) * 0.04;
      ctx.save();
      ctx.translate(16, y);
      ctx.scale(pulse, pulse);
      ctx.font = font(16, 700);
      ctx.strokeText(`${h.combo} combo`, 0, 0);
      ctx.fillStyle = p.primary;
      ctx.fillText(`${h.combo} combo`, 0, 0);
      ctx.restore();
    }
    if (h.lives !== undefined && h.maxLives) {
      ctx.textAlign = "right";
      ctx.font = font(24, 700);
      for (let i = 0; i < h.maxLives; i++) {
        const x = W - 70 - i * 28;
        ctx.strokeText("♥", x, 22);
        ctx.fillStyle = i < h.lives ? p.danger : hexA(p.text, 0.2);
        ctx.fillText("♥", x, 22);
      }
    }
    if (h.timeLeft !== undefined) {
      ctx.textAlign = "right";
      ctx.font = font(15, 600);
      const t = Math.ceil(h.timeLeft) + "s";
      ctx.strokeText(t, W - 70, 54);
      ctx.fillStyle = h.timeLeft < 5.5 ? p.danger : hexA(p.text, 0.85);
      ctx.fillText(t, W - 70, 54);
    }
  }

  stop() {
    this.stopped = true;
    cancelAnimationFrame(this.raf);
  }

  destroy() {
    this.stop();
    for (const c of this.cleanups) c();
    this.cleanups = [];
    this.canvas.remove();
  }
}

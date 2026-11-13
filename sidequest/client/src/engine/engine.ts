// Engine: what a template gets. Headless-safe (no DOM touched in update paths), so the bot test can run
// every template in Node. The browser loop/canvas lives in runner.ts.
import type { GameConfig, TemplateId } from "../../../shared/schema";
import { Audio } from "./audio";
import { Input } from "./input";
import { Juice } from "./juice";
import type { Sprites } from "./sprites";
import { H, rng, W, type Rng } from "./util";

export interface Hud {
  score: number;
  lives?: number;
  maxLives?: number;
  /** 0..1 of the round remaining, if timed. */
  timeFrac?: number;
  timeLeft?: number;
  combo?: number;
  multiplier?: number;
  /** Small text under the score, e.g. "Shot 4/10". */
  label?: string;
}

/** What a scripted bot wants to do this step. */
export interface BotAction {
  targetX?: number;
  tap?: boolean;
  choice?: number;
}

export interface GameInstance {
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D): void;
  isOver(): boolean;
  result(): { score: number; won: boolean };
  hud(): Hud;
  /** A score that feels "great" for this config; ranks are fractions of it. */
  par: number;
  /** Scripted play for the headless test. */
  bot(): BotAction;
  destroy(): void;
}

export interface GameTemplate {
  id: TemplateId;
  create(config: GameConfig, engine: Engine): GameInstance;
}

export class Engine {
  readonly W = W;
  /** Logical height: 844 by default; the runner sets it from the screen aspect (640..900). */
  H: number;
  /** Set by the runner; only used in render(), so headless tests can leave it unset. */
  sprites!: Sprites;
  input = new Input();
  rand: Rng;
  juice: Juice;
  audio: Audio;
  /** Seconds since the round started (game time, stops during hitstop/pause). */
  time = 0;
  private lineIdx: Record<string, number> = {};

  constructor(public cfg: GameConfig, opts: { seed?: number; audio?: Audio; h?: number } = {}) {
    this.H = opts.h ?? H;
    this.rand = rng(opts.seed);
    // juice gets its own randomness so particles never shift the seeded course
    this.juice = new Juice();
    this.audio = opts.audio ?? new Audio();
  }

  /** Next line from copy.hit / miss / combo, cycling so the same line never repeats twice in a row. */
  line(kind: "hit" | "miss" | "combo"): string {
    const arr = this.cfg.copy[kind];
    const i = (this.lineIdx[kind] = ((this.lineIdx[kind] ?? this.rand.int(0, arr.length - 1)) + 1) % arr.length);
    return arr[i];
  }

  has(mod: string) {
    return this.cfg.modifiers.includes(mod);
  }
  tune(key: string) {
    return this.cfg.tuning[key] ?? 0.5;
  }
  get difficulty() {
    return this.cfg.tuning.difficulty;
  }
}

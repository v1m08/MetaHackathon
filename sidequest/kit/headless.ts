// Headless playtest: runs a game with no DOM for a full round with scripted input. Used to reject games that
// crash, never end, end instantly, or ignore the player. Bundled to plain JS and run inside a worker.
import { createKit, type GameFactory } from "./sq";

export interface PlaytestResult {
  bot: string;
  ok: boolean;
  error?: string;
  ended: boolean;
  endedAt: number;
  score: number;
  nanState?: boolean;
  slowestStepMs: number;
}

const STEP = 1 / 120;

export function playtest(factory: GameFactory, opts: { seed: number; bot: "idle" | "random" | "tapper"; maxSeconds?: number }): PlaytestResult {
  const res: PlaytestResult = { bot: opts.bot, ok: true, ended: false, endedAt: 0, score: 0, slowestStepMs: 0 };
  let botSeed = opts.seed ^ 0x9e3779b9;
  const br = () => ((botSeed = (Math.imul(botSeed ^ (botSeed >>> 15), 2246822507) + 0x6d2b79f5) >>> 0) / 4294967296);
  try {
    const sq = createKit({ headless: true, seed: opts.seed, onEnd: () => (res.ended = true) });
    const game = factory(sq);
    if (!game || typeof game.update !== "function" || typeof game.render !== "function") throw new Error("game() must return { update(dt), render() }");
    const maxSteps = Math.round((opts.maxSeconds ?? 95) / STEP);
    let holdLeft = 0;
    for (let i = 0; i < maxSteps && !res.ended; i++) {
      const inp = sq.input;
      if (opts.bot === "random") {
        if (holdLeft <= 0 && br() < 0.012) {
          inp.tapped = true;
          inp.down = true;
          inp.tapX = inp.x = br() * 390;
          inp.tapY = inp.y = 200 + br() * 560;
          holdLeft = br() < 0.5 ? 0.08 : br() * 0.8;
        }
        if (inp.down) {
          inp.dragDX = (br() - 0.5) * 12;
          inp.x = Math.max(0, Math.min(390, inp.x + inp.dragDX));
          holdLeft -= STEP;
          if (holdLeft <= 0) inp.down = false;
        }
        if (br() < 0.002) inp.swipe = br() < 0.5 ? -1 : 1;
      } else if (opts.bot === "tapper") {
        if (i % 120 === 0) {
          inp.tapped = true;
          inp.tapX = inp.x = 195 + Math.sin(i / 90) * 150;
          inp.tapY = inp.y = 300 + Math.cos(i / 70) * 250;
        }
      }
      const t0 = performance.now();
      game.update(STEP);
      if (i % 30 === 0) game.render(); // exercise render paths against the null context
      res.slowestStepMs = Math.max(res.slowestStepMs, performance.now() - t0);
      sq.t += STEP;
      sq._.afterStep(STEP);
      sq._.juice.update(STEP);
      inp.endStep(STEP);
      if (!Number.isFinite(sq.score)) {
        res.nanState = true;
        throw new Error("score became NaN/Infinity");
      }
    }
    res.endedAt = Math.round(sq.t * 10) / 10;
    res.score = Math.round(sq.score);
  } catch (e) {
    res.ok = false;
    res.error = e instanceof Error ? `${e.message}\n${(e.stack ?? "").split("\n").slice(1, 4).join("\n")}` : String(e);
  }
  return res;
}

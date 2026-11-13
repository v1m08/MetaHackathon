// Browser entry for the sandboxed game frame. The page provides:
//   window.__SQ = { seed, palette }   and   window.__GAME (the generated module's default export)
// Runs the fixed-step loop, draws HUD and juice on top of the game, and reports the result to the parent.
import { Sprites } from "../client/src/engine/sprites";
import { clamp, mix, W } from "../client/src/engine/util";
import { createKit, type GameFactory, type Palette } from "./sq";

declare global {
  interface Window {
    __SQ?: { seed?: number; palette?: Partial<Palette>; title?: string };
    __GAME?: GameFactory;
  }
}

const STEP = 1 / 120;

function post(msg: unknown) {
  try {
    parent.postMessage(msg, "*");
  } catch {
    /* standalone */
  }
}

function showError(e: unknown) {
  const msg = e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e);
  post({ type: "error", message: msg.slice(0, 2000) });
  const pre = document.createElement("pre");
  pre.style.cssText = "position:fixed;inset:auto 0 0 0;max-height:40%;overflow:auto;margin:0;padding:10px;background:#300;color:#fdd;font:11px monospace;z-index:9";
  pre.textContent = "Game error: " + msg;
  document.body.appendChild(pre);
}

function boot() {
  const cfg = window.__SQ ?? {};
  const factory = window.__GAME;
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  const vw = innerWidth, vh = innerHeight;
  const H = Math.round(clamp((W * vh) / vw, 640, 900));
  const scale = Math.min(vw / W, vh / H);
  const dpr = Math.min(3, devicePixelRatio || 1);
  canvas.style.width = `${Math.round(W * scale)}px`;
  canvas.style.height = `${Math.round(H * scale)}px`;
  canvas.width = Math.round(W * scale * dpr);
  canvas.height = Math.round(H * scale * dpr);
  const ctx = canvas.getContext("2d", { alpha: false })!;

  let result: { score: number; won: boolean } | null = null;
  const sq = createKit({ canvas, seed: cfg.seed, palette: cfg.palette, h: H, onEnd: (r) => (result = r) });
  sq._.setCtx(ctx);
  const sprites = new Sprites(dpr * scale);
  sq._.setSprites(sprites);
  document.body.style.background = sq.palette.bg;
  sq.input.attach(
    canvas,
    (cx, cy) => {
      const rc = canvas.getBoundingClientRect();
      return [((cx - rc.left) / rc.width) * W, ((cy - rc.top) / rc.height) * H];
    },
    () => sq._.audio.unlock(),
  );

  const loadErr = (window as unknown as { __GAME_ERR?: unknown }).__GAME_ERR;
  if (loadErr) return showError(loadErr);
  if (typeof factory !== "function") return showError(new Error("no game function"));
  let game: ReturnType<GameFactory>;
  try {
    game = factory(sq);
    if (!game || typeof game.update !== "function" || typeof game.render !== "function") throw new Error("game() must return { update(dt), render() }");
  } catch (e) {
    return showError(e);
  }

  let started = false;
  let last = performance.now();
  let acc = 0;
  let endedFor = -1;
  let lastScore = -1;
  const k = scale * dpr;

  const frame = (now: number) => {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    try {
      sq._.juice.update(dt);
      if (started && endedFor < 0) {
        if (sq._.juice.hitstop > 0) sq._.juice.hitstop -= dt;
        else {
          acc += dt;
          let n = 0;
          while (acc >= STEP && n++ < 24) {
            game.update(STEP);
            sq.t += STEP;
            sq._.afterStep(STEP);
            sq.input.endStep(STEP);
            acc -= STEP;
            if (sq.ended) {
              endedFor = 0;
              break;
            }
          }
        }
      } else if (endedFor >= 0) {
        endedFor += dt;
        if (endedFor > 1.2 && result) {
          post({ type: "end", ...result });
          result = null;
        }
      }
      if (Math.round(sq.score) !== lastScore) {
        lastScore = Math.round(sq.score);
        post({ type: "score", score: lastScore });
      }
      ctx.setTransform(k, 0, 0, k, 0, 0);
      ctx.fillStyle = sq.palette.bg;
      ctx.fillRect(0, 0, W, H);
      const t = now / 1000;
      const s = sq._.juice.trauma ** 2 * 14;
      ctx.save();
      ctx.translate(Math.sin(t * 91) * s, Math.cos(t * 77) * s);
      game.render();
      sq._.juice.renderParticles(ctx, sprites);
      ctx.restore();
      ctx.setTransform(k, 0, 0, k, 0, 0);
      sq._.drawHud();
      sq._.juice.renderOverlay(ctx, W, H, sq.palette.text, mix(sq.palette.bg, "#000000", 0.45));
      if (!started) {
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(0, 0, W, H);
        sq.draw.text(cfg.title ?? "Ready?", W / 2, H * 0.42, { size: 34, weight: 800 });
        sq.draw.text("Tap to start", W / 2, H * 0.5, { size: 20, weight: 600, alpha: 0.6 + 0.4 * Math.sin(t * 4) });
      }
    } catch (e) {
      showError(e);
      throw e;
    }
  };
  const start = () => {
    if (started) return;
    started = true;
    sq._.audio.unlock();
    sq.input.reset();
  };
  canvas.addEventListener("pointerdown", start, { once: true });
  addEventListener("keydown", start, { once: true });
  addEventListener("message", (e) => {
    if (e.data?.type === "start") start();
  });
  if (new URLSearchParams(location.search).has("autostart")) start();
  post({ type: "ready" });
  requestAnimationFrame(frame);
}

addEventListener("error", (e) => showError(e.error ?? e.message));
if (document.readyState === "loading") addEventListener("DOMContentLoaded", boot);
else boot();

// trivia: five timed multiple-choice questions written by the LLM. Tap a choice (or press 1-4).
// Modifiers: speed_bonus, double_down.
import type { BotAction, Engine, GameInstance, GameTemplate } from "../engine/engine";
import { font, hexA, mix, roundRect, wrapText } from "../engine/util";

const PER_Q = 12;
const REVEAL = 1.3;

export const trivia: GameTemplate = {
  id: "trivia",
  create(cfg, e: Engine): GameInstance {
    const p = cfg.palette;
    const qs = cfg.trivia?.questions ?? [];
    const H = e.H;
    let qi = 0, left = PER_Q, score = 0, correct = 0, streak = 0;
    let picked = -1, reveal = 0, over = false, pop = 0;
    let qLines: string[] | null = null;
    const boxes = [0, 1, 2, 3].map((i) => ({ x: 24, y: H * 0.47 + i * 86, w: e.W - 48, h: 72 }));

    function answer(i: number) {
      const q = qs[qi];
      picked = i;
      reveal = REVEAL;
      if (i === q.answer) {
        correct++;
        streak++;
        let pts = 100 + (e.has("speed_bonus") ? Math.round(left * 10) : 0);
        if (e.has("double_down") && qi === qs.length - 1) pts *= 2;
        score += pts;
        pop = 1;
        const b = boxes[i];
        e.juice.burst(b.x + b.w / 2, b.y + b.h / 2, p.accent, 26, 360);
        e.juice.shake(0.2);
        e.juice.float(e.W / 2, b.y - 10, `${e.line("hit")} +${pts}`, p.accent, 26);
        e.audio.play(streak >= 3 ? "combo" : "hit", streak);
      } else {
        streak = 0;
        e.juice.shake(0.5);
        e.juice.flash(p.danger, 0.25);
        e.juice.float(e.W / 2, boxes[0].y - 30, i < 0 ? "Time!" : e.line("miss"), p.danger, 26);
        e.audio.play("miss");
      }
    }

    return {
      par: qs.length * 200,
      update(dt) {
        if (over) return;
        pop = Math.max(0, pop - dt * 3);
        if (reveal > 0) {
          reveal -= dt;
          if (reveal <= 0) {
            qi++;
            qLines = null;
            picked = -1;
            left = PER_Q;
            if (qi >= qs.length) over = true;
          }
          return;
        }
        left -= dt;
        if (left < 3.5 && Math.floor(left) !== Math.floor(left + dt)) e.audio.play("tick");
        if (left <= 0) return answer(-1);
        let choice = e.input.numKey - 1;
        if (e.input.tapped && e.input.tapX >= 0) {
          choice = boxes.findIndex((b) => e.input.tapX >= b.x && e.input.tapX <= b.x + b.w && e.input.tapY >= b.y && e.input.tapY <= b.y + b.h);
        }
        if (choice >= 0) answer(choice);
      },
      render(ctx) {
        const W = e.W;
        const g = ctx.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, p.background);
        g.addColorStop(1, mix(p.background, p.surface, 0.7));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        cfg.sprites.scenery.forEach((em, i) => e.sprites.draw(ctx, em, 50 + i * 95, H - 60 + Math.sin(e.time * 2 + i) * 5, 28, { alpha: 0.3 }));
        if (qi >= qs.length) return;
        const q = qs[qi];
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = font(14, 700);
        ctx.fillStyle = hexA(p.text, 0.6);
        ctx.fillText(`QUESTION ${qi + 1} OF ${qs.length}${e.has("double_down") && qi === qs.length - 1 ? " · DOUBLE POINTS" : ""}`, W / 2, H * 0.15);
        e.sprites.draw(ctx, cfg.sprites.player, W / 2, H * 0.215, 44, { sx: 1 + pop * 0.3, sy: 1 + pop * 0.3 });
        ctx.font = font(24, 600);
        if (!qLines) qLines = wrapText(ctx, q.q, W - 60);
        const lh = 30;
        const top = H * 0.33 - ((qLines.length - 1) * lh) / 2;
        ctx.fillStyle = p.text;
        qLines.forEach((l, i) => ctx.fillText(l, W / 2, top + i * lh));
        // timer bar
        ctx.fillStyle = hexA(p.text, 0.12);
        roundRect(ctx, 40, H * 0.42, W - 80, 8, 4);
        ctx.fill();
        ctx.fillStyle = left < 3.5 ? p.danger : p.primary;
        roundRect(ctx, 40, H * 0.42, (W - 80) * Math.max(0, left / PER_Q), 8, 4);
        ctx.fill();
        boxes.forEach((b, i) => {
          const isAns = i === q.answer;
          const showRight = reveal > 0 && isAns;
          const showWrong = reveal > 0 && i === picked && !isAns;
          ctx.fillStyle = showRight ? p.accent : showWrong ? p.danger : p.surface;
          roundRect(ctx, b.x, b.y, b.w, b.h, 18);
          ctx.fill();
          ctx.strokeStyle = hexA(p.text, 0.15);
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = showRight || showWrong ? mix(p.background, "#000000", 0.6) : hexA(p.text, 0.5);
          ctx.font = font(16, 700);
          ctx.textAlign = "left";
          ctx.fillText(String(i + 1), b.x + 20, b.y + b.h / 2);
          ctx.fillStyle = showRight || showWrong ? mix(p.background, "#000000", 0.6) : p.text;
          ctx.font = font(19, 600);
          const lines = wrapText(ctx, q.choices[i], b.w - 70).slice(0, 2);
          lines.forEach((l, k) => ctx.fillText(l, b.x + 46, b.y + b.h / 2 + (k - (lines.length - 1) / 2) * 22));
          ctx.textAlign = "center";
        });
      },
      isOver: () => over,
      result: () => ({ score, won: correct >= Math.ceil(qs.length * 0.6) }),
      hud: () => ({ score, label: `${correct}/${qs.length} correct`, combo: streak }),
      bot(): BotAction {
        if (reveal > 0 || qi >= qs.length || left > PER_Q - 1.5) return {};
        return { choice: qs[qi].answer };
      },
      destroy() {},
    };
  },
};

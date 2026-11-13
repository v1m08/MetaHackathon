// shot: timing + aim. An aim arrow swings; tap to release. 10 attempts; the target shrinks and moves.
// Modifiers: wind, moving_target, streak_fire, defender.
import type { BotAction, Engine, GameInstance, GameTemplate } from "../engine/engine";
import { clamp, diffScale, font, hexA, lerp, mix, roundRect } from "../engine/util";

const SHOTS = 10;
const FLIGHT = 0.8;
const SHOT_CLOCK = 5;
const MAX_ANGLE = 0.5; // radians either side

export const shot: GameTemplate = {
  id: "shot",
  create(cfg, e: Engine): GameInstance {
    const p = cfg.palette;
    const s = cfg.sprites;
    const H = e.H;
    const ballY = H - 150;
    const targetY = Math.round(H * 0.3);
    const ballX = e.W / 2;
    const ds = diffScale(e.difficulty);
    const swing = lerp(1.7, 3.2, e.tune("meterSpeed")) * ds;
    const baseR = lerp(38, 62, e.tune("targetSize")) / ds;
    const tSpeed = lerp(50, 150, e.tune("targetSpeed")) * ds;
    const defenderY = Math.round(lerp(ballY, targetY, 0.5));

    let shotNo = 0, makes = 0, streak = 0, score = 0;
    let phase = e.rand.range(0, Math.PI * 2);
    let state: "aim" | "flight" | "result" = "aim";
    let stateT = 0, clock = SHOT_CLOCK;
    let targetX = e.W / 2, targetDir = 1;
    let wind = 0;
    let defX = e.W / 2, defDir = 1;
    let fl = { x0: ballX, x1: ballX, t: 0, blocked: false, blockT: 0 };
    let ringPulse = 0, netWobble = 0, ballSquash = 0;
    const history: boolean[] = [];
    let over = false;

    const radius = () => Math.max(20, baseR - shotNo * 2);
    const angle = () => Math.sin(phase) * MAX_ANGLE;
    const landingX = (a: number) => ballX + Math.tan(a) * (ballY - targetY) + wind * 70;
    const onFire = () => e.has("streak_fire") && streak >= 3;
    const newWind = () => {
      wind = e.has("wind") ? e.rand.range(-1, 1) * lerp(0.4, 1, Math.min(1, shotNo / 6)) : 0;
    };
    newWind();

    function release() {
      state = "flight";
      stateT = 0;
      fl = { x0: ballX, x1: landingX(angle()), t: 0, blocked: false, blockT: 0 };
      e.audio.play("whoosh");
      ballSquash = 0.4;
    }

    function resolve() {
      const r = radius();
      const d = Math.abs(fl.x1 - targetX);
      shotNo++;
      let made = false;
      if (fl.blocked) {
        e.juice.float(fl.x1, defenderY - 40, "BLOCKED!", p.danger, 28);
        e.juice.shake(0.5);
        e.audio.play("miss");
      } else if (d < r) {
        made = true;
        const perfect = d < r * 0.35;
        streak++;
        makes++;
        const fire = onFire();
        const pts = (perfect ? 150 : 100) * (fire ? 2 : 1) + (e.has("moving_target") ? 20 : 0);
        score += pts;
        ringPulse = 1;
        netWobble = 1;
        e.juice.burst(targetX, targetY, perfect ? p.accent : p.primary, perfect ? 34 : 20, perfect ? 420 : 300);
        e.juice.shake(perfect ? 0.45 : 0.25);
        e.juice.freeze(perfect ? 0.07 : 0.03);
        e.juice.float(targetX, targetY - 60, `${perfect ? "PERFECT " : ""}+${pts}`, perfect ? p.accent : p.text, perfect ? 30 : 26);
        e.audio.play("hit", streak);
        if (streak === 3 && e.has("streak_fire")) {
          e.juice.announce(e.line("combo"), p.danger);
          e.audio.play("combo", 3);
          e.juice.flash(p.danger, 0.3);
        } else e.juice.float(e.W / 2, targetY + 90, e.line("hit"), p.primary, 22);
      } else {
        const rim = d < r * 1.4;
        streak = 0;
        e.juice.float(fl.x1, targetY - 40, e.line("miss"), p.danger, 24);
        e.juice.burst(fl.x1, targetY, p.text, 8, 160);
        e.juice.shake(rim ? 0.3 : 0.15);
        e.audio.play("miss");
        if (rim) netWobble = 0.6;
      }
      history.push(made);
      state = "result";
      stateT = 0;
      if (shotNo >= SHOTS) over = true;
    }

    return {
      par: SHOTS * 120,
      update(dt) {
        if (over && state !== "result") return;
        stateT += dt;
        ringPulse = Math.max(0, ringPulse - dt * 2);
        netWobble = Math.max(0, netWobble - dt * 1.5);
        ballSquash = lerp(ballSquash, 0, 1 - Math.pow(0.001, dt));
        if (e.has("moving_target") || shotNo >= 6) {
          const sp = e.has("moving_target") ? tSpeed : tSpeed * 0.4;
          targetX += targetDir * sp * dt;
          const lim = 70;
          if (targetX < lim || targetX > e.W - lim) {
            targetDir *= -1;
            targetX = clamp(targetX, lim, e.W - lim);
          }
        }
        if (e.has("defender")) {
          defX += defDir * lerp(90, 170, shotNo / SHOTS) * ds * dt;
          if (defX < 50 || defX > e.W - 50) {
            defDir *= -1;
            defX = clamp(defX, 50, e.W - 50);
          }
        }
        if (state === "aim") {
          // the first two shots swing slower: the first 5 seconds are easy
          phase += dt * swing * (shotNo < 2 ? 0.7 : 1 + shotNo * 0.04);
          clock -= dt;
          if (clock < 3 && Math.floor(clock * 2) !== Math.floor((clock + dt) * 2)) e.audio.play("tick");
          if (e.input.tapped || clock <= 0) release();
        } else if (state === "flight") {
          fl.t = Math.min(1, stateT / FLIGHT);
          const y = lerp(ballY, targetY, fl.t);
          const x = lerp(fl.x0, fl.x1, fl.t);
          if (e.has("defender") && !fl.blocked && Math.abs(y - defenderY) < 14 && Math.abs(x - defX) < 34 && fl.t < 0.6) {
            fl.blocked = true;
            fl.blockT = fl.t;
            e.juice.burst(x, y, p.danger, 18, 260);
            e.juice.freeze(0.06);
          }
          if (onFire() && e.rand.chance(0.8)) e.juice.burst(x, y - Math.sin(Math.PI * fl.t) * 170, p.danger, 1, 60, { gravity: -100, size: 8 });
          if (stateT >= FLIGHT || (fl.blocked && stateT > FLIGHT * 0.6)) resolve();
        } else if (state === "result") {
          if (stateT > 0.7 && !over) {
            state = "aim";
            clock = SHOT_CLOCK;
            newWind();
          }
        }
      },
      render(ctx) {
        const W = e.W;
        // court
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, p.background);
        g.addColorStop(1, mix(p.background, p.surface, 0.8));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = hexA(p.text, 0.08);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(W / 2, ballY + 40, 170, 60, 0, Math.PI, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, ballY + 40);
        ctx.lineTo(W, ballY + 40);
        ctx.stroke();
        s.scenery.forEach((em, i) => e.sprites.draw(ctx, em, 30 + i * 110, 130 + (i % 2) * 20, 24, { alpha: 0.35 }));

        // target
        const r = radius();
        const wob = Math.sin(e.time * 30) * netWobble * 6;
        ctx.fillStyle = hexA(p.primary, 0.12 + ringPulse * 0.3);
        ctx.beginPath();
        ctx.ellipse(targetX, targetY, r * 1.4 + ringPulse * 20, (r * 1.4 + ringPulse * 20) * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = p.primary;
        ctx.beginPath();
        ctx.ellipse(targetX + wob, targetY, r, r * 0.45, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 3;
        ctx.strokeStyle = hexA(p.accent, 0.9);
        ctx.beginPath();
        ctx.ellipse(targetX + wob, targetY, r * 0.35, r * 0.16, 0, 0, Math.PI * 2);
        ctx.stroke();
        e.sprites.draw(ctx, s.pickups[0], targetX, targetY - r * 0.45 - 22, 30);

        // defender
        if (e.has("defender")) {
          e.sprites.draw(ctx, s.obstacles[0], defX, defenderY, 50, { flip: defDir < 0 });
          ctx.fillStyle = hexA(p.danger, 0.25);
          ctx.fillRect(defX - 34, defenderY + 26, 68, 4);
        }

        // wind indicator
        if (e.has("wind")) {
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = font(16, 700);
          ctx.fillStyle = hexA(p.text, 0.8);
          const arrows = wind > 0 ? "→".repeat(Math.ceil(Math.abs(wind) * 3)) : "←".repeat(Math.ceil(Math.abs(wind) * 3));
          ctx.fillText(`🌬 ${Math.abs(wind) < 0.05 ? "calm" : arrows}`, W / 2, targetY - r - 70);
        }

        // aim arrow + shot clock
        if (state === "aim") {
          const a = angle();
          const len = 130;
          ctx.save();
          ctx.translate(ballX, ballY);
          ctx.rotate(a);
          ctx.setLineDash([10, 10]);
          ctx.lineDashOffset = -e.time * 40;
          ctx.strokeStyle = hexA(p.text, 0.6);
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(0, -36);
          ctx.lineTo(0, -len);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = p.text;
          ctx.beginPath();
          ctx.moveTo(0, -len - 16);
          ctx.lineTo(-10, -len);
          ctx.lineTo(10, -len);
          ctx.fill();
          ctx.restore();
          // swing track
          ctx.strokeStyle = hexA(p.text, 0.12);
          ctx.lineWidth = 8;
          ctx.beginPath();
          ctx.arc(ballX, ballY, 150, -Math.PI / 2 - MAX_ANGLE, -Math.PI / 2 + MAX_ANGLE);
          ctx.stroke();
          // clock ring
          ctx.strokeStyle = clock < 2 ? p.danger : hexA(p.primary, 0.8);
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(ballX, ballY, 34, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * clock) / SHOT_CLOCK);
          ctx.stroke();
          e.sprites.draw(ctx, s.player, ballX, ballY + Math.sin(e.time * 6) * 2, 46, { sx: 1 + ballSquash * 0.3, sy: 1 - ballSquash * 0.3 });
        } else if (state === "flight") {
          const tt = fl.blocked ? fl.blockT - (fl.t - fl.blockT) * 0.5 : fl.t;
          const x = fl.blocked ? lerp(fl.x0, fl.x1, fl.blockT) + (fl.t - fl.blockT) * 300 * (fl.x1 > ballX ? -1 : 1) : lerp(fl.x0, fl.x1, tt);
          const y = lerp(ballY, targetY, tt);
          const lift = Math.sin(Math.PI * tt) * 170;
          ctx.fillStyle = "rgba(0,0,0,0.25)";
          ctx.beginPath();
          ctx.ellipse(x, y + 16, 16 * (1 - tt * 0.4), 5, 0, 0, Math.PI * 2);
          ctx.fill();
          e.sprites.draw(ctx, s.player, x, y - lift, 46 * (1 - tt * 0.4), { rot: e.time * 10 });
        }
        // shot history dots
        for (let i = 0; i < SHOTS; i++) {
          const x = W / 2 - (SHOTS - 1) * 11 + i * 22;
          const y = H - 50;
          ctx.fillStyle = i < history.length ? (history[i] ? p.primary : hexA(p.danger, 0.7)) : hexA(p.text, 0.18);
          ctx.beginPath();
          ctx.arc(x, y, i === history.length && state === "aim" ? 7 : 6, 0, Math.PI * 2);
          ctx.fill();
        }
        if (onFire()) {
          ctx.fillStyle = hexA(p.danger, 0.9);
          roundRect(ctx, W / 2 - 60, H - 92, 120, 26, 13);
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.font = font(14, 700);
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("🔥 ×2 ON FIRE", W / 2, H - 79);
        }
      },
      isOver: () => over && state === "result" && stateT > 0.5,
      result: () => ({ score, won: makes >= 5 }),
      hud: () => ({ score, label: `Shot ${Math.min(shotNo + 1, SHOTS)}/${SHOTS} · ${makes} made`, combo: streak, multiplier: onFire() ? 2 : 1 }),
      bot(): BotAction {
        if (state !== "aim") return {};
        // predict the target position at landing time and release when the arrow lines up
        let tx = targetX;
        if (e.has("moving_target") || shotNo >= 6) tx += targetDir * (e.has("moving_target") ? tSpeed : tSpeed * 0.4) * FLIGHT;
        const blocked = e.has("defender") && Math.abs(lerp(ballX, landingX(angle()), 0.5) - (defX + defDir * 120 * FLIGHT * 0.5)) < 40;
        return { tap: !blocked && Math.abs(landingX(angle()) - tx) < radius() * 0.5 };
      },
      destroy() {},
    };
  },
};

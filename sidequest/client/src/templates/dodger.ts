// dodger: top-down avoider. Drag to steer, dodge obstacles, grab pickups, speed ramps.
// Modifiers: boost_pads, pit_stop, slalom_gates, drafting.
import type { BotAction, Engine, GameInstance, GameTemplate } from "../engine/engine";
import { clamp, diffScale, font, hexA, lerp, mix, ramp, roundRect } from "../engine/util";

const ROUND = 40;
const LIVES = 3;
const MARGIN = 34; // roadside width
const PLAYER_R = 17; // forgiving hitbox (sprite is ~44px)
const OBST_R = 17;

type Kind = "obstacle" | "pickup" | "boost" | "pit" | "gate";
interface Thing {
  kind: Kind;
  x: number;
  y: number;
  emoji?: string;
  w?: number; // pit width / gate gap
  done?: boolean;
  spin: number;
}

export const dodger: GameTemplate = {
  id: "dodger",
  create(cfg, e: Engine): GameInstance {
    const p = cfg.palette;
    const s = cfg.sprites;
    const H = e.H;
    const playerY = H - 170;
    const road = { l: MARGIN, r: e.W - MARGIN };
    const baseSpeed = lerp(250, 400, e.tune("speed")) * diffScale(e.difficulty);
    const density = lerp(0.75, 1.35, e.tune("obstacleDensity")) * diffScale(e.difficulty);
    const pickupGap = lerp(520, 260, e.tune("pickupRate"));

    let x = e.W / 2, vx = 0, tilt = 0, squash = 0;
    let lives = LIVES, invuln = 0, slow = 0, boost = 0, pit = 0;
    let score = 0, combo = 0, mult = 1, draft = 0;
    let t = 0, dist = 0, over = false, won = false;
    let nextRow = 420, nextPickup = 300, nextBoost = 900, nextPit = 1600, nextGate = 700;
    let scroll = 0;
    const things: Thing[] = [];
    const scenery: { x: number; y: number; emoji: string }[] = [];
    for (let i = 0; i < 8 && s.scenery.length; i++) scenery.push({ x: e.rand.chance(0.5) ? MARGIN / 2 : e.W - MARGIN / 2, y: e.rand.range(0, H), emoji: e.rand.pick(s.scenery) });
    // drafting: a pace object weaving ahead of you
    const leader = { x: e.W / 2, y: H * 0.42, phase: 0, emoji: s.obstacles[0] === s.player ? "💨" : s.player };

    const lanes = 5;
    const laneX = (i: number) => road.l + ((road.r - road.l) / lanes) * (i + 0.5);

    const speed = () => {
      const r = ramp(t, ROUND);
      const sp = baseSpeed * (1 + 0.85 * r);
      return sp * (boost > 0 ? 1.5 : 1) * (slow > 0 ? 0.55 : 1) * (pit > 0 ? 0.2 : 1);
    };

    function spawnRow() {
      const r = ramp(t, ROUND);
      const maxBlocked = t < 5 ? 1 : r < 0.4 ? 2 : 3;
      const n = clamp(Math.round(e.rand.range(0.6, 1.2 + r * 1.6)), 1, maxBlocked);
      const free = [0, 1, 2, 3, 4];
      for (let i = 0; i < n; i++) {
        const lane = free.splice(e.rand.int(0, free.length - 1), 1)[0];
        things.push({ kind: "obstacle", x: laneX(lane) + e.rand.range(-10, 10), y: -60 - e.rand.range(0, 40), emoji: e.rand.pick(s.obstacles), spin: e.rand.range(-0.3, 0.3) });
      }
    }

    function hit(th: Thing) {
      if (invuln > 0 || boost > 0) {
        if (boost > 0) {
          th.done = true;
          e.juice.burst(th.x, th.y, p.accent, 16, 320);
          e.juice.shake(0.25);
          e.audio.play("hit", 3);
          score += 25 * mult;
          e.juice.float(th.x, th.y - 20, "SMASH +" + 25 * mult, p.accent, 22);
        }
        return;
      }
      th.done = true;
      lives--;
      invuln = 1.6;
      slow = 0.6;
      combo = 0;
      draft = 0;
      e.juice.shake(0.75);
      e.juice.freeze(0.09);
      e.juice.flash(p.danger, 0.35);
      e.juice.burst(x, playerY, p.danger, 24, 380);
      e.juice.burst(th.x, th.y, p.text, 10, 240);
      e.juice.float(x, playerY - 50, e.line("miss"), p.danger, 26);
      e.audio.play("miss");
      squash = -0.4;
      if (lives <= 0) over = true;
    }

    function collect(th: Thing) {
      th.done = true;
      combo++;
      const pts = Math.round(50 * mult * (1 + Math.min(combo, 20) * 0.1));
      score += pts;
      squash = 0.35;
      e.juice.burst(th.x, th.y, p.accent, 14, 260, { gravity: 200 });
      e.juice.burst(th.x, th.y, p.primary, 6, 180, { gravity: 200 });
      e.juice.shake(0.12);
      e.audio.play("collect", combo);
      e.juice.float(th.x, th.y - 24, "+" + pts, p.accent, 24);
      if (combo % 5 === 0) {
        e.juice.announce(e.line("combo"), p.primary);
        e.audio.play("combo", combo / 5);
        e.juice.burst(x, playerY, p.primary, 30, 420, { gravity: 100 });
      } else if (combo % 3 === 0) e.juice.float(x, playerY - 70, e.line("hit"), p.text, 20);
    }

    return {
      par: 2600 * (1 + (cfg.modifiers.length - 1) * 0.25),
      update(dt) {
        if (over) return;
        t += dt;
        if (t >= ROUND) {
          over = true;
          won = lives > 0;
          return;
        }
        // input: relative drag (finger never covers the car) + keyboard
        const before = x;
        x += e.input.dragDX * 1.15 + e.input.axis * 430 * dt;
        x = clamp(x, road.l + 16, road.r - 16);
        vx = lerp(vx, (x - before) / dt, 0.25);
        tilt = lerp(tilt, clamp(vx / 900, -0.35, 0.35), 0.2);
        squash = lerp(squash, 0, 1 - Math.pow(0.0001, dt));
        invuln = Math.max(0, invuln - dt);
        slow = Math.max(0, slow - dt);
        if (boost > 0) {
          boost -= dt;
          if (e.rand.chance(0.6)) e.juice.burst(x + e.rand.range(-12, 12), playerY + 26, p.accent, 1, 80, { gravity: 900, size: 5 });
        }
        if (pit > 0) pit -= dt;

        const v = speed();
        const dy = v * dt;
        dist += dy;
        scroll = (scroll + dy) % 80;
        score += dt * 10 * mult * (draft > 0.5 ? 2 : 1) * (boost > 0 ? 2 : 1);

        // spawn by distance so density scales with speed
        if (dist > nextRow) {
          spawnRow();
          nextRow = dist + lerp(300, 170, ramp(t, ROUND)) / density;
        }
        if (dist > nextPickup) {
          const lane = e.rand.int(0, lanes - 1);
          things.push({ kind: "pickup", x: laneX(lane), y: -40, emoji: e.rand.pick(s.pickups), spin: 0 });
          nextPickup = dist + pickupGap * e.rand.range(0.7, 1.3);
        }
        if (e.has("boost_pads") && dist > nextBoost) {
          things.push({ kind: "boost", x: laneX(e.rand.int(0, lanes - 1)), y: -50, spin: 0 });
          nextBoost = dist + e.rand.range(1300, 1900);
        }
        if (e.has("pit_stop") && dist > nextPit) {
          const left = e.rand.chance(0.5);
          things.push({ kind: "pit", x: left ? road.l : road.r - 92, y: -150, w: 92, spin: 0 });
          nextPit = dist + e.rand.range(2600, 3400);
        }
        if (e.has("slalom_gates") && dist > nextGate) {
          things.push({ kind: "gate", x: e.rand.range(road.l + 80, road.r - 80), y: -40, w: lerp(150, 110, ramp(t, ROUND)), spin: 0 });
          nextGate = dist + e.rand.range(700, 1000);
        }

        for (const th of things) {
          th.y += dy;
          if (th.done) continue;
          if (th.kind === "obstacle" || th.kind === "pickup") {
            const d = Math.hypot(th.x - x, th.y - playerY);
            if (th.kind === "obstacle" && d < PLAYER_R + OBST_R) hit(th);
            if (th.kind === "pickup" && d < PLAYER_R + 24) collect(th);
          } else if (th.kind === "boost") {
            if (Math.abs(th.x - x) < 34 && Math.abs(th.y - playerY) < 34) {
              th.done = true;
              boost = 2.2;
              e.juice.announce("BOOST!", p.accent, 0.8);
              e.juice.flash(p.accent, 0.25);
              e.juice.shake(0.3);
              e.audio.play("whoosh");
              e.audio.play("combo", 2);
            }
          } else if (th.kind === "pit") {
            if (x > th.x && x < th.x + th.w! && Math.abs(th.y + 60 - playerY) < 70) {
              th.done = true;
              pit = 1.0;
              mult = Math.min(4, mult + 1);
              e.juice.announce(`PIT STOP ×${mult}`, p.accent, 1);
              e.juice.shake(0.2);
              e.audio.play("combo", mult);
              e.juice.burst(x, playerY, p.accent, 20, 200, { gravity: 50 });
            }
          } else if (th.kind === "gate") {
            if (th.y > playerY) {
              th.done = true;
              if (Math.abs(x - th.x) < th.w! / 2 - 6) {
                const pts = 100 * mult;
                score += pts;
                combo++;
                e.juice.float(th.x, playerY - 40, "GATE +" + pts, p.primary, 24);
                e.juice.burst(th.x - th.w! / 2, playerY, p.primary, 8, 200);
                e.juice.burst(th.x + th.w! / 2, playerY, p.primary, 8, 200);
                e.audio.play("hit", combo);
                squash = 0.25;
              } else e.juice.float(th.x, playerY - 40, "missed gate", hexA(p.text, 0.7), 16);
            }
          }
        }
        // drafting
        if (e.has("drafting")) {
          leader.phase += dt * lerp(0.9, 1.6, ramp(t, ROUND));
          leader.x = e.W / 2 + Math.sin(leader.phase) * (road.r - road.l) * 0.33 + Math.sin(leader.phase * 2.3) * 30;
          const inWake = Math.abs(leader.x - x) < 38;
          const prev = draft;
          draft = clamp(draft + (inWake ? dt * 0.9 : -dt * 1.2), 0, 1);
          if (prev < 0.5 && draft >= 0.5) {
            e.juice.float(x, playerY - 60, "SLIPSTREAM ×2", p.accent, 20);
            e.audio.play("hit", 5);
          }
          if (inWake && e.rand.chance(0.5)) e.juice.burst(x + e.rand.range(-20, 20), playerY - 60, p.text, 1, 40, { gravity: 600, size: 3 });
        }
        for (const sc of scenery) {
          sc.y += dy * 0.9;
          if (sc.y > H + 40) {
            sc.y = -40 - e.rand.range(0, 200);
            sc.x = e.rand.chance(0.5) ? MARGIN / 2 : e.W - MARGIN / 2;
            sc.emoji = e.rand.pick(s.scenery);
          }
        }
        for (let i = things.length - 1; i >= 0; i--) if (things[i].y > H + 200) things.splice(i, 1);
      },
      render(ctx) {
        const W = e.W;
        // roadside + road
        ctx.fillStyle = mix(p.background, p.surface, 0.5);
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = p.background;
        ctx.fillRect(road.l, 0, road.r - road.l, H);
        // kerbs
        for (let y = -80 + scroll; y < H; y += 80) {
          ctx.fillStyle = p.primary;
          ctx.fillRect(road.l - 6, y, 6, 40);
          ctx.fillRect(road.r, y, 6, 40);
          ctx.fillStyle = p.text;
          ctx.fillRect(road.l - 6, y + 40, 6, 40);
          ctx.fillRect(road.r, y + 40, 6, 40);
        }
        // lane dashes
        ctx.fillStyle = hexA(p.text, 0.12);
        for (let i = 1; i < lanes; i++) {
          const lx = road.l + ((road.r - road.l) / lanes) * i;
          for (let y = -80 + scroll; y < H; y += 80) ctx.fillRect(lx - 1.5, y, 3, 36);
        }
        // speed lines when boosting
        if (boost > 0) {
          ctx.fillStyle = hexA(p.accent, 0.25);
          for (let i = 0; i < 10; i++) ctx.fillRect(road.l + ((i * 97 + scroll * 7) % (road.r - road.l)), ((i * 173 + scroll * 9) % H) - 60, 2, 90);
        }
        for (const sc of scenery) e.sprites.draw(ctx, sc.emoji, sc.x, sc.y, 24);

        for (const th of things) {
          if (th.kind === "pit") {
            ctx.fillStyle = hexA(p.accent, th.done ? 0.1 : 0.22);
            roundRect(ctx, th.x, th.y, th.w!, 120, 10);
            ctx.fill();
            ctx.strokeStyle = hexA(p.accent, 0.8);
            ctx.setLineDash([8, 6]);
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = p.accent;
            ctx.font = font(18, 700);
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(th.done ? "✓" : "PIT", th.x + th.w! / 2, th.y + 60);
          } else if (th.kind === "boost") {
            if (th.done) continue;
            ctx.fillStyle = hexA(p.accent, 0.9);
            for (let k = 0; k < 3; k++) {
              const yy = th.y + 18 - k * 16;
              ctx.beginPath();
              ctx.moveTo(th.x - 22, yy);
              ctx.lineTo(th.x, yy - 12);
              ctx.lineTo(th.x + 22, yy);
              ctx.lineTo(th.x + 22, yy + 6);
              ctx.lineTo(th.x, yy - 6);
              ctx.lineTo(th.x - 22, yy + 6);
              ctx.fill();
            }
          } else if (th.kind === "gate") {
            const g = th.w! / 2;
            for (const sx of [-1, 1]) {
              ctx.fillStyle = th.done ? hexA(p.primary, 0.3) : p.primary;
              ctx.fillRect(th.x + sx * g - 3, th.y - 30, 6, 34);
              ctx.beginPath();
              ctx.moveTo(th.x + sx * g, th.y - 30);
              ctx.lineTo(th.x + sx * g - sx * 20, th.y - 22);
              ctx.lineTo(th.x + sx * g, th.y - 14);
              ctx.fill();
            }
          } else if (!th.done) {
            if (th.kind === "pickup") {
              const bob = Math.sin(t * 6 + th.x) * 3;
              ctx.fillStyle = hexA(p.accent, 0.25);
              ctx.beginPath();
              ctx.arc(th.x, th.y + bob, 22 + Math.sin(t * 8) * 2, 0, Math.PI * 2);
              ctx.fill();
              e.sprites.draw(ctx, th.emoji!, th.x, th.y + bob, 30);
            } else {
              // telegraph: warning chevron before it scrolls on screen
              if (th.y < 0) {
                ctx.fillStyle = hexA(p.danger, 0.5 + 0.5 * Math.sin(t * 20));
                ctx.font = font(18, 700);
                ctx.textAlign = "center";
                ctx.textBaseline = "top";
                ctx.fillText("▼", th.x, 8);
              }
              ctx.fillStyle = "rgba(0,0,0,0.25)";
              ctx.beginPath();
              ctx.ellipse(th.x + 4, th.y + 18, 18, 6, 0, 0, Math.PI * 2);
              ctx.fill();
              e.sprites.draw(ctx, th.emoji!, th.x, th.y, 38, { rot: th.spin });
            }
          }
        }
        if (e.has("drafting")) {
          // wake cone
          const g = ctx.createLinearGradient(0, leader.y, 0, leader.y + 220);
          g.addColorStop(0, hexA(p.text, draft > 0.5 ? 0.22 : 0.12));
          g.addColorStop(1, hexA(p.text, 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(leader.x - 18, leader.y + 10);
          ctx.lineTo(leader.x + 18, leader.y + 10);
          ctx.lineTo(leader.x + 40, leader.y + 230);
          ctx.lineTo(leader.x - 40, leader.y + 230);
          ctx.fill();
          e.sprites.draw(ctx, leader.emoji, leader.x, leader.y, 36, { alpha: 0.85 });
        }
        // player
        const blink = invuln > 0 && Math.floor(invuln * 12) % 2 === 0;
        if (!blink) {
          if (boost > 0) {
            ctx.fillStyle = hexA(p.accent, 0.35);
            ctx.beginPath();
            ctx.arc(x, playerY, 34 + Math.sin(t * 30) * 3, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = "rgba(0,0,0,0.3)";
          ctx.beginPath();
          ctx.ellipse(x + 4, playerY + 24, 20, 7, 0, 0, Math.PI * 2);
          ctx.fill();
          e.sprites.draw(ctx, s.player, x, playerY, 46, { rot: tilt, sx: 1 - squash * 0.4, sy: 1 + squash * 0.5 });
        }
        if (pit > 0) {
          ctx.fillStyle = p.accent;
          ctx.fillRect(x - 30, playerY + 34, 60 * (pit / 1.0), 5);
        }
      },
      isOver: () => over,
      result: () => ({ score: Math.floor(score), won }),
      hud: () => ({
        score,
        lives,
        maxLives: LIVES,
        timeFrac: 1 - t / ROUND,
        timeLeft: ROUND - t,
        combo,
        multiplier: mult * (draft > 0.5 ? 2 : 1) * (boost > 0 ? 2 : 1),
      }),
      bot(): BotAction {
        // steer toward the lane with the farthest-away obstacle, prefer pickups
        let best = x, bestScore = -Infinity;
        for (let i = 0; i < lanes; i++) {
          const lx = laneX(i);
          let sc = -Math.abs(lx - x) * 0.05;
          for (const th of things) {
            if (th.done || th.y > playerY + 30 || th.y < playerY - 420) continue;
            if (Math.abs(th.x - lx) > 40) continue;
            if (th.kind === "obstacle") sc -= 1000 / Math.max(10, playerY - th.y);
            if (th.kind === "pickup") sc += 200 / Math.max(10, playerY - th.y);
          }
          if (sc > bestScore) {
            bestScore = sc;
            best = lx;
          }
        }
        return { targetX: best };
      },
      destroy() {},
    };
  },
};

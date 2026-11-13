// catcher: items fall; drag the basket to catch good ones and avoid bad ones. 3 lives, 40 s.
// Modifiers: recipe_order, golden_item, stack_tower, rush_hour.
import type { BotAction, Engine, GameInstance, GameTemplate } from "../engine/engine";
import { clamp, diffScale, font, hexA, lerp, mix, ramp, roundRect } from "../engine/util";

const ROUND = 40;
const LIVES = 3;
const CATCH_W = 52; // half-width of the catch zone (generous)

interface Item {
  x: number;
  y: number;
  vy: number;
  emoji: string;
  bad: boolean;
  golden: boolean;
  rot: number;
  vr: number;
  done: boolean;
}

export const catcher: GameTemplate = {
  id: "catcher",
  create(cfg, e: Engine): GameInstance {
    const p = cfg.palette;
    const s = cfg.sprites;
    const H = e.H;
    const basketY = H - 140;
    const ds = diffScale(e.difficulty);
    const fall = lerp(190, 320, e.tune("fallSpeed")) * ds;
    const every = lerp(0.85, 0.5, e.tune("spawnRate")) / ds;
    const badRatio = lerp(0.18, 0.42, e.tune("badItemRatio")) * ds;

    let x = e.W / 2, vx = 0, tilt = 0, squash = 0;
    let lives = LIVES, invuln = 0, score = 0, combo = 0;
    let t = 0, spawnT = 0.6, over = false, won = false;
    let nextGolden = 7, rushAt = 12, rushLeft = 0, rushWarned = false;
    const items: Item[] = [];
    // recipe_order
    const recipe: string[] = [];
    let recipeIdx = 0, recipesDone = 0, recipeFlash = 0;
    const newRecipe = () => {
      recipe.length = 0;
      for (let i = 0; i < 3; i++) recipe.push(e.rand.pick(s.pickups));
      recipeIdx = 0;
    };
    if (e.has("recipe_order")) newRecipe();
    // stack_tower
    const stack: string[] = [];
    let wobble = 0, wobbleV = 0;
    const stackMult = () => (e.has("stack_tower") ? 1 + Math.floor(stack.length / 3) * 0.5 : 1);

    function spawn() {
      const r = ramp(t, ROUND);
      const bad = t > 4 && e.rand.chance(badRatio * (0.6 + 0.6 * r));
      // when a recipe is active, bias good items toward the next needed ingredient
      const want = e.has("recipe_order") && e.rand.chance(0.45) ? recipe[recipeIdx] : e.rand.pick(s.pickups);
      items.push({
        x: e.rand.range(40, e.W - 40),
        y: -40,
        vy: fall * (1 + 0.55 * r) * e.rand.range(0.85, 1.15),
        emoji: bad ? e.rand.pick(s.obstacles) : want,
        bad,
        golden: false,
        rot: e.rand.range(-0.4, 0.4),
        vr: e.rand.range(-2, 2),
        done: false,
      });
    }

    function topple() {
      if (!stack.length) return;
      stack.forEach((em, i) => e.juice.burst(x, basketY - 30 - i * 16, p.text, 1, 300, { emoji: em, size: 8, gravity: 900 }));
      e.juice.float(x, basketY - 80, "TOPPLED!", p.danger, 26);
      e.audio.play("miss");
      e.juice.shake(0.35);
      stack.length = 0;
      wobble = wobbleV = 0;
    }

    function catchGood(it: Item) {
      combo++;
      let pts = Math.round((it.golden ? 50 : 10) * (1 + Math.min(combo, 30) / 10) * stackMult());
      squash = 0.4;
      if (e.has("recipe_order") && it.emoji === recipe[recipeIdx] && !it.golden) {
        recipeIdx++;
        recipeFlash = 0.3;
        if (recipeIdx >= recipe.length) {
          recipesDone++;
          const bonus = 150 * recipesDone;
          pts += bonus;
          e.juice.announce(e.line("combo"), p.primary);
          e.juice.float(e.W / 2, 150, `RECIPE +${bonus}`, p.accent, 26);
          e.audio.play("combo", recipesDone * 2);
          e.juice.flash(p.accent, 0.2);
          newRecipe();
        }
      }
      score += pts;
      if (e.has("stack_tower")) {
        stack.push(it.emoji);
        if (stack.length > 12) stack.shift();
        wobbleV += e.rand.range(-0.6, 0.6);
      }
      e.juice.burst(it.x, basketY - 20, it.golden ? "#ffd700" : p.accent, it.golden ? 30 : 12, it.golden ? 380 : 240, { gravity: 300 });
      e.juice.shake(it.golden ? 0.35 : 0.1);
      if (it.golden) {
        e.juice.freeze(0.06);
        e.juice.announce("GOLDEN!", "#ffd700", 0.8);
      }
      e.audio.play(it.golden ? "combo" : "collect", combo);
      e.juice.float(it.x, basketY - 50, "+" + pts, it.golden ? "#ffd700" : p.text, it.golden ? 30 : 22);
      if (combo % 8 === 0) {
        e.juice.announce(e.line("combo"), p.primary);
        e.audio.play("combo", combo / 8);
      } else if (combo % 4 === 0) e.juice.float(x, basketY - 90, e.line("hit"), p.primary, 20);
    }

    function catchBad(it: Item) {
      if (invuln > 0) return;
      lives--;
      invuln = 1.2;
      combo = 0;
      squash = -0.4;
      e.juice.shake(0.7);
      e.juice.freeze(0.08);
      e.juice.flash(p.danger, 0.35);
      e.juice.burst(it.x, basketY - 10, p.danger, 24, 360);
      e.juice.float(x, basketY - 60, e.line("miss"), p.danger, 26);
      e.audio.play("miss");
      topple();
      if (lives <= 0) over = true;
    }

    return {
      par: 2200 * (e.has("recipe_order") ? 1.3 : 1) * (e.has("stack_tower") ? 1.3 : 1),
      update(dt) {
        if (over) return;
        t += dt;
        if (t >= ROUND) {
          over = true;
          won = lives > 0;
          return;
        }
        const before = x;
        x = clamp(x + e.input.dragDX * 1.2 + e.input.axis * 480 * dt, 44, e.W - 44);
        vx = lerp(vx, (x - before) / dt, 0.3);
        tilt = lerp(tilt, clamp(vx / 1400, -0.25, 0.25), 0.2);
        squash = lerp(squash, 0, 1 - Math.pow(0.0005, dt));
        invuln = Math.max(0, invuln - dt);
        recipeFlash = Math.max(0, recipeFlash - dt);

        if (e.has("stack_tower") && stack.length) {
          // a damped spring pushed by basket acceleration; tall stacks are twitchier
          wobbleV += (-wobble * 30 - wobbleV * 4) * dt - (vx / 1000) * dt * (6 + stack.length * 1.2);
          wobble += wobbleV * dt;
          if (Math.abs(wobble) > 0.55) topple();
        }

        // rush hour: warn 1 s early, then 3 s of triple spawns
        let rate = every / (1 + 0.6 * ramp(t, ROUND));
        if (e.has("rush_hour")) {
          if (!rushWarned && t > rushAt - 1) {
            rushWarned = true;
            e.juice.announce("RUSH HOUR!", p.danger, 1.1);
            e.audio.play("whoosh");
          }
          if (t > rushAt) {
            rushLeft = 3;
            rushAt += 12;
            rushWarned = false;
          }
          if (rushLeft > 0) {
            rushLeft -= dt;
            rate /= 2.6;
          }
        }
        spawnT -= dt;
        if (spawnT <= 0) {
          spawn();
          spawnT = rate * e.rand.range(0.8, 1.2);
        }
        if (e.has("golden_item") && t > nextGolden) {
          items.push({ x: e.rand.range(50, e.W - 50), y: -40, vy: fall * 1.25, emoji: s.pickups[0], bad: false, golden: true, rot: 0, vr: 3, done: false });
          nextGolden = t + e.rand.range(6, 9);
        }

        for (const it of items) {
          if (it.done) continue;
          const prevY = it.y;
          it.y += it.vy * dt;
          it.rot += it.vr * dt;
          const lipY = basketY - 18;
          if (prevY < lipY && it.y >= lipY && Math.abs(it.x - x) < CATCH_W) {
            it.done = true;
            it.bad ? catchBad(it) : catchGood(it);
          } else if (it.y > H + 30) {
            it.done = true;
            if (!it.bad) {
              if (combo >= 3) e.juice.float(it.x, H - 60, "combo lost", hexA(p.text, 0.7), 16);
              combo = 0;
            }
          }
        }
        for (let i = items.length - 1; i >= 0; i--) if (items[i].done) items.splice(i, 1);
      },
      render(ctx) {
        const W = e.W;
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, p.background);
        g.addColorStop(1, mix(p.background, p.surface, 0.9));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        // drifting scenery
        s.scenery.forEach((em, i) => {
          const yy = ((i * 211 + e.time * 18) % (H + 80)) - 40;
          e.sprites.draw(ctx, em, 40 + ((i * 137) % (W - 80)), yy, 26, { alpha: 0.25 });
        });
        ctx.fillStyle = mix(p.surface, p.background, 0.2);
        ctx.fillRect(0, basketY + 34, W, H - basketY - 34);

        if (rushLeft > 0) {
          ctx.fillStyle = hexA(p.danger, 0.08 + 0.05 * Math.sin(e.time * 20));
          ctx.fillRect(0, 0, W, H);
        }

        for (const it of items) {
          if (it.bad) {
            ctx.fillStyle = hexA(p.danger, 0.22);
            ctx.beginPath();
            ctx.arc(it.x, it.y, 25, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = hexA(p.danger, 0.7);
            ctx.lineWidth = 2;
            ctx.stroke();
          }
          if (it.golden) {
            ctx.fillStyle = `rgba(255,215,0,${0.35 + 0.15 * Math.sin(e.time * 15)})`;
            ctx.beginPath();
            ctx.arc(it.x, it.y, 30, 0, Math.PI * 2);
            ctx.fill();
            if (Math.random() < 0.3) e.juice.burst(it.x, it.y, "#ffd700", 1, 40, { gravity: -50, size: 4 });
          }
          e.sprites.draw(ctx, it.emoji, it.x, it.y, it.golden ? 40 : 36, { rot: it.rot });
        }

        // stack
        if (stack.length) {
          ctx.save();
          ctx.translate(x, basketY - 14);
          for (let i = 0; i < stack.length; i++) {
            ctx.rotate(wobble * 0.18);
            e.sprites.draw(ctx, stack[i], 0, -i * 16 - 10, 26);
          }
          ctx.restore();
        }
        // basket
        const blink = invuln > 0 && Math.floor(invuln * 12) % 2 === 0;
        if (!blink) {
          ctx.fillStyle = "rgba(0,0,0,0.2)";
          ctx.beginPath();
          ctx.ellipse(x, basketY + 30, 40, 8, 0, 0, Math.PI * 2);
          ctx.fill();
          e.sprites.draw(ctx, s.player, x, basketY, 64, { rot: tilt, sx: 1 + squash * 0.35, sy: 1 - squash * 0.3 });
        }

        // recipe card
        if (e.has("recipe_order")) {
          const cw = 170, cx = W / 2 - cw / 2, cy = 100;
          ctx.fillStyle = hexA(p.surface, 0.92);
          roundRect(ctx, cx, cy, cw, 54, 14);
          ctx.fill();
          ctx.strokeStyle = recipeFlash > 0 ? p.accent : hexA(p.text, 0.15);
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = hexA(p.text, 0.7);
          ctx.font = font(11, 700);
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillText("RECIPE", W / 2, cy + 4);
          recipe.forEach((em, i) => {
            const ex = cx + 35 + i * 50;
            e.sprites.draw(ctx, em, ex, cy + 33, i === recipeIdx ? 28 + Math.sin(e.time * 8) * 2 : 24, { alpha: i < recipeIdx ? 0.3 : 1 });
            if (i < recipeIdx) {
              ctx.fillStyle = p.accent;
              ctx.font = font(18, 700);
              ctx.textBaseline = "middle";
              ctx.fillText("✓", ex, cy + 33);
            }
          });
        }
      },
      isOver: () => over,
      result: () => ({ score, won }),
      hud: () => ({ score, lives, maxLives: LIVES, timeFrac: 1 - t / ROUND, timeLeft: ROUND - t, combo, multiplier: stackMult() }),
      bot(): BotAction {
        // chase the lowest good item that is reachable, keep away from bad ones
        let target = e.W / 2, bestY = -Infinity;
        for (const it of items) {
          if (it.bad || it.done || it.y > basketY) continue;
          if (it.y > bestY) {
            bestY = it.y;
            target = it.x;
          }
        }
        for (const it of items) if (it.bad && !it.done && it.y > basketY - 160 && it.y < basketY && Math.abs(it.x - target) < 70) target += it.x > target ? -90 : 90;
        return { targetX: clamp(target, 44, e.W - 44) };
      },
      destroy() {},
    };
  },
};

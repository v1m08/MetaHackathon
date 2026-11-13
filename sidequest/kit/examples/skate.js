// Reference game for interest "skateboarding". Written only against the sq kit (see kit/API.md).
// Tap to ollie (hold for height). Tap again in the air to kickflip: land it for big points, land mid-flip and
// you bail. Land on a rail to grind. 45 seconds, 3 lives.
export default function game(sq) {
  const { W, H, draw, fx, sfx, input, palette: p, rand } = sq;
  const GROUND = H * 0.74;
  const ROUND = 45;
  const skater = { x: 120, y: GROUND, vy: 0, air: false, flip: 0, flipping: false, grind: null, bail: 0, squash: 0 };
  let speed = 230, dist = 0, lives = 3, combo = 0, invuln = 0;
  let nextSpawn = 380;
  const things = []; // { kind: "cone" | "box" | "rail" | "star", x, y, w, h, done }

  function spawn() {
    const roll = rand();
    const x = W + 40;
    if (sq.t < 5) things.push({ kind: "cone", x, y: GROUND, w: 26, h: 30 });
    else if (roll < 0.35) things.push({ kind: "cone", x, y: GROUND, w: 26, h: 30 });
    else if (roll < 0.6) things.push({ kind: "box", x, y: GROUND, w: 64, h: rand.range(34, 50) });
    else things.push({ kind: "rail", x, y: GROUND - 58, w: rand.range(150, 230), h: 8 });
    if (rand.chance(0.6)) things.push({ kind: "star", x: x + rand.range(40, 120), y: GROUND - rand.range(90, 150), w: 24, h: 24 });
  }

  function land(surfaceY, onRail) {
    skater.y = surfaceY;
    skater.vy = 0;
    skater.air = false;
    skater.squash = 0.35;
    if (skater.flipping) {
      const f = skater.flip % (Math.PI * 2);
      if (f > 0.6 && f < Math.PI * 2 - 0.6) return bail("Bailed!");
      skater.flipping = false;
      combo++;
      sq.score += 150 * combo;
      fx.hit(skater.x, skater.y - 30, `Kickflip +${150 * combo}`);
      if (combo >= 3) fx.banner(`${combo}x combo!`);
    } else sfx.tap();
    if (onRail) {
      sfx.whoosh();
      fx.float(skater.x, skater.y - 70, "Grind!", p.accent, 22);
    }
  }

  function bail(text) {
    if (invuln > 0) return;
    lives--;
    combo = 0;
    invuln = 1.4;
    skater.bail = 0.6;
    skater.flipping = false;
    skater.flip = 0;
    skater.grind = null;
    speed *= 0.75;
    fx.miss(skater.x, skater.y - 30, text);
    if (lives <= 0) sq.end({ won: false });
  }

  return {
    update(dt) {
      sq.hud.time = ROUND - sq.t;
      sq.hud.lives = lives;
      sq.hud.maxLives = 3;
      sq.hud.label = combo > 1 ? `${combo}x combo` : "";
      if (sq.t >= ROUND) return sq.end({ won: lives > 0 });

      // difficulty: gentle for 5 s, then speeds up
      speed = Math.min(460, speed + dt * (sq.t < 5 ? 2 : 6));
      const dx = speed * dt;
      dist += dx;
      invuln = Math.max(0, invuln - dt);
      skater.bail = Math.max(0, skater.bail - dt);
      skater.squash = sq.lerp(skater.squash, 0, 1 - Math.pow(0.001, dt));

      // input: tap = ollie (or kickflip if already in the air); holding keeps you floaty
      if (input.tapped) {
        if (!skater.air) {
          skater.vy = -620;
          skater.air = true;
          skater.grind = null;
          skater.squash = -0.3;
          sfx.whoosh();
        } else if (!skater.flipping) {
          skater.flipping = true;
          skater.flip = 0;
          sfx.note(5);
        }
      }
      if (skater.air) {
        const gravity = input.down && skater.vy < 0 ? 1100 : 2300;
        skater.vy += gravity * dt;
        skater.y += skater.vy * dt;
        if (skater.flipping) skater.flip += dt * 13;
        // land on a rail?
        for (const t of things) {
          if (t.kind === "rail" && skater.vy > 0 && Math.abs(skater.x - (t.x + t.w / 2)) < t.w / 2 && skater.y >= t.y && skater.y - skater.vy * dt <= t.y) {
            skater.grind = t;
            land(t.y, true);
          }
        }
        if (skater.air && skater.y >= GROUND) land(GROUND, false);
      } else if (skater.grind) {
        sq.score += 120 * dt * (1 + combo * 0.5);
        if (rand.chance(0.7)) fx.burst(skater.x - 10, skater.y, p.primary, 1, 120);
        if (skater.x > skater.grind.x + skater.grind.w) {
          skater.grind = null;
          skater.air = true;
          skater.vy = 0;
        }
      }

      // world scroll + collisions (forgiving hitboxes)
      nextSpawn -= dx;
      if (nextSpawn <= 0) {
        spawn();
        nextSpawn = rand.range(260, 420) * (1 - Math.min(0.35, sq.t / 120));
      }
      for (const t of things) {
        t.x -= dx;
        if (t.done) continue;
        const left = t.x - t.w / 2 + 6, right = t.x + t.w / 2 - 6;
        if (t.kind === "star") {
          if (Math.hypot(t.x - skater.x, t.y - (skater.y - 40)) < 34) {
            t.done = true;
            fx.collect(t.x, t.y, 50);
          }
        } else if (t.kind !== "rail" && skater.x > left && skater.x < right && skater.y > t.y - t.h + 8) {
          t.done = true;
          bail("Slammed!");
        } else if (t.kind !== "rail" && !t.cleared && t.x + t.w / 2 < skater.x - 10) {
          t.cleared = true;
          sq.score += 25;
        }
      }
      for (let i = things.length - 1; i >= 0; i--) if (things[i].x < -260) things.splice(i, 1);
    },

    render() {
      draw.bg(p.bg, p.bg2);
      draw.bands([draw.mix(p.bg, p.bg2, 0.4), draw.mix(p.bg, p.bg2, 0.75)], dist, { y: GROUND - 120, amp: 50, jag: true });
      // street
      draw.poly([[0, GROUND + 4], [W, GROUND + 4], [W, H], [0, H]], { color: draw.mix(p.ink, p.bg2, 0.4) });
      draw.line([[0, GROUND + 6], [W, GROUND + 6]], { color: draw.hexA(p.text, 0.25), width: 3 });
      for (let x = -((dist * 1) % 80); x < W; x += 80) draw.line([[x, GROUND + 40], [x + 40, GROUND + 40]], { color: draw.hexA(p.text, 0.18), width: 4 });

      for (const t of things) {
        if (t.kind === "cone" && !t.done) {
          draw.poly([[t.x - 13, t.y], [t.x + 13, t.y], [t.x + 4, t.y - t.h], [t.x - 4, t.y - t.h]], { color: p.danger });
          draw.line([[t.x - 9, t.y - 12], [t.x + 9, t.y - 12]], { color: "#ffffff", width: 4 });
        } else if (t.kind === "box" && !t.done) {
          draw.block(t.x, t.y - t.h / 2, t.w, t.h, { color: p.primary });
        } else if (t.kind === "rail") {
          draw.line([[t.x - t.w / 2, t.y], [t.x + t.w / 2, t.y]], { color: "#d9dee8", width: 7 });
          for (const lx of [t.x - t.w / 2 + 12, t.x + t.w / 2 - 12]) draw.line([[lx, t.y], [lx, GROUND]], { color: "#9aa3b5", width: 5 });
        } else if (t.kind === "star" && !t.done) {
          draw.emoji("⭐", t.x, t.y + Math.sin(sq.t * 6 + t.x) * 4, 28);
        }
      }

      // skater + board
      const blink = invuln > 0 && Math.floor(invuln * 12) % 2 === 0;
      if (!blink) {
        const sx = skater.x, sy = skater.y;
        draw.shadow(sx, GROUND + 6, 54 * (1 - Math.min(0.6, (GROUND - sy) / 300)));
        const crouch = skater.air ? 10 : skater.squash * 20;
        const deck = sy - 10;
        // board (spins during a kickflip)
        sq.ctx.save();
        sq.ctx.translate(sx, deck);
        sq.ctx.scale(1, skater.flipping ? Math.cos(skater.flip) : 1);
        draw.block(0, 0, 66, 9, { color: p.accent, depth: 3, shadow: false });
        sq.ctx.restore();
        if (!skater.flipping) {
          draw.ball(sx - 22, deck + 9, 5, { color: "#f4f4f4", shadow: false });
          draw.ball(sx + 22, deck + 9, 5, { color: "#f4f4f4", shadow: false });
        }
        const hipY = deck - 40 + crouch;
        draw.figure({
          x: sx, y: hipY, lean: skater.grind ? -0.25 : skater.air ? 0.1 : 0.05,
          lf: [sx - 15, deck - 6], rf: [sx + 16, deck - 6],
          lh: [sx - 34, hipY - 22 + Math.sin(sq.t * 8) * 3], rh: [sx + 30, hipY - 30],
          face: skater.bail > 0 ? "ouch" : combo > 1 ? "happy" : "focus",
        });
      }
      if (sq.t < 3) draw.text("Tap to ollie · tap again in the air to kickflip", W / 2, H * 0.3, { size: 16, weight: 600 });
    },
  };
}

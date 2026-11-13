# sq game kit API

A game is one JavaScript module with a default export:

```js
export default function game(sq) {
  // set up state here (runs once)
  return {
    update(dt) { /* game logic, fixed 1/120 s steps */ },
    render() { /* draw the frame with sq.draw / sq.ctx */ },
  };
}
```

Plain modern JavaScript only. No imports, no DOM, no `window`, `document`, `fetch`, `localStorage`, timers or
`Math.random` (use `sq.rand`, so every player in a room gets the same game). Keep all state in closures.

## Stage
- `sq.W` = 390 (logical width), `sq.H` = 640..900 (logical height, portrait). Origin is top-left, y grows down.
- `sq.t`: seconds since the round started. `sq.lerp(a, b, t)`, `sq.clamp(v, min, max)`.
- The kit clears the screen, draws the score HUD, particles and banners for you. A round ends by itself after 90 s.

## Round, score, HUD
- `sq.score`: add to it. It is the player's result and is shown in the HUD.
- `sq.end({ won })`: finish the round (call once when time runs out or the player fails).
- `sq.hud.time = secondsLeft` shows a countdown; `sq.hud.lives` / `sq.hud.maxLives` show hearts; `sq.hud.label`
  shows one short status line (e.g. `"Height 42 m"`).

## Input (read inside update)
- `sq.input.tapped`: true on the step the finger/mouse went down (or Space/Enter pressed).
- `sq.input.down`: finger is held. `sq.input.holdTime`: seconds held.
- `sq.input.x`, `sq.input.y`: pointer position. `sq.input.tapX`, `sq.input.tapY`: where the tap happened.
- `sq.input.dragDX`: horizontal drag distance since the last step (use for steering: `x += sq.input.dragDX`).
- `sq.input.swipe`: -1 / 1 on a quick left / right swipe, else 0.
- `sq.input.axis`: -1..1 from arrow keys (add it to steering so desktop works too).

## Randomness
- `sq.rand()` 0..1, `sq.rand.range(a, b)`, `sq.rand.int(a, b)` (inclusive), `sq.rand.pick(array)`, `sq.rand.chance(p)`.

## Palette
`sq.palette = { bg, bg2, primary, accent, danger, text, ink }` (hex strings). Use these, not hard-coded colors,
except for natural materials (rock grey, wood brown, skin, snow white). `danger` = hazards, `accent` = good things,
`primary` = the player's key color, `ink` = dark outlines/faces.

## Drawing (house style: chunky, soft-shaded, readable)
- `sq.draw.bg(top?, bottom?)`: vertical gradient background.
- `sq.draw.bands(colors[], scrollOffset, { y, amp, jag })`: parallax silhouettes (hills, skyline, cliffs; `jag: true` for rocky).
- `sq.draw.block(x, y, w, h, { color, r, depth, rot, shadow })`: rounded 2.5D block centered at x,y. Use for most objects:
  crates, platforms, holds, cars, buildings, cards, tiles.
- `sq.draw.ball(x, y, r, { color, shadow })`: shaded ball (balls, heads, fruit, planets, bubbles).
- `sq.draw.poly([[x,y], ...], { color, edge, edgeWidth })`: filled polygon (terrain, walls, ramps, waves).
- `sq.draw.line([[x,y], ...], { color, width, alpha, dash })`: thick rounded line (ropes, rails, trails, lasers).
- `sq.draw.figure({ x, y, scale, color, skin, lean, lh, rh, lf, rf, hat, face })`: a person. `x, y` is the hip.
  `lh/rh/lf/rf` are `[x, y]` targets for left hand, right hand, left foot, right foot; limbs bend naturally to reach
  them. `lean` in radians. `face`: "happy" | "focus" | "ouch". `hat`: optional emoji. Body height is about 60 * scale.
- `sq.draw.emoji(e, x, y, size, { rot, alpha, flip })`: emoji as small props/pickups/accents, never the main art.
- `sq.draw.text(str, x, y, { size, color, align, weight, outline, alpha })`: outlined legible text.
- `sq.draw.shadow(x, y, width)`: soft ground shadow. `sq.draw.meter(x, y, w, value0to1, { color, label })`: a bar.
- `sq.draw.hexA(hex, alpha)` → rgba string. `sq.draw.mix(hexA, hexB, t)` → blended hex.
- `sq.ctx`: the raw CanvasRenderingContext2D for anything else (save/restore/translate/rotate/arc/etc.).

## Juice (one call = particles + motion + sound; use them for EVERY scoring event and failure)
- `sq.fx.collect(x, y, points)`: adds points to `sq.score`, sparks, rising note, "+points" text.
- `sq.fx.hit(x, y, text?)`: something good happened (no points added). Consecutive hits climb in pitch.
- `sq.fx.miss(x, y, text?)`: something bad: red burst, screen shake, short freeze, thud.
- `sq.fx.banner(text, color?)`: big callout for rare big moments (rate limited).
- `sq.fx.burst(x, y, color, n, speed)`, `sq.fx.float(x, y, text, color, size)`, `sq.fx.shake(0..1)`, `sq.fx.freeze(sec)`.

## Sound
`sq.sfx.tap()`, `sq.sfx.note(i)` (musical step, i = 0..14 climbs), `sq.sfx.good(len)`, `sq.sfx.great()`,
`sq.sfx.bad()`, `sq.sfx.whoosh()`, `sq.sfx.tick()`, `sq.sfx.win()`.

// Headless checks (no browser, no network):
//  1. fuzz: 200 random/malformed configs → sanitizeConfig → schema-valid, contrast rules hold, template loads
//  2. bot: a scripted bot finishes a round of every template at difficulty 0, 0.5, 1 with a nonzero score
//  3. fallback: odd interests produce a valid config offline
//  4. share: encode → decode round-trips
import assert from "node:assert/strict";
import { contrast, GameConfigSchema, sanitizeConfig, TEMPLATE_IDS, type GameConfig } from "../shared/schema";
import { decodeShare, encodeShare } from "../shared/share";
import { Engine } from "../client/src/engine/engine";
import { TEMPLATE_IMPLS } from "../client/src/templates";
import { fallbackConfig } from "../server/fallback";
import { THEMES, WORDHUNT_F1 } from "../server/themes";
import { dictionary, generatePuzzle } from "../server/wordhunt";
import { findPath } from "../shared/wordhunt";

let failures = 0;
const check = (name: string, fn: () => void | Promise<void>) =>
  Promise.resolve()
    .then(fn)
    .then(() => console.log(`  ✓ ${name}`))
    .catch((err) => {
      failures++;
      console.log(`  ✗ ${name}\n    ${(err as Error).stack?.split("\n").slice(0, 3).join("\n    ")}`);
    });

const junk = (r: () => number, depth = 0): unknown => {
  const k = Math.floor(r() * 10);
  if (depth > 2) return ["x", 1, null, "🏎️", "#fff", -5, 1e9][k % 7];
  switch (k) {
    case 0: return null;
    case 1: return Math.floor(r() * 2e6) - 1e6;
    case 2: return "🔥🔥" + "a".repeat(Math.floor(r() * 200));
    case 3: return ["😀", "not emoji", 3, "#ff00ff", "🇯🇵", "👩‍👩‍👧"].slice(0, Math.floor(r() * 7));
    case 4: return { a: junk(r, depth + 1) };
    case 5: return "#" + Math.floor(r() * 0xffffff).toString(16);
    case 6: return true;
    case 7: return "\u0000<script>alert(1)</script>";
    case 8: return [junk(r, depth + 1), junk(r, depth + 1)];
    default: return undefined;
  }
};

function fuzzConfig(i: number): unknown {
  let seed = i * 7919 + 1;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  if (i % 10 === 0) return junk(r);
  const base: Record<string, unknown> = JSON.parse(JSON.stringify(Object.values(THEMES)[i % 4]));
  for (const key of ["template", "title", "tagline", "palette", "sprites", "copy", "modifiers", "tuning", "trivia", "interest", "extra"]) {
    if (r() < 0.35) base[key] = junk(r);
  }
  if (r() < 0.3) base.palette = { background: "#ffffff", text: "#fefefe", primary: "#fdfdfd", surface: "#ffffff" };
  if (r() < 0.2) base.template = TEMPLATE_IDS[Math.floor(r() * TEMPLATE_IDS.length)];
  return base;
}

function playHeadless(cfg: GameConfig, seed: number) {
  const e = new Engine(cfg, { seed });
  const game = TEMPLATE_IMPLS[cfg.template]!.create(cfg, e);
  const dt = 1 / 120;
  let x = e.W / 2;
  for (let step = 0; step < 120 * 120 && !game.isOver(); step++) {
    const a = game.bot();
    if (a.targetX !== undefined) {
      // move like a finger would: capped speed
      const want = a.targetX - x;
      const move = Math.max(-900 * dt, Math.min(900 * dt, want));
      e.input.dragDX = move / 1.15;
      x += move;
    }
    if (a.tap) e.input.tapped = true;
    if (a.choice !== undefined) e.input.numKey = a.choice + 1;
    game.update(dt);
    e.juice.update(dt);
    e.time += dt;
    e.input.endStep(dt);
  }
  return { over: game.isOver(), ...game.result(), time: e.time };
}

async function main() {
  console.log("\nfuzz sanitizeConfig ×200");
  await check("every output is schema-valid, readable and loads", () => {
    for (let i = 0; i < 200; i++) {
      const cfg = sanitizeConfig(fuzzConfig(i), "fuzz");
      const parsed = GameConfigSchema.safeParse(cfg);
      assert.ok(parsed.success, `case ${i}: ${JSON.stringify(parsed.error?.issues?.slice(0, 2))}`);
      assert.ok(contrast(cfg.palette.text, cfg.palette.background) >= 4.5, `case ${i}: text contrast`);
      assert.ok(contrast(cfg.palette.primary, cfg.palette.background) >= 3, `case ${i}: primary contrast`);
      const e = new Engine(cfg, { seed: i });
      const g = TEMPLATE_IMPLS[cfg.template]?.create(cfg, e);
      for (let k = 0; k < 240 && g; k++) g.update(1 / 120);
    }
  });

  console.log("\nbot plays every template");
  const trivia = sanitizeConfig({
    template: "trivia",
    modifiers: ["speed_bonus", "double_down"],
    trivia: { questions: [0, 1, 2, 3, 4].map((n) => ({ q: `Question ${n}?`, choices: ["a", "b", "c", "d"], answer: n % 4 })) },
  });
  const bases: GameConfig[] = [
    sanitizeConfig(THEMES.f1),
    sanitizeConfig({ ...THEMES.f1, modifiers: ["boost_pads", "slalom_gates"] }),
    sanitizeConfig(THEMES.basketball),
    sanitizeConfig({ ...THEMES.basketball, modifiers: ["wind", "moving_target"] }),
    sanitizeConfig(THEMES.baking),
    sanitizeConfig({ ...THEMES.baking, modifiers: ["stack_tower", "rush_hour"] }),
    trivia,
  ];
  for (const base of bases) {
    for (const d of [0, 0.5, 1]) {
      const cfg = { ...base, tuning: { ...base.tuning, difficulty: d } };
      await check(`${cfg.template.padEnd(7)} [${cfg.modifiers.join(", ")}] difficulty ${d}`, () => {
        const r = playHeadless(cfg, 42 + d * 10);
        assert.ok(r.over, "round never ended");
        assert.ok(r.score > 0, "score was 0");
        assert.ok(r.time <= 70, `round took ${r.time.toFixed(1)}s`);
        console.log(`      score ${r.score}, ${r.won ? "won" : "lost"}, ${r.time.toFixed(1)}s`);
      });
    }
  }

  console.log("\nword hunt boards");
  await check("F1 config is schema-valid", () => {
    const cfg = sanitizeConfig(WORDHUNT_F1);
    assert.equal(cfg.template, "wordhunt");
    assert.ok(GameConfigSchema.safeParse(cfg).success);
  });
  await check("20 boards: themed words traceable, every listed word traceable, rich boards", () => {
    const cfg = sanitizeConfig(WORDHUNT_F1);
    const d = dictionary();
    let minThemed = 99, minCommon = 9999;
    for (let seed = 1; seed <= 20; seed++) {
      const p = generatePuzzle(cfg.wordhunt!.themed, seed * 1013);
      assert.equal(p.board.length, 25);
      for (const t of p.themed) assert.ok(findPath(p.board, t.word), `seed ${seed}: ${t.word} not on board`);
      for (const w of p.words) {
        assert.ok(findPath(p.board, w.w), `seed ${seed}: ${w.w} listed but not traceable`);
        assert.ok(d.accept.has(w.w) || p.themed.some((t) => t.word === w.w), `${w.w} not a word`);
      }
      minThemed = Math.min(minThemed, p.themed.length);
      minCommon = Math.min(minCommon, p.words.filter((w) => w.c).length);
    }
    assert.ok(minThemed >= 4, `a board had only ${minThemed} themed words`);
    assert.ok(minCommon >= 60, `a board had only ${minCommon} common words`);
    console.log(`      worst board: ${minThemed} themed words, ${minCommon} common words`);
  });
  await check("same seed gives the same board", () => {
    const t = sanitizeConfig(WORDHUNT_F1).wordhunt!.themed;
    assert.deepEqual(generatePuzzle(t, 77), generatePuzzle(t, 77));
  });

  console.log("\noffline fallback");
  await check("odd interests all produce valid configs", () => {
    for (const i of ["taxes", "my dog", "ancient Rome", "🦖", "x".repeat(60), "F1", "", "   ", "sourdough", "fuck", "<img src=x>", "Taylor Swift", "golf and cats"]) {
      const cfg = fallbackConfig(i);
      assert.ok(GameConfigSchema.safeParse(cfg).success, i);
    }
  });

  console.log("\nchallenge links");
  await check("encode → decode round-trips the config and score", async () => {
    const cfg = sanitizeConfig(THEMES.f1);
    const hash = await encodeShare({ config: cfg, scoreToBeat: 4200 });
    const back = await decodeShare("#" + hash);
    assert.deepEqual(back?.config, cfg);
    assert.equal(back?.scoreToBeat, 4200);
    assert.ok(hash.length < 2500, `hash is ${hash.length} chars`);
  });
  await check("garbage hashes decode to null, not a throw", async () => {
    assert.equal(await decodeShare("#g=notbase64!!"), null);
    assert.equal(await decodeShare("#hello"), null);
  });

  console.log(failures ? `\n${failures} failed\n` : "\nall passed\n");
  process.exit(failures ? 1 : 0);
}
main();

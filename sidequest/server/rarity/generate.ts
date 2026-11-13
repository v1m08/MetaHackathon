// interest → a rarity-trivia pack: a themed world plus 7 prompts with big answer sets.
// Step 1 builds the world and prompts; step 2 fetches each prompt's answers in parallel.
import { cleanText, ensureContrast, normalizeInterest, parseHex } from "../../shared/schema";
import { FONTS, norm, PROMPTS_PER_GAME, withScene, type Answer, type Font, type Pack, type Prompt, type Scene, type World } from "../../shared/rarity";
import { chatJSON, extractJson } from "../llm";

const WORLD_SYSTEM = `You build one round of a trivia game played by friends in a group chat. Every prompt asks players to NAME something; any correct answer counts, and RARER correct answers score more. The fun is digging for the deep cut nobody else thought of.

Given a player's interest, design the game so it feels made by a fan of that interest:

PROMPTS (exactly ${PROMPTS_PER_GAME}):
- Each is a short "Name a ..." / "Name any ..." style prompt with a LARGE, well-defined, checkable answer set (at least 40 real answers), from obvious to obscure.
- Answers must be short names (1-4 words): places, things, gear, techniques, terms, events, characters, works, people, slang. Never opinions ("best", "favorite"), sentences or numbers.
- Cover ${PROMPTS_PER_GAME} different kinds of things. Include at least one playful one only fans would get (jargon, things people shout, in-jokes).
- Order from easiest to hardest. The first prompt should be answerable by a casual fan.
- "hint" says exactly what counts, in under 70 characters (e.g. "Any named route, any style, anywhere").

WORLD:
- title: original and punchy, <= 26 chars, no brand names.
- tagline: <= 60 chars.
- host: a character who would host this in-world (name <= 18 chars, one emoji, intro <= 90 chars in their voice).
- meter: a progress metaphor that fits the interest. Points convert to it. label (e.g. "Altitude"), unit (e.g. "m"), perPoint (number, so 700 points feels big), up (true if it climbs, false if it descends), icon (one emoji).
- tiers: 6 rarity tier names in the interest's own language, from most common to rarest. The last one should feel legendary (e.g. for climbing: "Jug", "Pocket", "Sloper", "Crimp", "Mono", "First Ascent").
- palette: hex colors evoking the interest. bg and bg2 (gradient), card (panel color), primary (main action), accent (highlight), text (must be highly readable on bg AND card).
- scene: the pixel-art world the player travels through as they score (their "meter" journey). kind is one of:
  "cliff" (climb up a rock face: climbing, mountaineering), "track" (race up a circuit: motorsport, cycling, running, racing),
  "ocean" (sink into the deep: diving, fishing, sailing, marine life), "space" (launch upward: space, sci-fi, astronomy),
  "tower" (climb a building or stage: music, cities, careers, fashion, gaming, film), "dig" (dig down through layers: history,
  archaeology, dinosaurs, geology, mining, true crime), "trail" (hike up hills and forest: nature, gardening, pets, camping, sports
  on grass), "kitchen" (rise up shelves: food, baking, coffee, cooking, drinks).
  start and end: two hex colors each for the sky/water gradient at the start and at the far end of the journey (e.g. day sky to
  starry night for a summit). ground: hex for the main material. props: 4-6 single emoji that belong in this world (gear, animals,
  landmarks), never people.
- avatar: one emoji for the player's marker (a person or vehicle doing the interest).
- verb: one short submit-button word in the interest's language (e.g. "Send", "Push", "Bake", "Dig", "Drop").
- meter.up must match the scene: false for ocean and dig, true otherwise.
- font: pick the one whose mood matches the interest best: "Rubik" (friendly, neutral), "Bricolage Grotesque" (quirky, artsy, indie), "Fraunces" (warm, crafty, food, books, history), "Space Grotesk" (tech, science, space, gaming), "Saira Condensed" (speed, motorsport, sports stats), "Baloo 2" (cute, pets, kids, cozy), "DM Serif Display" (elegant, fashion, music, film, classical), "Archivo Black" (loud, bold, extreme sports, hype). Don't default to one; match the mood.

Reply with only JSON:
{"title","tagline","scene":{"kind","start":[2 hex],"end":[2 hex],"ground","props":[emoji]},"avatar","verb","host":{"name","emoji","intro"},"meter":{"label","unit","perPoint","up","icon"},"tiers":[6 strings],"palette":{"bg","bg2","card","primary","accent","text"},"font","prompts":[{"q","hint"}]}`;

const ANSWERS_SYSTEM = `You write the answer key for a trivia prompt where any correct answer counts and rarer answers score more.

List 45-60 REAL, verifiable correct answers. For each:
- "a": the canonical short name (1-4 words), as fans would write it.
- "alias": other common names, spellings or abbreviations players might type (can be empty).
- "r": rarity tier 1-6 = how few fans would think of it. 1 = the first thing most people say; 6 = only deep experts. Aim for about 5 of tier 1, 7 of tier 2, 9 of tier 3, 10 of tier 4, 10 of tier 5, 8 of tier 6. Every answer must truly fit the prompt's category (e.g. no gear in a slang list).
- "note": for tiers 3-6, a fun fact in at most 9 words. Omit for tiers 1-2.
Never invent answers. If unsure something is real, leave it out.

Reply with only JSON: {"answers":[{"a","alias","r","note"}]}`;

function sanitizeWorld(raw: Record<string, unknown>, interest: string): World & { prompts: { q: string; hint?: string }[] } {
  const o = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
  const host = o(raw.host), meter = o(raw.meter), pal = o(raw.palette);
  const hex = (v: unknown, d: string) => (parseHex(v) ? String(v) : d);
  const bg = hex(pal.bg, "#1d2b3a");
  const card = hex(pal.card, "#26384b");
  let text = hex(pal.text, "#ffffff");
  text = ensureContrast(ensureContrast(text, bg, 4.5), card, 4.5);
  const tiers = Array.isArray(raw.tiers) ? raw.tiers.map((t) => cleanText(t, 18)).filter(Boolean) : [];
  const defaultsT = ["Common", "Known", "Nice", "Deep cut", "Rare", "Legendary"];
  const prompts = (Array.isArray(raw.prompts) ? raw.prompts : [])
    .map((p) => ({ q: cleanText(o(p).q, 70), hint: cleanText(o(p).hint, 80) || undefined }))
    .filter((p) => p.q)
    .slice(0, PROMPTS_PER_GAME);
  const per = Number(meter.perPoint);
  const scened = withScene({ interest, scene: raw.scene as Scene | undefined, avatar: raw.avatar as string | undefined, verb: cleanText(raw.verb, 10) || undefined } as Parameters<typeof withScene>[0]);
  return {
    scene: scened.scene,
    avatar: scened.avatar,
    verb: scened.verb,
    interest,
    title: cleanText(raw.title, 26) || `${interest} deep cuts`,
    tagline: cleanText(raw.tagline, 60) || "Name the answer nobody else will.",
    host: { name: cleanText(host.name, 18) || "Your host", emoji: typeof host.emoji === "string" && host.emoji.length <= 8 ? host.emoji : "🎙️", intro: cleanText(host.intro, 90) || "Name it. The rarer, the better." },
    meter: {
      label: cleanText(meter.label, 16) || "Score",
      unit: cleanText(meter.unit, 6),
      perPoint: Number.isFinite(per) && per > 0 && per < 10000 ? per : 10,
      up: scened.scene.kind === "ocean" || scened.scene.kind === "dig" ? false : meter.up !== false,
      icon: typeof meter.icon === "string" && meter.icon.length <= 8 ? meter.icon : "⭐",
    },
    tiers: [0, 1, 2, 3, 4, 5].map((i) => tiers[i] || defaultsT[i]) as World["tiers"],
    palette: {
      bg,
      bg2: hex(pal.bg2, bg),
      card,
      primary: ensureContrast(hex(pal.primary, "#ffb020"), card, 2.5),
      accent: ensureContrast(hex(pal.accent, "#4fd1a5"), card, 2.5),
      text,
    },
    font: (FONTS as readonly string[]).includes(String(raw.font)) ? (raw.font as Font) : "Rubik",
    prompts,
  };
}

function sanitizeAnswers(raw: unknown): Answer[] {
  const list = raw && typeof raw === "object" && Array.isArray((raw as { answers?: unknown }).answers) ? (raw as { answers: unknown[] }).answers : [];
  const seen = new Set<string>();
  const out: Answer[] = [];
  for (const x of list) {
    if (!x || typeof x !== "object") continue;
    const r = x as Record<string, unknown>;
    const a = cleanText(r.a, 40);
    const k = norm(a);
    if (!a || !k || seen.has(k)) continue;
    seen.add(k);
    const tier = Math.min(6, Math.max(1, Math.round(Number(r.r) || 3)));
    const alias = Array.isArray(r.alias) ? r.alias.map((s) => cleanText(s, 40)).filter((s) => s && norm(s) !== k).slice(0, 6) : [];
    out.push({ a, alias, r: tier, note: cleanText(r.note, 70) || undefined });
  }
  return out;
}

export async function generatePack(rawInterest: string, onStage: (s: string) => void = () => {}): Promise<{ pack: Pack; ms: number; costUsd: number }> {
  const interest = normalizeInterest(rawInterest) || "trivia";
  const t0 = performance.now();
  let cost = 0;
  onStage("designing the world");
  const w = await chatJSON(
    [
      { role: "system", content: WORLD_SYSTEM },
      { role: "user", content: `Interest: ${JSON.stringify(interest)}` },
    ],
    { maxTokens: 5000, timeoutMs: 60000, reasoning: "low", temperature: 0.9, task: "rarity.world" },
  );
  cost += w.costUsd;
  const world = sanitizeWorld(extractJson(w.text) as Record<string, unknown>, interest);
  if (world.prompts.length < 5) throw new Error(`only ${world.prompts.length} prompts generated`);
  onStage(`writing answer keys for ${world.prompts.length} prompts`);

  const prompts: Prompt[] = await Promise.all(
    world.prompts.map(async (p) => {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const r = await chatJSON(
            [
              { role: "system", content: ANSWERS_SYSTEM },
              { role: "user", content: `Interest: ${interest}\nPrompt: ${p.q}\nWhat counts: ${p.hint ?? "any correct answer"}` },
            ],
            { maxTokens: 9000, timeoutMs: 90000, reasoning: "low", temperature: 0.4, task: "rarity.answers" },
          );
          cost += r.costUsd;
          const answers = sanitizeAnswers(extractJson(r.text));
          if (answers.length >= 20) return { ...p, answers };
        } catch {
          /* retry once */
        }
      }
      return { ...p, answers: [] };
    }),
  );
  const good = prompts.filter((p) => p.answers.length >= 20);
  if (good.length < 5) throw new Error("answer keys came back too thin");
  return { pack: { ...world, prompts: good.slice(0, PROMPTS_PER_GAME) }, ms: Math.round(performance.now() - t0), costUsd: cost };
}

/** Judge an answer that isn't on the list. Fast model; strict. */
export async function judgeAnswer(interest: string, prompt: Prompt, guess: string): Promise<{ valid: boolean; a?: string; r?: number; note?: string; reason?: string; costUsd: number }> {
  const sample = prompt.answers.slice(0, 25).map((x) => x.a).join(", ");
  const r = await chatJSON(
    [
      {
        role: "system",
        content: `You referee a trivia game. Decide if the player's answer is a REAL, correct answer to the prompt. Be strict: reject made-up things, things that don't fit the prompt, vague or joke answers, and answers that are just a restatement of the prompt. Accept real but unlisted answers, minor misspellings and other valid names.
If valid: give the canonical name "a", rarity tier "r" 1-6 (6 = only deep experts would know it), and a fun "note" (<= 9 words).
If invalid: give a short friendly "reason" (<= 8 words).
Reply with only JSON: {"valid":true|false,"a","r","note","reason"}`,
      },
      { role: "user", content: `Interest: ${interest}\nPrompt: ${prompt.q}\nWhat counts: ${prompt.hint ?? "-"}\nSome listed answers: ${sample}\nPlayer's answer: ${JSON.stringify(guess)}` },
    ],
    { maxTokens: 1500, timeoutMs: 15000, reasoning: "low", temperature: 0, model: process.env.SIDEQUEST_JUDGE_MODEL || "muse-ember-1.0", task: "rarity.judge" },
  );
  const j = extractJson(r.text) as Record<string, unknown>;
  const valid = j.valid === true;
  return {
    valid,
    a: valid ? cleanText(j.a, 40) || cleanText(guess, 40) : undefined,
    r: valid ? Math.min(6, Math.max(1, Math.round(Number(j.r) || 4))) : undefined,
    note: valid ? cleanText(j.note, 70) || undefined : undefined,
    reason: valid ? undefined : cleanText(j.reason, 60) || "That doesn't fit this one",
    costUsd: r.costUsd,
  };
}

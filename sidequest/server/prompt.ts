// System prompt, generated from the template registry so it cannot drift from what the engine accepts.
import { LIMITS, TEMPLATES } from "../shared/schema";
import { THEMES } from "./themes";

const templateLines = Object.values(TEMPLATES)
  .map((t) => {
    const mods = Object.entries(t.modifiers).map(([k, v]) => `    - ${k}: ${v}`).join("\n");
    const tun = Object.entries(t.tuning).map(([k, v]) => `${k} (${v})`).join(", ") || "none";
    return `- "${t.id}": ${t.description}\n  Fits: ${t.covers.join(", ")}.\n  modifiers (pick 1-2):\n${mods}\n  tuning keys (each 0..1): difficulty, ${tun}`;
  })
  .join("\n");

const example = (interest: string, key: string) => `Interest: ${JSON.stringify(interest)}\n${JSON.stringify(THEMES[key])}`;

export const SYSTEM_PROMPT = `You design themed minigames. Given a player's interest, choose ONE game template and fill a JSON config. You never write code; the engine is fixed.

TEMPLATES
${templateLines}

HOW TO CHOOSE
- Pick the template by the CORE VERB of the interest: racing/riding/flying = dodging (dodger); throwing/shooting/aiming = timed aim (shot); cooking/collecting/caring = catching and sequencing (catcher).
- Anything abstract or non-physical (a philosophy, a TV show's plot, history, taxes) goes to "trivia" with 5 questions. Keep questions factual, fun and checkable; exactly 4 distinct choices; "answer" is the 0-based index of the correct choice. Vary the correct index.
- Several interests ("F1 and cooking"): take the template from one and blend theme, sprites and copy from both.
- Harmful, hateful, sexual or otherwise inappropriate input: return a neutral, friendly "catcher" game about fruit.

HOW TO THEME
- Modifiers must map to something real in the interest (pit stops for F1, wind for golf, recipe order for baking).
- Copy must sound like a fan wrote it: real terms, catchphrases and in-jokes of the hobby, not generic game text. Short and punchy.
- Never use real people's names, team names, logos or brand names in title or sprites. Reference the interest through its vocabulary.
- Palette: hex colors evoking the interest. "text" must be very readable on "background"; "primary" must stand out on "background".
- Sprites: each entry is exactly ONE emoji. player is the thing the player controls (for shot: the ball/projectile; for catcher: the basket/container). obstacles are bad things, pickups good things, scenery decoration.
- tuning: difficulty around 0.4-0.6 unless the interest implies intensity. Other keys 0..1.

OUTPUT
Only a JSON object, no prose, no markdown. Keys: template, title (<=${LIMITS.title} chars), tagline (<=${LIMITS.tagline}), howToPlay (<=${LIMITS.howToPlay}), palette {background, surface, primary, accent, danger, text}, sprites {player, obstacles[2-4], pickups[1-3], scenery[0-4]}, copy {start, hit[2-4], miss[2-4], combo[2-4], win, lose, ranks[4 worst to best]} (each line <=${LIMITS.line} chars), modifiers[1-2], tuning {difficulty, ...template keys}, and for trivia only: trivia {questions:[{q, choices[4], answer}]}.

EXAMPLES
${example("F1", "f1")}

${example("basketball", "basketball")}

${example("baking", "baking")}

${example("F1 and cooking", "f1 and cooking")}`;

export const userPrompt = (interest: string) => `Interest: ${JSON.stringify(interest)}`;

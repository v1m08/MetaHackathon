// Template registry: the single source of truth for what each template accepts. The system prompt, the
// sanitizer and the templates all read from here, so they cannot drift apart.
import type { Palette, Sprites, Copy, TemplateId } from "./types";

export interface TemplateMeta {
  id: TemplateId;
  /** One or two lines for the prompt. */
  description: string;
  /** Interests this template fits, for the prompt and the keyword fallback. */
  covers: string[];
  modifiers: Record<string, string>;
  tuning: Record<string, string>;
  defaults: { palette: Palette; sprites: Sprites; copy: Copy; modifiers: string[] };
}

const neutralCopy: Copy = {
  start: "Go!",
  hit: ["Nice!", "Clean!", "Sweet!"],
  miss: ["Oof!", "So close!", "Shake it off"],
  combo: ["On fire!", "Unstoppable!", "Combo!"],
  win: "You crushed it!",
  lose: "Run it back!",
  ranks: ["Rookie", "Regular", "Pro", "Legend"],
};

export const TEMPLATES: Record<TemplateId, TemplateMeta> = {
  dodger: {
    id: "dodger",
    description: "Top-down avoider. Drag left/right to dodge falling obstacles and grab pickups while speed ramps up. 3 lives, 40 s.",
    covers: ["racing", "F1", "cycling", "skiing", "snowboarding", "space", "surfing", "driving", "swimming", "running", "rowing", "sailing", "flying"],
    modifiers: {
      boost_pads: "speed-burst pads on the track: brief invulnerability and double points",
      pit_stop: "a pit box appears on the side; driving into it pauses you but raises the score multiplier",
      slalom_gates: "pairs of flags; passing between them gives a bonus",
      drafting: "a pace object ahead; staying in its wake grows a multiplier",
    },
    tuning: { speed: "base scroll speed", obstacleDensity: "how many obstacles spawn", pickupRate: "how often pickups appear" },
    defaults: {
      palette: { background: "#16161d", surface: "#2a2a35", primary: "#ff4d4d", accent: "#ffd23f", danger: "#ff3860", text: "#ffffff" },
      sprites: { player: "🏎️", obstacles: ["🚧", "🛢️", "🪨"], pickups: ["⭐", "🪙"], scenery: ["🌲", "🏁"] },
      copy: { ...neutralCopy, start: "Lights out!" },
      modifiers: ["boost_pads"],
    },
  },
  shot: {
    id: "shot",
    description: "Timing and aim. An aim arrow swings; tap to shoot at a target that moves and shrinks. 10 attempts.",
    covers: ["basketball", "golf", "archery", "darts", "soccer", "football", "bowling", "cornhole", "fishing", "hockey", "baseball", "tennis"],
    modifiers: {
      wind: "a crosswind drifts each shot; shown by an indicator",
      moving_target: "the target slides side to side",
      streak_fire: "three makes in a row doubles points until you miss",
      defender: "a blocker sweeps across the shot path",
    },
    tuning: { meterSpeed: "how fast the aim swings", targetSize: "how big the target is (higher = bigger)", targetSpeed: "how fast the target moves" },
    defaults: {
      palette: { background: "#0f1b2d", surface: "#1f3350", primary: "#ff8a3d", accent: "#ffd166", danger: "#ef476f", text: "#ffffff" },
      sprites: { player: "🏀", obstacles: ["🙅", "🧱"], pickups: ["🎯"], scenery: ["⭐", "🏆"] },
      copy: { ...neutralCopy, start: "Your shot!" },
      modifiers: ["streak_fire"],
    },
  },
  catcher: {
    id: "catcher",
    description: "Items fall; drag a basket to catch the good ones and dodge the bad ones. 3 lives, 40 s.",
    covers: ["cooking", "baking", "coffee", "fashion", "gardening", "shopping", "collecting", "pets", "food", "candy", "fruit", "cats"],
    modifiers: {
      recipe_order: "a recipe shows 3 items; catch them in order for a big bonus",
      golden_item: "rare golden item worth 5x",
      stack_tower: "caught items stack up and raise the multiplier, but moving fast can topple them",
      rush_hour: "periodic burst waves of falling items",
    },
    tuning: { fallSpeed: "how fast items fall", spawnRate: "how often items spawn", badItemRatio: "share of bad items" },
    defaults: {
      palette: { background: "#fff4e6", surface: "#ffe0b8", primary: "#d9480f", accent: "#2b8a3e", danger: "#c92a2a", text: "#2b1a0e" },
      sprites: { player: "🧺", obstacles: ["💣", "🪳"], pickups: ["🍎", "🍓", "🍪"], scenery: ["✨", "🌼"] },
      copy: { ...neutralCopy, start: "Catch 'em!" },
      modifiers: ["golden_item"],
    },
  },
  trivia: {
    id: "trivia",
    description: "Five timed multiple-choice questions written for the interest. For abstract or non-physical interests.",
    covers: ["philosophy", "history", "tv shows", "books", "movies", "science", "politics", "taxes", "economics", "languages"],
    modifiers: {
      speed_bonus: "faster correct answers earn more points",
      double_down: "the last question is worth double",
    },
    tuning: {},
    defaults: {
      palette: { background: "#1b1035", surface: "#2d1d55", primary: "#9b5de5", accent: "#00f5d4", danger: "#f15bb5", text: "#ffffff" },
      sprites: { player: "🧠", obstacles: ["❌"], pickups: ["✅"], scenery: ["💡", "📚"] },
      copy: { ...neutralCopy, start: "Brains on!" },
      modifiers: ["speed_bonus"],
    },
  },
};

export const TEMPLATE_IDS = Object.keys(TEMPLATES) as TemplateId[];

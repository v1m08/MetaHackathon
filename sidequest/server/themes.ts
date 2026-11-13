// Hand-written themes. Used as few-shot examples in the prompt and by the offline keyword fallback.
// Each is a partial GameConfig; sanitizeConfig fills in the rest.
import type { GameConfig } from "../shared/schema";

export type Theme = Omit<GameConfig, "version" | "interest" | "trivia">;

export const THEMES: Record<string, Theme> = {
  f1: {
    template: "dodger",
    title: "Pit Lane Panic",
    tagline: "Box, box! Keep it out of the wall.",
    howToPlay: "Drag to steer. Dodge debris, grab tyres, hit the pit box.",
    palette: { background: "#15151e", surface: "#2b2b38", primary: "#e10600", accent: "#ffd400", danger: "#ff5e5e", text: "#ffffff" },
    sprites: { player: "🏎️", obstacles: ["🚧", "🛞", "🪨"], pickups: ["🏁", "⏱️"], scenery: ["🏟️", "🚩"] },
    copy: {
      start: "Lights out!",
      hit: ["Purple sector!", "Send it!", "Clean overtake!"],
      miss: ["Into the gravel!", "Track limits!", "Yellow flag!"],
      combo: ["DRS enabled!", "Fastest lap!", "Undercut!"],
      win: "Chequered flag. P1!",
      lose: "Retired from the race.",
      ranks: ["Backmarker", "Midfield", "Podium", "World Champ"],
    },
    modifiers: ["pit_stop", "drafting"],
    tuning: { difficulty: 0.55, speed: 0.7, obstacleDensity: 0.5, pickupRate: 0.5 },
  },
  basketball: {
    template: "shot",
    title: "Buzzer Beater",
    tagline: "Three seconds left. Ice in your veins?",
    howToPlay: "Tap when the arrow lines up with the hoop. 10 shots.",
    palette: { background: "#1d1208", surface: "#3a2414", primary: "#ff7a1a", accent: "#ffe08a", danger: "#ff4d6d", text: "#fff8ef" },
    sprites: { player: "🏀", obstacles: ["🙅", "✋"], pickups: ["🗑️"], scenery: ["🏆", "📣"] },
    copy: {
      start: "Tip-off!",
      hit: ["Swish!", "Nothing but net!", "Bucket!"],
      miss: ["Brick!", "Airball!", "Off the rim!"],
      combo: ["He's on fire!", "Heat check!", "Splash!"],
      win: "Game winner at the buzzer!",
      lose: "Rough shooting night.",
      ranks: ["Bench Warmer", "Sixth Man", "All-Star", "MVP"],
    },
    modifiers: ["streak_fire", "defender"],
    tuning: { difficulty: 0.5, meterSpeed: 0.5, targetSize: 0.5, targetSpeed: 0.4 },
  },
  baking: {
    template: "catcher",
    title: "Proof Positive",
    tagline: "Catch the good stuff. Keep the oven mitts on.",
    howToPlay: "Drag the bowl. Catch ingredients in recipe order, dodge the burnt bits.",
    palette: { background: "#fff3e3", surface: "#f6d7b0", primary: "#b5541c", accent: "#3f8f4f", danger: "#c0392b", text: "#3b2412" },
    sprites: { player: "🥣", obstacles: ["🔥", "🧂"], pickups: ["🥚", "🧈", "🌾"], scenery: ["🥐", "🍰"] },
    copy: {
      start: "Preheat to 220°!",
      hit: ["Perfect crumb!", "Golden brown!", "Nice rise!"],
      miss: ["Soggy bottom!", "Overproofed!", "Burnt!"],
      combo: ["Star baker!", "Handshake!", "Showstopper!"],
      win: "Out of the oven, perfect bake.",
      lose: "It collapsed in the oven.",
      ranks: ["Home Cook", "Bake Sale Hero", "Pâtissier", "Star Baker"],
    },
    modifiers: ["recipe_order", "golden_item"],
    tuning: { difficulty: 0.45, fallSpeed: 0.5, spawnRate: 0.5, badItemRatio: 0.35 },
  },
  // Multi-interest blend example: template from F1 (dodging), theme from both.
  "f1 and cooking": {
    template: "dodger",
    title: "Grand Prix Kitchen",
    tagline: "Race through a kitchen at 300 km/h.",
    howToPlay: "Drag to steer. Dodge spills, grab ingredients, draft the waiter.",
    palette: { background: "#1e1a17", surface: "#3a322c", primary: "#ff5a36", accent: "#ffd166", danger: "#ff4d6d", text: "#fffaf3" },
    sprites: { player: "🏎️", obstacles: ["🍳", "🔪", "🫕"], pickups: ["🍅", "🧄", "🌶️"], scenery: ["🧑‍🍳", "🏁"] },
    copy: {
      start: "Lights out, chef!",
      hit: ["Yes, chef!", "Mise en place!", "Seasoned!"],
      miss: ["Spilled the sauce!", "Burnt the roux!", "86'd!"],
      combo: ["Michelin pace!", "Hot pan, hot lap!", "Service!"],
      win: "Chequered flag, five stars.",
      lose: "Kitchen's closed.",
      ranks: ["Dishwasher", "Line Cook", "Sous Chef", "Head Chef"],
    },
    modifiers: ["drafting", "boost_pads"],
    tuning: { difficulty: 0.5, speed: 0.6, obstacleDensity: 0.5, pickupRate: 0.6 },
  },
};

/** Keyword → theme key or a minimal theme. Order matters: first match wins. */
export const KEYWORDS: [RegExp, Theme | string][] = [
  [/\b(f1|formula|grand prix|nascar|racing|race car|motorsport|kart)/i, "f1"],
  [/\b(basketball|nba|hoops?|dunk)/i, "basketball"],
  [/\b(bak(e|ing)|sourdough|bread|cake|pastr|cookie|cupcake)/i, "baking"],
  [/\b(cook|chef|kitchen|recipe|pasta|pizza|food|sushi|ramen|taco)/i, {
    ...mini("catcher", "Order Up!", "🍳", ["🔥", "🧯"], ["🍅", "🧀", "🍝"], "#fff1e6", "#e8590c", "#2b8a3e"),
    modifiers: ["recipe_order", "rush_hour"],
  }],
  [/\b(coffee|espresso|latte|cafe|barista)/i, mini("catcher", "Bean There", "☕", ["🧊", "🫗"], ["🫘", "🥛", "🍪"], "#f5ebe0", "#6f4518", "#386641")],
  [/\b(soccer|football|futbol|penalt)/i, mini("shot", "Top Bins", "⚽", ["🧤", "🧍"], ["🥅"], "#0b3d20", "#ffffff", "#ffd60a")],
  [/\b(golf|putt)/i, mini("shot", "Fore Play", "⛳", ["🌳", "🏖️"], ["🕳️"], "#1b4332", "#ffffff", "#ffd166")],
  [/\b(archery|arrow|bow)/i, mini("shot", "Bullseye Rush", "🏹", ["🌬️", "🪵"], ["🎯"], "#2d1e12", "#ff9f1c", "#e9ff70")],
  [/\b(dart)/i, mini("shot", "Oche Showdown", "🎯", ["🍺", "🙅"], ["🎯"], "#101820", "#e63946", "#f1fa8c")],
  [/\b(bowling)/i, mini("shot", "Strike Zone", "🎳", ["🧱", "🙅"], ["🎳"], "#1a1033", "#ff4fa3", "#7df9ff")],
  [/\b(fish|angl)/i, mini("shot", "Reel Deal", "🎣", ["🦈", "🥾"], ["🐟"], "#03224c", "#4cc9f0", "#ffd166")],
  [/\b(tennis|pickleball|padel)/i, mini("shot", "Ace Hunter", "🎾", ["🧍", "🥅"], ["🎯"], "#0f3d2e", "#d4ff3a", "#ffffff")],
  [/\b(space|rocket|nasa|astronaut|planet|star ?ship|galaxy)/i, mini("dodger", "Orbit Dash", "🚀", ["☄️", "🛰️", "🪨"], ["⭐", "🪐"], "#070b1f", "#7b61ff", "#ffd166", ["boost_pads", "slalom_gates"])],
  [/\b(ski|snowboard|snow)/i, mini("dodger", "Fresh Pow", "⛷️", ["🌲", "🪨", "⛄"], ["❄️", "⭐"], "#e8f4ff", "#1d4ed8", "#f97316", ["slalom_gates"])],
  [/\b(surf|wave|beach)/i, mini("dodger", "Barrel Run", "🏄", ["🦈", "🪸", "🪼"], ["🐚", "⭐"], "#023e8a", "#ffd166", "#90e0ef", ["boost_pads"])],
  [/\b(cycl|bike|bicycle|tour de)/i, mini("dodger", "Peloton Panic", "🚴", ["🚧", "🕳️", "🐑"], ["🍌", "💧"], "#1f2a1f", "#ffd400", "#a3e635", ["drafting"])],
  [/\b(swim|pool)/i, mini("dodger", "Lane Six", "🏊", ["🪼", "🦀", "🛟"], ["⭐", "🥇"], "#03045e", "#48cae4", "#ffd60a", ["boost_pads"])],
  [/\b(driv|car|truck)/i, mini("dodger", "Rush Hour", "🚗", ["🚕", "🚙", "🚧"], ["⛽", "⭐"], "#202124", "#fbbc04", "#34a853", ["boost_pads"])],
  [/\b(cat|kitten|kitty)/i, mini("catcher", "Treat Time", "🐱", ["🥒", "💧"], ["🐟", "🧶", "🐭"], "#fef6e4", "#f582ae", "#8bd3dd")],
  [/\b(dog|puppy|pup)/i, mini("catcher", "Good Boy Points", "🐶", ["🛁", "🐝"], ["🦴", "🎾", "🥩"], "#fdf0d5", "#c1121f", "#003049")],
  [/\b(garden|plant|flower)/i, mini("catcher", "Green Thumb", "🪴", ["🐛", "🐌"], ["🌻", "💧", "🌷"], "#f1faee", "#2d6a4f", "#e76f51")],
  [/\b(fashion|outfit|thrift|shopping|style)/i, mini("catcher", "Fit Check", "🛍️", ["🧦", "🩴"], ["👗", "👠", "🕶️"], "#fff0f6", "#c2255c", "#5f3dc4")],
  [/\b(k-?pop|music|band|concert|singer|idol|dance)/i, mini("catcher", "Encore", "🎤", ["📵", "🔇"], ["🎵", "💖", "🎶"], "#14001f", "#ff4fd8", "#00e5ff", ["rush_hour", "golden_item"])],
  [/\b(dino|jurassic|🦖|🦕)/i, mini("dodger", "Extinction Run", "🦖", ["☄️", "🌋", "🪨"], ["🥚", "🦴"], "#1f2d16", "#f77f00", "#fcbf49", ["boost_pads"])],
];

function mini(
  template: Theme["template"],
  title: string,
  player: string,
  obstacles: string[],
  pickups: string[],
  bg: string,
  primary: string,
  accent: string,
  modifiers?: string[],
): Theme {
  return {
    template,
    title,
    tagline: "",
    howToPlay: "",
    palette: { background: bg, surface: bg, primary, accent, danger: "#ff4d6d", text: "#ffffff" },
    sprites: { player, obstacles, pickups, scenery: [] },
    copy: {} as Theme["copy"],
    modifiers: modifiers ?? [],
    tuning: { difficulty: 0.5 },
  };
}

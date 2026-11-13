export type TemplateId = "dodger" | "shot" | "catcher" | "trivia" | "wordhunt";

/** Display faces a theme may use (all on Google Fonts). The house face for pieces is always Rubik. */
export const DISPLAY_FONTS = ["Saira Condensed", "Rubik", "Bricolage Grotesque", "Fraunces", "Bungee", "Baloo 2", "Space Grotesk", "Righteous"] as const;
export type DisplayFont = (typeof DISPLAY_FONTS)[number];
/** Table surfaces drawn in code; the theme picks one. */
export const SURFACES = ["pitlane", "felt", "wood", "paper", "night", "court", "kitchen"] as const;
export type Surface = (typeof SURFACES)[number];

export interface WordHuntConfig {
  themed: { word: string; hint: string }[];
  surface: Surface;
  font: DisplayFont;
  /** What a found word, a themed word and a repeat are called in this theme. */
  labels: { word: string; themed: string; repeat: string };
}

export interface Palette {
  background: string;
  surface: string;
  primary: string;
  accent: string;
  danger: string;
  text: string;
}

export interface Sprites {
  player: string;
  obstacles: string[];
  pickups: string[];
  scenery: string[];
}

export interface Copy {
  start: string;
  hit: string[];
  miss: string[];
  combo: string[];
  win: string;
  lose: string;
  ranks: [string, string, string, string];
}

export interface TriviaQuestion {
  q: string;
  choices: [string, string, string, string];
  answer: 0 | 1 | 2 | 3;
}

export interface GameConfig {
  version: 1;
  template: TemplateId;
  interest: string;
  title: string;
  tagline: string;
  howToPlay: string;
  palette: Palette;
  sprites: Sprites;
  copy: Copy;
  modifiers: string[];
  tuning: { difficulty: number; [key: string]: number };
  trivia?: { questions: TriviaQuestion[] };
  wordhunt?: WordHuntConfig;
}

/** What a challenge link carries. */
export interface SharePayload {
  config: GameConfig;
  scoreToBeat?: number;
}

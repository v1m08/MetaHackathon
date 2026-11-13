export type TemplateId = "dodger" | "shot" | "catcher" | "trivia";

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
}

/** What a challenge link carries. */
export interface SharePayload {
  config: GameConfig;
  scoreToBeat?: number;
}

// Offline config: keyword map → theme, else a neutral catcher with the interest in the title. No network.
import { asEmoji, cleanText, sanitizeConfig, titleCase, type GameConfig } from "../shared/schema";
import { KEYWORDS, THEMES, type Theme } from "./themes";

export function fallbackConfig(interest: string): GameConfig {
  for (const [re, t] of KEYWORDS) {
    if (re.test(interest)) {
      const theme: Theme = typeof t === "string" ? THEMES[t] : t;
      return sanitizeConfig({ ...theme, interest, title: theme.title, tagline: theme.tagline || `A tiny game about ${interest}.` }, interest);
    }
  }
  const emoji = asEmoji(interest);
  const name = cleanText(titleCase(interest), 20);
  return sanitizeConfig(
    {
      template: "catcher",
      interest,
      title: emoji ? `${emoji} Catch` : `${name} Catch`,
      tagline: `How much ${interest} can you handle?`,
      howToPlay: "Drag to catch the good stuff. Dodge the bombs.",
      sprites: emoji ? { player: "🧺", obstacles: ["💣", "🌧️"], pickups: [emoji, "⭐"], scenery: [] } : undefined,
      modifiers: ["golden_item", "rush_hour"],
      tuning: { difficulty: 0.45 },
    },
    interest,
  );
}

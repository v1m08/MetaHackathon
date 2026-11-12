import type { Game } from "@/types";

export const games: Game[] = [
  { id: "gm_tapdash", name: "Tap Dash", icon: "⚡", genre: "Reaction", players: "2.1M playing", playable: true,
    description: "Tap the tile the moment it lights up. 20 rounds. Your friends' best times are on the board. Devon is not as fast as he claims.",
    leaderboard: [{ userId: "zoe", score: 214 }, { userId: "priya", score: 231 }, { userId: "devon", score: 238 }, { userId: "marcus", score: 247 }, { userId: "tyler", score: 262 }, { userId: "maya", score: 268 }, { userId: "sam", score: 275 }, { userId: "ethan", score: 281 }] },
  { id: "gm_wordrush", name: "Word Rush", icon: "🔤", genre: "Word", players: "8.4M playing", playable: true,
    description: "Find as many words as you can from 9 letters in 60 seconds. Hannah plays this during recess and it shows.",
    leaderboard: [{ userId: "hannah", score: 4120 }, { userId: "priya", score: 3880 }, { userId: "aisha", score: 3650 }, { userId: "omar", score: 3400 }, { userId: "grace", score: 2910 }, { userId: "lucas", score: 2200 }] },
  { id: "gm_bubble", name: "Bubble Burst Saga", icon: "🫧", genre: "Puzzle", players: "31M playing",
    description: "Match three bubbles to pop them. 2,400 levels. Nina is on level 1,180 and refuses to discuss it.",
    leaderboard: [{ userId: "nina", score: 1180 }, { userId: "grace", score: 640 }, { userId: "hannah", score: 512 }, { userId: "tyler", score: 97 }] },
  { id: "gm_8ball", name: "8 Ball Pool", icon: "🎱", genre: "Sports", players: "14M playing",
    description: "Classic pool with friends. Winner keeps the coins. Sam has been hustling this group since 2022.",
    leaderboard: [{ userId: "sam", score: 88 }, { userId: "devon", score: 71 }, { userId: "jordan", score: 66 }, { userId: "tyler", score: 40 }, { userId: "ethan", score: 38 }] },
  { id: "gm_farm", name: "Hillside Farm", icon: "🌾", genre: "Simulation", players: "6.7M playing",
    description: "Grow crops, trade with neighbors, raise a questionable number of chickens. Omar treats it like a materials science experiment.",
    leaderboard: [{ userId: "omar", score: 54 }, { userId: "nina", score: 49 }, { userId: "aisha", score: 31 }, { userId: "zoe", score: 22 }] },
  { id: "gm_trivia", name: "Trivia Night Live", icon: "🧠", genre: "Trivia", players: "3.3M playing",
    description: "Live 12-question rounds every hour. Team up with friends. The 9pm round is the hard one.",
    leaderboard: [{ userId: "priya", score: 9870 }, { userId: "omar", score: 9410 }, { userId: "ethan", score: 8800 }, { userId: "aisha", score: 8650 }, { userId: "maya", score: 7900 }, { userId: "marcus", score: 5100 }] },
];

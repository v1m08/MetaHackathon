// Seeded daily-game history for the Streaks tab: one DM per critter friend, played on enough past days to give the
// room a spread. Literal data only; it is appended to seedGames (src/data/play.ts), so src/lib/play/seed.ts turns it
// into games and play events like any other seeded day. Nothing here is dated today, and every finish is within 9h
// of the 14:00 UTC drop, so it lands on its own day.
// Streaks at boot (no game today yet, so every live one is "at risk"):
//   aisha 21 · sofia 12 · ethan 5 · hannah 3 · grace 0 (a 6-day run ended 2 days ago) · lucas never played
//   jordan 2 comes from Chat Games' own c_maya_jordan seed and is left alone.
import type { ID } from "@/types";
import type { SeedGame, SeedPlay } from "./play";
import type { TopicId } from "@/lib/play/taxonomy";

type Who = "both" | "maya" | "friend";
/** A two-sided question: [prompt, option a, option b, cite]. Cites are interest ids every member can see. */
type Pair = [string, [string, TopicId?], [string, TopicId?], string];
interface Spec { cid: ID; friend: ID; titles: string[]; pairs: Pair[]; days: Record<number, Who> }

const run = (from: number, to: number, who: Who = "both") => Object.fromEntries(Array.from({ length: to - from + 1 }, (_, i) => [from + i, who])) as Record<number, Who>;

// Maya's interests: 0 trail running, 1 pottery, 2 matcha, 3 Figma, 4 thrifting, 5 Barton Springs.
const SPECS: Spec[] = [
  {
    cid: "c_maya_aisha", friend: "aisha",
    titles: ["Saturday, split two ways", "Market morning", "Plan the potluck", "Pick a side"],
    pairs: [
      ["Saturday starts at", ["the farmers market, 8am", "food"], ["brunch, 11am", "food"], "int:aisha:3"],
      ["Friday night", ["afrobeats at the Mohawk", "music"], ["matcha and journaling", "coffee"], "int:aisha:2"],
      ["Volunteer shift", ["the health fair table", "community"], ["the mutual aid fridge", "community"], "int:aisha:1"],
      ["Morning ritual", ["matcha, whisked properly", "coffee"], ["three pages in the journal"], "int:maya:2"],
      ["Sunday reset", ["Barton Springs", "water"], ["thrift run on South Congress", "thrift"], "int:maya:5"],
    ],
    days: { ...run(1, 21), 22: "maya" },
  },
  {
    cid: "c_maya_sofia", friend: "sofia",
    titles: ["Setlist draft", "Darkroom or dance floor", "Cozy night in", "Weekend draft"],
    pairs: [
      ["Friday", ["Porch Lights at Hotel Vegas", "music"], ["movie night, popcorn", "film"], "int:sofia:4"],
      ["Record to put on", ["new indie rock", "music"], ["old jazz vinyl", "music"], "int:sofia:3"],
      ["Camera", ["35mm film", "film"], ["phone, no regrets"], "int:sofia:2"],
      ["Songwriting night", ["write a breakup song", "music"], ["write a song about tacos", "food"], "int:sofia:1"],
      ["Rainy Sunday", ["pottery studio", "art"], ["thrifting", "thrift"], "int:maya:1"],
    ],
    days: { ...run(1, 12), 13: "friend", ...run(14, 16) },
  },
  {
    cid: "c_maya_ethan", friend: "ethan",
    titles: ["Send or rest", "Race weekend", "Game night rules", "Trail or couch"],
    pairs: [
      ["Saturday morning", ["bouldering at Mueller", "outdoors"], ["Greenbelt hike", "outdoors"], "int:ethan:0"],
      ["Sunday 2pm", ["watch the F1 race"], ["hike while it's cool", "outdoors"], "int:ethan:3"],
      ["Game night", ["the one with the trains", "gaming"], ["something with no rules", "gaming"], "int:ethan:2"],
      ["Coffee order", ["pour-over, black", "coffee"], ["iced matcha", "coffee"], "int:ethan:1"],
      ["Post-climb", ["trail run to cool down", "running"], ["tacos immediately", "food"], "int:maya:0"],
    ],
    days: { ...run(1, 5), 6: "maya", ...run(7, 9) },
  },
  {
    cid: "c_maya_hannah", friend: "hannah",
    titles: ["Budget brain", "Crochet club", "TJ's haul"],
    pairs: [
      ["Payday treat", ["Trader Joe's haul", "food"], ["put it in savings"], "int:hannah:2"],
      ["Craft night", ["crochet a frog", "art"], ["throw a bowl", "art"], "int:hannah:1"],
      ["Saturday 9am", ["pilates", "fitness"], ["sleep in, obviously"], "int:hannah:3"],
      ["Book club pick", ["romance novel"], ["a design book", "art"], "int:maya:3"],
    ],
    days: { ...run(1, 3), 4: "friend" },
  },
  {
    cid: "c_maya_grace", friend: "grace",
    titles: ["Brunch draft", "Matcha flight", "Era check"],
    pairs: [
      ["Saturday", ["pilates, then brunch", "fitness"], ["brunch, skip pilates", "food"], "int:grace:0"],
      ["The rug", ["the warm vintage one", "home"], ["the clean modern one", "home"], "int:grace:4"],
      ["Drink", ["matcha flight", "coffee"], ["mimosa flight", "food"], "int:grace:2"],
      ["Road trip album", ["1989"], ["folklore"], "int:grace:3"],
      ["Thrift haul goal", ["a lamp for the living room", "thrift"], ["a denim jacket", "thrift"], "int:maya:4"],
    ],
    days: { 2: "maya", ...run(3, 8) },
  },
];

const sp = (pick: string, predict = pick) => ({ pick, predict });

function games(s: Spec): SeedGame[] {
  return Object.entries(s.days).map(([d, who]) => {
    const day = Number(d);
    const two = [s.pairs[day % s.pairs.length], s.pairs[(day + 2) % s.pairs.length]];
    const rounds = two.map(([prompt, a, b, cite], i) => ({
      id: `r${i + 1}`, kind: "split" as const, prompt,
      options: [{ id: "a", label: a[0], topic: a[1] }, { id: "b", label: b[0], topic: b[1] }],
      cites: [cite],
    }));
    const ab = (n: number) => (n % 2 ? "a" : "b");
    const plays: Record<ID, SeedPlay> = {};
    if (who !== "friend") plays.maya = { h: 0.5 + (day % 5) * 0.8, a: [sp(ab(day), ab(day + 1)), sp(ab(day + 1))] };
    if (who !== "maya") plays[s.friend] = { h: 1 + (day % 7) * 1.1, a: [sp(ab(day + 1), ab(day)), sp(ab(day + 1), ab(day))], react: day % 4 === 0 ? "🔥" : undefined };
    return {
      id: `pg_seed_st_${s.friend}_${day}`, conversationId: s.cid, day, format: "split" as const,
      topic: two[0][1][1] ?? two[0][2][1] ?? "food",
      title: s.titles[day % s.titles.length], premise: "Pick a side, then guess theirs.",
      rounds, plays,
    };
  });
}

export const streakSeedGames: SeedGame[] = SPECS.flatMap(games);

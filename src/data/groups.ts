import type { Group } from "@/types";
import { daysAgo, photo } from "./helpers";

export const groups: Group[] = [
  {
    id: "g_apartments",
    name: "Austin Apartment Hunting & Roommates (20s)",
    cover: photo("austin-apartments", 1200, 500),
    description:
      "For people in their 20s looking for apartments, sublets, and roommates in Austin. No brokers, no 'DM me for a deal' bots, no listings outside Travis/Williamson/Hays. Post the rent, the neighborhood, and the move-in date or it gets removed.",
    privacy: "private",
    memberIds: ["priya", "aisha", "maya", "hannah", "zoe", "grace", "ethan", "omar", "lucas", "nina", "tyler"],
    adminIds: ["aisha", "tyler"],
    tags: ["Housing", "Austin", "Roommates"],
    createdAt: "2021-03-10T00:00:00.000Z",
    rules: ["Include rent + neighborhood + move-in date", "No brokers or agents", "Report scams with the ⚠️ emoji so mods see it", "Be kind. Everyone here is stressed."],
    postsPerDay: 6,
  },
  {
    id: "g_runclub",
    name: "Austin Run Club (Town Lake Tuesdays)",
    cover: photo("town-lake-run", 1200, 500),
    description:
      "We run the Butler Trail every Tuesday at 6:30pm from the Auditorium Shores sign and Saturday long runs at 7am from Mozart's. All paces, nobody gets dropped. Post your PRs, your shoe questions, and your race pics.",
    privacy: "public",
    memberIds: ["maya", "omar", "grace", "ethan", "marcus", "aisha", "hannah", "lucas", "devon"],
    adminIds: ["maya", "omar"],
    tags: ["Running", "Fitness", "Austin"],
    createdAt: "2022-09-01T00:00:00.000Z",
    rules: ["All paces welcome", "No shoe brand wars (ok a little)", "Tag the group in race pics"],
    postsPerDay: 2,
  },
  {
    id: "g_cheapeats",
    name: "Cheap Eats ATX (under $15)",
    cover: photo("austin-tacos", 1200, 500),
    description:
      "Where to actually eat in Austin when rent is 60% of your income. Rule: the dish you're posting has to be under $15 with tax. Taco trucks strongly encouraged. Franklin BBQ is banned from discussion.",
    privacy: "public",
    memberIds: ["jordan", "maya", "priya", "devon", "sofia", "lucas", "hannah", "zoe", "tyler", "sam", "nina", "grace", "ethan"],
    adminIds: ["jordan"],
    tags: ["Food", "Austin", "Budget"],
    createdAt: "2020-11-15T00:00:00.000Z",
    rules: ["Under $15 after tax", "Say the price", "No chains unless it's a genuinely insane deal"],
    postsPerDay: 4,
  },
  {
    id: "g_thrift",
    name: "ATX Thrift, Flip & Mend",
    cover: photo("thrift-rack", 1200, 500),
    description:
      "Thrift hauls, flips, repairs, and 'is this worth anything' posts. Weekly meetup at the Goodwill on Lamar bins Sunday 10am. Sewing machine lending library pinned.",
    privacy: "public",
    memberIds: ["zoe", "sofia", "maya", "grace", "hannah", "sam", "lucas", "nina"],
    adminIds: ["zoe"],
    tags: ["Thrifting", "Fashion", "Sustainability"],
    createdAt: "2023-02-20T00:00:00.000Z",
    postsPerDay: 2,
  },
  {
    id: "g_volleyball",
    name: "Zilker Pickup Volleyball 🏐",
    cover: photo("volleyball-sand", 1200, 500),
    description:
      "Sunday 10am and Wednesday 6pm pickup at the Zilker sand courts. Bring water, bring a ball if you have one. Rotate in, don't hog the court, call your own lines.",
    privacy: "public",
    memberIds: ["devon", "tyler", "marcus", "nina", "jordan", "ethan", "sam", "grace"],
    adminIds: ["devon"],
    tags: ["Volleyball", "Sports", "Zilker"],
    createdAt: "2022-04-03T00:00:00.000Z",
    postsPerDay: 1,
  },
  {
    id: "g_postgrad",
    name: "Post-Grad Life in Austin (we're figuring it out)",
    cover: photo("austin-skyline-night", 1200, 500),
    description:
      "Graduated, stayed in Austin, now what. Jobs, layoffs, 401k questions, friend-making, 'is it normal to feel like this'. Anonymous posting via admin is allowed, just DM Hannah.",
    privacy: "private",
    memberIds: ["hannah", "maya", "grace", "aisha", "priya", "ethan", "tyler", "devon", "omar", "lucas", "nina", "marcus"],
    adminIds: ["hannah", "grace"],
    tags: ["Life", "Careers", "Austin"],
    createdAt: "2023-06-01T00:00:00.000Z",
    rules: ["No MLM recruiting", "No unsolicited financial advice", "Celebrate wins, big or tiny"],
    postsPerDay: 3,
  },
  {
    id: "g_atx_lny",
    name: "ATX Lunar New Year (20s & 30s)",
    cover: photo("atx-lny-group", 1200, 500),
    description:
      "Chinese, Vietnamese, Korean and everyone-adjacent young adults in Austin who want to actually celebrate instead of calling home and feeling bad. Potlucks, dumpling nights, mahjong that gets too serious.",
    privacy: "public",
    memberIds: ["maya", "hannah", "zoe", "grace", "ethan", "priya"],
    adminIds: ["hannah"],
    tags: ["Culture", "Food", "Community"],
    createdAt: daysAgo(900),
    postsPerDay: 0.3,
  },
];

export const groupById = (id: string) => groups.find((g) => g.id === id);
export { daysAgo };

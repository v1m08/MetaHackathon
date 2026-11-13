// Seeded play history for Chat Games: 9 past days for the group chat c_volleyball, 6 for the DM c_maya_jordan.
// Literal data only; src/lib/play/seed.ts turns it into games, answers and events dated relative to now.
// Every game is written from what that chat's members can all see (the chat itself, their posts, their interests).
// `cites` are "author|start of the real line" (or an inventory / evidence id) and are resolved to real ids at seed
// time, so a line that no longer exists is dropped rather than invented. Nothing here is dated today.
//
// Tuned numbers (printed by chatScore with NO game today; they come from counts, so they hold at any hour, and
// dropping today's game does not move them: an unfinished day can lift participation but never lower it):
//   c_volleyball   score 58 = 40 x 0.625 participation (45 of 72 seats over 9 games: 6,5,6,6,2,5,5,5,5)
//                           + 20 x 4/7 streak (a day needs a majority, 5 of 8, finishing within 24h of the drop;
//                             the 2-player day 5 days ago breaks it)
//                           + 20 x 0.081 reciprocity (4 reactions) + 20 x 1.0 confidence
//                  top topic food 0.79 (confident: 7 played games touch it, 8/8 members finished one), then music
//                  0.23; sports is liked (mean 0.46) but split (agreement 0.42). "group" is earned and already
//                  unlocked below, so the next unlock is the Event at 60. Today's pick is a forced Wager on food.
//                  After today's game is finished by 5 of 8 with one reaction: 61 (streak 5). By 6 with two: 62.
//                  Four finishing is not enough (58): it takes a majority to make the day count.
//   c_maya_jordan  score 65 (participation 0.83, streak 2: nobody finished 3 days ago; reciprocity 0.30); top topic
//                  food 0.96. Nothing is seeded as unlocked there, so its first unlock (the Group) fires on the next
//                  finish; the Event follows on a later day (one card a day).
// Walkthrough: the members of c_volleyball are devon, tyler, marcus, nina, grace, ethan, sam and jordan (maya and
// nadia are NOT in it), so open /messages/c_volleyball?as=jordan and ?as=sam. Two windows alone can't cross 60:
// let `npm run qa:play` (or three more members) finish today's game; the Event card arrives on the fifth finish,
// and while today's game is a Wager it waits until half the chat has answered, so it follows the vote.
import type { ID } from "@/types";
import type { Choice, Format, Round, Unlock } from "@/lib/play/store";
import type { TopicId } from "@/lib/play/taxonomy";

export interface SeedPlay {
  /** Hours after the drop that this member finished. */
  h: number;
  /** One choice per round, in round order. Fewer than the rounds = opened and stopped (no completion). */
  a: Choice[];
  react?: string;
}
export interface SeedGame {
  id: string;
  conversationId: ID;
  /** Days before today (1 = yesterday). Never 0. */
  day: number;
  format: Format;
  topic: TopicId;
  title: string;
  premise: string;
  subjectId?: ID;
  rounds: (Omit<Round, "evidenceIds"> & { cites?: string[] })[];
  plays: Record<ID, SeedPlay>;
}
export type SeedUnlock = Omit<Unlock, "createdAt" | "messageId"> & { day: number };

const sp = (pick: string, predict = pick): Choice => ({ pick, predict });
const who = (...ids: ID[]) => ids.map((id) => ({ id, label: id[0].toUpperCase() + id.slice(1), userId: id }));
const VB = "c_volleyball";
const MJ = "c_maya_jordan";

export const seedGames: SeedGame[] = [
  // ---------------- Zilker Sunday 🏐 ----------------
  {
    id: "pg_seed_vb_1", conversationId: VB, day: 9, format: "wager", topic: "music",
    title: "Where does Zilker Sunday actually show up?",
    premise: "Three real things on the calendar. Spread 10 points on what this chat would really do.",
    rounds: [{
      id: "r1", kind: "points", prompt: "10 points. Where do we really end up?",
      options: [
        { id: "a", label: "Porch Lights + Sun June (+ SAMANTHA_VR after)", pitch: "Sam's on after", topic: "music", ref: { kind: "event", id: "e_porch_lights" } },
        { id: "b", label: "Fall Pickleball Round Robin", pitch: "Tyler has been campaigning", topic: "sports", ref: { kind: "event", id: "e_pickleball_tourney" } },
        { id: "c", label: "Dumpling Night: fold, eat, mahjong", topic: "food", ref: { kind: "event", id: "e_dumpling_night" } },
      ],
      cites: ["e_porch_lights", "e_pickleball_tourney", "e_dumpling_night", "sam|Hotel Vegas does $3 Lone Stars", "r_pickleball"],
    }],
    plays: {
      sam: { h: 0.4, a: [{ a: 7, b: 1, c: 2 }], react: "🔥" },
      tyler: { h: 0.7, a: [{ a: 2, b: 7, c: 1 }] },
      marcus: { h: 1.5, a: [{ a: 1, b: 7, c: 2 }] },
      devon: { h: 3, a: [{ a: 1, b: 6, c: 3 }] },
      grace: { h: 4.5, a: [{ a: 3, b: 4, c: 3 }] },
      jordan: { h: 6, a: [{ a: 4, b: 2, c: 4 }] },
    },
  },
  {
    id: "pg_seed_vb_2", conversationId: VB, day: 8, format: "split", topic: "sports",
    title: "Zilker rules committee",
    premise: "Three calls this chat argues about every Sunday. Pick your side, then guess where the chat lands.",
    rounds: [
      { id: "r1", kind: "split", prompt: "Rotation: whoever's waited longest, or winners stay on?", options: [{ id: "a", label: "Waited longest rotates in", topic: "sports" }, { id: "b", label: "Winners stay on", topic: "sports" }], cites: ["devon|Reminder that we rotate in"] },
      { id: "r2", kind: "split", prompt: "Wednesday: move to a 5pm sunset game, or keep 6pm and squint?", options: [{ id: "a", label: "5pm sunset game", topic: "sports" }, { id: "b", label: "6pm, courts by phone flashlight", topic: "sports" }], cites: ["nina|Can we do a sunset game"] },
      { id: "r3", kind: "split", prompt: "Sunday, last point played. One more set or straight to P. Terry's?", options: [{ id: "a", label: "One more set", topic: "sports" }, { id: "b", label: "P. Terry's, loser team buys", topic: "food" }], cites: ["ethan|Who's in for a 4v4"] },
    ],
    plays: {
      devon: { h: 0.3, a: [sp("a"), sp("a"), sp("a")] },
      tyler: { h: 0.5, a: [sp("b", "a"), sp("b", "a"), sp("a")] },
      marcus: { h: 1.2, a: [sp("a"), sp("a"), sp("a")] },
      ethan: { h: 2.5, a: [sp("a"), sp("a", "b"), sp("b", "a")] },
      grace: { h: 5, a: [sp("a"), sp("a"), sp("a", "b")] },
    },
  },
  {
    id: "pg_seed_vb_3", conversationId: VB, day: 7, format: "blend", topic: "food",
    title: "The post-game order",
    premise: "Sunday ends and everyone is starving. Each of you fills a slot.",
    rounds: [
      { id: "r1", kind: "pick", prompt: "Where are we eating?", options: [{ id: "a", label: "Jordan's birria, if he's cooking", topic: "food" }, { id: "b", label: "P. Terry's, loser team buys", topic: "food" }, { id: "c", label: "Kerbey Lane queso (Devon's #1)", topic: "food" }, { id: "d", label: "Nobody eats, one more set", topic: "sports" }], cites: ["jordan|ok y'all I've been quiet", "devon|3am-after-shift tier list", "ethan|Who's in for a 4v4"] },
      { id: "r2", kind: "pick", prompt: "Who's on drinks?", options: [{ id: "a", label: "Nina brings the good coffee", topic: "coffee" }, { id: "b", label: "Grace's homemade matcha (day 3)", topic: "coffee" }, { id: "c", label: "$3 Lone Stars at Hotel Vegas", topic: "nightlife" }], cites: ["r_matcha", "sam|Hotel Vegas does $3 Lone Stars"] },
      { id: "r3", kind: "pick", prompt: "And after?", options: [{ id: "a", label: "Tyler's lake", topic: "water" }, { id: "b", label: "Sam's set at Hotel Vegas", topic: "music" }, { id: "c", label: "Pickleball. Tyler insists", topic: "sports" }, { id: "d", label: "Nap. Devon has a shift" }], cites: ["int:tyler:2", "int:tyler:0", "int:sam:0"] },
    ],
    plays: {
      jordan: { h: 0.2, a: ["a", "c", "b"] },
      nina: { h: 0.8, a: ["a", "a", "d"], react: "🌮" },
      tyler: { h: 1, a: ["b", "c", "c"] },
      devon: { h: 2, a: ["c", "a", "d"] },
      sam: { h: 3.5, a: ["a", "c", "b"] },
      grace: { h: 6, a: ["a", "b", "c"] },
    },
  },
  {
    id: "pg_seed_vb_4", conversationId: VB, day: 6, format: "receipts", topic: "fitness",
    title: "Who said it: warmup edition",
    premise: "Real lines from this chat and your posts. Who said it?",
    rounds: [
      { id: "r1", kind: "pick", prompt: "Who said it?", quote: "I'll run a 5 min warmup. not a workout", options: who("marcus", "devon", "tyler", "ethan"), answer: "marcus", cites: ["marcus|I'll run a 5 min warmup"] },
      { id: "r2", kind: "pick", prompt: "Who said it?", quote: "it's always a workout with you", options: who("grace", "sam", "nina", "tyler"), answer: "sam", cites: ["sam|it's always a workout with you"] },
      { id: "r3", kind: "pick", prompt: "Who said it?", quote: "I'm bringing my whole pilates class", options: who("nina", "jordan", "grace", "sam"), answer: "grace", cites: ["grace|I'm bringing my whole pilates class"] },
      { id: "r4", kind: "pick", prompt: "Who said it?", quote: "Returned the Vaporflys because I'm not fast enough to justify $250 and my ego is fine.", options: who("marcus", "ethan", "devon", "grace"), answer: "ethan", cites: ["ethan|Shoe review since people asked"] },
    ],
    plays: {
      marcus: { h: 0.3, a: ["marcus", "sam", "grace", "ethan"] },
      sam: { h: 0.6, a: ["marcus", "sam", "grace", "marcus"] },
      grace: { h: 1.4, a: ["marcus", "tyler", "grace", "ethan"] },
      tyler: { h: 2.2, a: ["marcus", "sam", "nina", "devon"] },
      devon: { h: 4, a: ["marcus", "sam", "grace", "ethan"] },
      ethan: { h: 7, a: ["marcus", "grace", "grace", "ethan"] },
    },
  },
  {
    // The day the chat mostly missed: 2 of 8, so the streak restarts after it.
    id: "pg_seed_vb_5", conversationId: VB, day: 5, format: "hotseat", topic: "music", subjectId: "sam",
    title: "Hot Seat: Sam",
    premise: "How well does this chat know Sam? Sam answers too, and Sam's answer is the truth.",
    rounds: [
      { id: "r1", kind: "pick", prompt: "What is Sam wearing to every DJ set until further notice?", options: [{ id: "a", label: "A bowling shirt named Earl", topic: "thrift" }, { id: "b", label: "A Spurs jersey", topic: "sports" }, { id: "c", label: "All black, always" }], answer: "a", cites: ["sam|Picked up a vintage bowling shirt"] },
      { id: "r2", kind: "pick", prompt: "Where is Sam's first out-of-town set?", options: [{ id: "a", label: "San Antonio" }, { id: "b", label: "Houston" }, { id: "c", label: "Dallas" }], answer: "b", cites: ["sam|booked my first out-of-town set"] },
      { id: "r3", kind: "pick", prompt: "Sam's idea of a cheap Tuesday?", options: [{ id: "a", label: "Kerbey Lane queso", topic: "food" }, { id: "b", label: "Whataburger at 3am", topic: "food" }, { id: "c", label: "$3 Lone Stars and $2 truck tacos at Hotel Vegas", topic: "nightlife" }], answer: "c", cites: ["sam|Hotel Vegas does $3 Lone Stars"] },
    ],
    plays: {
      sam: { h: 0.5, a: ["a", "b", "c"] },
      jordan: { h: 3, a: ["a", "b", "c"] },
      tyler: { h: 5, a: ["a"] }, // opened, answered one, never finished
    },
  },
  {
    id: "pg_seed_vb_6", conversationId: VB, day: 4, format: "lineup", topic: "sports",
    title: "Zilker power rankings",
    premise: "Rank the chat. Compliments only.",
    rounds: [
      { id: "r1", kind: "rank", prompt: "Most likely to call their own line honestly", options: who("grace", "nina", "ethan", "devon", "tyler"), cites: ["devon|Reminder that we rotate in"] },
      { id: "r2", kind: "rank", prompt: "Gets the loudest cheer for a serve that clears the net", options: who("grace", "marcus", "sam", "jordan", "nina"), cites: ["grace|I served a ball over the net"] },
      { id: "r3", kind: "rank", prompt: "First one at the courts on Sunday at 10", options: who("devon", "marcus", "tyler", "ethan", "jordan"), cites: ["devon|Sunday 10am is ON"] },
    ],
    plays: {
      devon: { h: 0.4, a: [["grace", "nina", "ethan", "devon", "tyler"], ["grace", "nina", "jordan", "sam", "marcus"], ["devon", "marcus", "ethan", "jordan", "tyler"]] },
      tyler: { h: 0.9, a: [["tyler", "grace", "nina", "ethan", "devon"], ["grace", "sam", "nina", "jordan", "marcus"], ["marcus", "devon", "tyler", "ethan", "jordan"]] },
      marcus: { h: 1.6, a: [["nina", "grace", "ethan", "devon", "tyler"], ["grace", "nina", "sam", "jordan", "marcus"], ["marcus", "devon", "ethan", "tyler", "jordan"]] },
      grace: { h: 3, a: [["nina", "ethan", "grace", "devon", "tyler"], ["grace", "sam", "jordan", "nina", "marcus"], ["devon", "marcus", "ethan", "tyler", "jordan"]] },
      ethan: { h: 5.5, a: [["grace", "ethan", "nina", "devon", "tyler"], ["grace", "nina", "sam", "marcus", "jordan"], ["devon", "ethan", "marcus", "jordan", "tyler"]] },
    },
  },
  {
    id: "pg_seed_vb_7", conversationId: VB, day: 3, format: "split", topic: "food",
    title: "Taco court",
    premise: "Jordan's pop-up reopened some old arguments. Pick a side, then call the chat.",
    rounds: [
      { id: "r1", kind: "split", prompt: "Torchy's at $14 for two tacos: still allowed in this chat?", options: [{ id: "a", label: "Banned. Tyler's right", topic: "food" }, { id: "b", label: "It's still Torchy's", topic: "food" }], cites: ["tyler|Hot take: Torchy's"] },
      { id: "r2", kind: "split", prompt: "Saturday at the pop-up, with volleyball the next morning", options: [{ id: "a", label: "6 tacos minimum (Nina's law)", topic: "food" }, { id: "b", label: "Pace yourself, we play at 10", topic: "sports" }], cites: ["nina|6 tacos minimum", "jordan|coming but leaving at 12"] },
      { id: "r3", kind: "split", prompt: "3am after a shift", options: [{ id: "a", label: "Kerbey Lane queso", topic: "food" }, { id: "b", label: "Whataburger honey butter chicken biscuit", topic: "food" }], cites: ["devon|3am-after-shift tier list"] },
    ],
    plays: {
      jordan: { h: 0.2, a: [sp("a"), sp("a"), sp("b", "a")], react: "🫡" },
      nina: { h: 0.9, a: [sp("b", "a"), sp("a"), sp("b")] },
      tyler: { h: 1.1, a: [sp("a"), sp("b", "a"), sp("b", "a")] },
      devon: { h: 2.4, a: [sp("a"), sp("a"), sp("a")] },
      sam: { h: 6.5, a: [sp("b", "a"), sp("a"), sp("b")] },
    },
  },
  {
    id: "pg_seed_vb_8", conversationId: VB, day: 2, format: "blend", topic: "water",
    title: "Build the lake day",
    premise: "Tyler keeps asking. Each slot is yours to fill.",
    rounds: [
      { id: "r1", kind: "pick", prompt: "What are we doing out there?", options: [{ id: "a", label: "Sand volleyball by the water (ball stays dry this time)", topic: "sports" }, { id: "b", label: "Paddle boards", topic: "water" }, { id: "c", label: "Float and do nothing", topic: "water" }], cites: ["tyler|Wednesday 6pm recap", "int:tyler:2"] },
      { id: "r2", kind: "pick", prompt: "Who's feeding us?", options: [{ id: "a", label: "Tyler on the grill", topic: "food" }, { id: "b", label: "Jordan's leftover birria", topic: "food" }, { id: "c", label: "Gas station snacks" }], cites: ["int:tyler:4", "jordan|🫡 400 tacos"] },
      { id: "r3", kind: "pick", prompt: "Soundtrack", options: [{ id: "a", label: "Sam's house set, off a phone", topic: "music" }, { id: "b", label: "Tyler's country playlist", topic: "music" }, { id: "c", label: "No speaker, just the lake", topic: "water" }], cites: ["int:sam:1", "int:tyler:3"] },
    ],
    plays: {
      tyler: { h: 0.2, a: ["a", "a", "b"] },
      devon: { h: 0.8, a: ["a", "b", "a"] },
      marcus: { h: 1.3, a: ["a", "a", "a"] },
      grace: { h: 2.8, a: ["c", "b", "a"] },
      ethan: { h: 4.2, a: ["a", "b", "c"] },
    },
  },
  {
    id: "pg_seed_vb_9", conversationId: VB, day: 1, format: "receipts", topic: "food",
    title: "Who said it: taco edition",
    premise: "Real lines from this chat and your posts. Who said it?",
    rounds: [
      { id: "r1", kind: "pick", prompt: "Who said it?", quote: "6 tacos minimum", options: who("devon", "nina", "tyler", "grace"), answer: "nina", cites: ["nina|6 tacos minimum"] },
      { id: "r2", kind: "pick", prompt: "Who said it?", quote: "be ready for 11 tired nurses", options: who("nina", "jordan", "devon", "sam"), answer: "devon", cites: ["devon|entire er night shift is coming"] },
      { id: "r3", kind: "pick", prompt: "Who said it?", quote: "Not food exactly but it's calories.", options: who("tyler", "sam", "jordan", "marcus"), answer: "sam", cites: ["sam|Hotel Vegas does $3 Lone Stars"] },
      { id: "r4", kind: "pick", prompt: "Who said it?", quote: "I move it be banned from this group alongside franklin", options: who("jordan", "devon", "ethan", "tyler"), answer: "tyler", cites: ["tyler|Hot take: Torchy's"] },
    ],
    plays: {
      nina: { h: 0.3, a: ["nina", "devon", "sam", "tyler"] },
      jordan: { h: 0.5, a: ["nina", "devon", "sam", "tyler"] },
      sam: { h: 1.8, a: ["nina", "nina", "sam", "tyler"], react: "😂" },
      marcus: { h: 3.2, a: ["nina", "devon", "tyler", "tyler"] },
      ethan: { h: 6, a: ["grace", "devon", "sam", "tyler"] },
    },
  },

  // ---------------- Maya + Jordan (DM) ----------------
  {
    id: "pg_seed_mj_1", conversationId: MJ, day: 6, format: "split", topic: "food",
    title: "Pop-up math",
    premise: "Two people, one taco stand. Pick a side, then guess the other's.",
    rounds: [
      { id: "r1", kind: "split", prompt: "Make too many, or sell out early?", options: [{ id: "a", label: "Too many. Leftovers are a gift", topic: "food" }, { id: "b", label: "Sell out. Scarcity is marketing", topic: "food" }], cites: ["jordan|ok real talk. do I do 300 tacos or 400"] },
      { id: "r2", kind: "split", prompt: "Pineapple on a breakfast taco", options: [{ id: "a", label: "Yes, and everyone is wrong", topic: "food" }, { id: "b", label: "No", topic: "food" }], cites: ["maya|the vegan ones"] },
      { id: "r3", kind: "split", prompt: "Day off", options: [{ id: "a", label: "Cook for six for $22", topic: "food" }, { id: "b", label: "Get walked to a truck at 11pm", topic: "nightlife" }], cites: ["jordan|Cooked for 6 for $22", "jordan|dani walked me to a truck"] },
    ],
    plays: {
      maya: { h: 0.4, a: [sp("a"), sp("a", "b"), sp("b", "a")] },
      jordan: { h: 1.5, a: [sp("b", "a"), sp("b", "a"), sp("a")], react: "🌮" },
    },
  },
  {
    id: "pg_seed_mj_2", conversationId: MJ, day: 5, format: "blend", topic: "art",
    title: "Design the next pop-up",
    premise: "Jordan cooks, Maya letters. Fill the slots.",
    rounds: [
      { id: "r1", kind: "pick", prompt: "Headline item", options: [{ id: "a", label: "Birria first, it's the headline", topic: "food" }, { id: "b", label: "Al pastor, lemon not lime", topic: "food" }, { id: "c", label: "The vegan one with pineapple", topic: "food" }], cites: ["maya|ok it's good but make the prices bigger", "jordan|dani walked me to a truck", "maya|the vegan ones"] },
      { id: "r2", kind: "pick", prompt: "The menu board", options: [{ id: "a", label: "Maya letters it, prices bigger", topic: "art" }, { id: "b", label: "Jordan freehand in chalk", topic: "art" }, { id: "c", label: "Just print it" }], cites: ["jordan|menu board done", "int:maya:1"] },
      { id: "r3", kind: "pick", prompt: "Where next", options: [{ id: "a", label: "Hotel Vegas back patio again", topic: "nightlife" }, { id: "b", label: "The lawn at Barton Springs", topic: "water" }, { id: "c", label: "Finish line of the Tuesday run", topic: "running" }], cites: ["jordan|9? sam's opening the patio", "int:maya:5", "maya|Tuesday run tonight"] },
    ],
    plays: {
      maya: { h: 0.6, a: ["a", "a", "c"] },
      jordan: { h: 0.9, a: ["a", "a", "a"] },
    },
  },
  {
    id: "pg_seed_mj_3", conversationId: MJ, day: 4, format: "receipts", topic: "food",
    title: "Who said it: 400 tacos",
    premise: "Real lines from this chat. Yours or theirs?",
    rounds: [
      { id: "r1", kind: "pick", prompt: "Who said it?", quote: "you're so annoying (thank you)", options: who("maya", "jordan"), answer: "jordan", cites: ["jordan|you're so annoying"] },
      { id: "r2", kind: "pick", prompt: "Who said it?", quote: "your roommate is going to eat 6 tacos saturday and be fine", options: who("maya", "jordan"), answer: "maya", cites: ["maya|your roommate is going to eat 6 tacos"] },
      { id: "r3", kind: "pick", prompt: "Who said it?", quote: "if I have 100 left over you're eating them", options: who("maya", "jordan"), answer: "jordan", cites: ["jordan|ok 400. if I have 100 left over"] },
    ],
    plays: {
      maya: { h: 2, a: ["jordan", "maya", "jordan"], react: "🫶" },
      jordan: { h: 0.3, a: ["jordan", "maya", "jordan"] },
    },
  },
  {
    // Nobody finished this one: Jordan was two days out from the pop-up.
    id: "pg_seed_mj_4", conversationId: MJ, day: 3, format: "split", topic: "thrift",
    title: "Flip or keep",
    premise: "Marketplace instincts. Pick a side, then guess theirs.",
    rounds: [
      { id: "r1", kind: "split", prompt: "A $40 bike that needs a chain", options: [{ id: "a", label: "Fix it and flip it", topic: "thrift" }, { id: "b", label: "Fix it and ride it", topic: "cycling" }], cites: ["int:jordan:5", "int:jordan:4"] },
      { id: "r2", kind: "split", prompt: "Saturday morning", options: [{ id: "a", label: "Thrift racks before anyone else", topic: "thrift" }, { id: "b", label: "The 9-mile long run", topic: "running" }], cites: ["maya|Thrifted my entire", "maya|Saturday long run recap"] },
    ],
    plays: {
      jordan: { h: 9, a: [sp("a")] },
    },
  },
  {
    id: "pg_seed_mj_5", conversationId: MJ, day: 2, format: "split", topic: "outdoors",
    title: "Saturday, no pop-up",
    premise: "A free Saturday for once. Pick a side, then guess theirs.",
    rounds: [
      { id: "r1", kind: "split", prompt: "Morning", options: [{ id: "a", label: "Greenbelt, the water's back", topic: "outdoors" }, { id: "b", label: "Sleep. 14 lbs of birria took it out of me", topic: "food" }], cites: ["maya|water's back at the greenbelt", "jordan|14 lbs of birria braising"] },
      { id: "r2", kind: "split", prompt: "After", options: [{ id: "a", label: "Mozart's coffee", topic: "coffee" }, { id: "b", label: "$4 vegan tacos", topic: "food" }], cites: ["maya|Saturday long run recap", "maya|the vegan ones"] },
    ],
    plays: {
      maya: { h: 0.5, a: [sp("a", "b"), sp("b")] },
      jordan: { h: 4, a: [sp("a"), sp("b")] },
    },
  },
  {
    id: "pg_seed_mj_6", conversationId: MJ, day: 1, format: "blend", topic: "music",
    title: "Friday night, built by two",
    premise: "One slot each, then swap.",
    rounds: [
      { id: "r1", kind: "pick", prompt: "The show", options: [{ id: "a", label: "Porch Lights at Hotel Vegas", topic: "music" }, { id: "b", label: "Cumbia night", topic: "music" }, { id: "c", label: "Stay in, pottery videos", topic: "art" }], cites: ["int:jordan:3", "int:maya:1", "e_porch_lights"] },
      { id: "r2", kind: "pick", prompt: "Before", options: [{ id: "a", label: "Jordan cooks", topic: "food" }, { id: "b", label: "$2 truck tacos", topic: "food" }, { id: "c", label: "Matcha. It's 6pm, relax", topic: "coffee" }], cites: ["int:jordan:0", "int:maya:2"] },
      { id: "r3", kind: "pick", prompt: "After", options: [{ id: "a", label: "Stay for the late set", topic: "nightlife" }, { id: "b", label: "Home by 11" }, { id: "c", label: "Night swim at Barton Springs", topic: "water" }], cites: ["int:maya:5"] },
    ],
    plays: {
      maya: { h: 1.2, a: ["a", "a", "c"] },
      jordan: { h: 0.4, a: ["b", "a", "a"], react: "🔥" },
    },
  },
];

/** The Group the volleyball chat already unlocked at 40. Real public group; Marcus is the one member not in it yet. */
export const seedUnlocks: SeedUnlock[] = [
  {
    id: "pu_seed_vb_group", conversationId: VB, day: 3, tier: "group", refId: "g_cheapeats", topic: "food",
    title: "Cheap Eats ATX (under $15)", sub: "", // sub and image are filled from the real group at seed time
    why: "4 of 6 of you sent the chat to Jordan's birria in The post-game order, and 7 of you are already in this group.",
    facts: ["4 of 6 of you picked Jordan's birria in The post-game order", "7 of 8 of you are already in Cheap Eats ATX (under $15)"],
    score: 42, mode: "seed", costUsd: 0, responses: {}, // the chat score on the day it crossed 40
  },
];

// Seeds realistic Sidequest (Deep Cuts, Order Up!, Ghost Run, Sketch Off) rooms on disk + message cards in seeded threads so
// the pixel cards, leaderboards, Your Hangout critters, /dev/context, and Events/Groups/Marketplace rankings all work out-of-the-box
// with zero Model API calls, and update live whenever new games are played.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PRESET_MENUS } from "../../../sidequest/shared/kitchen";
import type { Pack } from "../../../sidequest/shared/rarity";
import { COURSE_LENGTH, PRESET_COURSES } from "../../../sidequest/shared/run";
import { PRESET_SKETCH, type Stroke } from "../../../sidequest/shared/sketch";
import { dayStartMs } from "./day";
import type { Database, ID, Message } from "@/types";

export const sqPid = (userId: string) => `fbu${userId.toLowerCase().replace(/[^a-z0-9]/g, "")}`.padEnd(6, "0").slice(0, 32);

const CACHE_ROOT = join(process.cwd(), "sidequest", ".cache");
const KITCHEN_DIR = join(CACHE_ROOT, "kitchen");
const RARITY_DIR = join(CACHE_ROOT, "rarity");
const PACKS_DIR = join(CACHE_ROOT, "packs");
const RUN_DIR = join(CACHE_ROOT, "run");
const SKETCH_DIR = join(CACHE_ROOT, "sketch");

const INDIE_PACK: Pack = {
  interest: "indie bands",
  scene: { kind: "tower", start: ["#8fc9f5", "#f3d6e9"], end: ["#24123d", "#5b2a7a"], ground: "#5a5f7a", props: ["🎤", "🎸", "💡", "⭐"] },
  avatar: "🎸",
  verb: "Play",
  title: "East Side Soundcheck",
  tagline: "Name the indie band. Deeper cuts climb higher.",
  host: { name: "Vega", emoji: "🎸", intro: "Doors are at 9. Name a band everyone knows and you stay in the alley — pull a deep cut and you headline." },
  meter: { label: "crowd", unit: " fans", perPoint: 4, up: true, icon: "🎸" },
  tiers: ["Headliner", "Festival Font", "Vinyl Shelf", "College Radio", "Back Patio", "7-Inch Only"],
  palette: { bg: "#141124", bg2: "#261c42", card: "#2f2352", primary: "#ffb020", accent: "#ff6b9d", text: "#ffffff" },
  font: "Space Grotesk",
  prompts: [
    { q: "Name a 2000s or 2010s indie rock band", answers: [{ a: "The Strokes", r: 1 }, { a: "Arctic Monkeys", r: 1 }, { a: "Vampire Weekend", r: 2 }, { a: "Phoenix", r: 3 }, { a: "Spoon", r: 4, note: "Austin's own" }, { a: "Pinback", r: 6 }] },
    { q: "Name an indie artist known for sad acoustic songs", answers: [{ a: "Phoebe Bridgers", r: 1 }, { a: "Elliott Smith", r: 2 }, { a: "Bon Iver", r: 2 }, { a: "Sufjan Stevens", r: 3 }, { a: "Adrianne Lenker", r: 4 }, { a: "Hovvdy", r: 6, note: "Formed in Austin" }] },
    { q: "Name a band with an animal in its name", answers: [{ a: "Arctic Monkeys", r: 1 }, { a: "Tame Impala", r: 1 }, { a: "Modest Mouse", r: 2 }, { a: "Grizzly Bear", r: 3 }, { a: "Fleet Foxes", r: 3 }, { a: "Car Seat Headrest", r: 4 }] },
    { q: "Name a band from Texas", answers: [{ a: "Khruangbin", r: 2 }, { a: "Spoon", r: 3 }, { a: "Explosions in the Sky", r: 3 }, { a: "Sun June", r: 5, note: "Austin indie pop" }, { a: "Black Pumas", r: 3 }] },
    { q: "Name a shoegaze or dream-pop band", answers: [{ a: "Beach House", r: 1 }, { a: "My Bloody Valentine", r: 2 }, { a: "Slowdive", r: 3 }, { a: "Cocteau Twins", r: 3 }, { a: "Alvvays", r: 4 }] },
    { q: "Name an instrument you see at an indie show besides guitar", answers: [{ a: "Drums", r: 1 }, { a: "Bass", r: 1 }, { a: "Synth", r: 2 }, { a: "Tambourine", r: 3 }, { a: "Pedal steel", r: 5 }, { a: "Omnichord", r: 6 }] },
    { q: "Name a famous music festival", answers: [{ a: "Coachella", r: 1 }, { a: "ACL", alias: ["Austin City Limits"], r: 2 }, { a: "SXSW", r: 2 }, { a: "Lollapalooza", r: 2 }, { a: "Pitchfork", r: 4 }, { a: "Levitation", r: 5, note: "Austin psych fest" }] },
  ],
};

function writeSeedRoom(path: string, data: unknown) {
  writeFileSync(path, JSON.stringify(data));
}

/** Ensures seeded Sidequest room files exist on disk and appends seeded game cards/logs to `d.conversations`. */
export function seedSidequestIntoDb(d: Database) {
  const now = Date.now();
  const DAY = 864e5;
  const startToday = dayStartMs(now);
  const dAgo = (days: number, minsOffset = 0) => new Date(now - days * DAY + minsOffset * 60e3).toISOString();
  const hAgo = (h: number) => new Date(now - h * 3600e3).toISOString();
  // Guaranteed to fall inside today's `America/Chicago` calendar day even right after local midnight.
  const todayIso = (minsAgo: number) => new Date(Math.min(now - 1000, Math.max(startToday + 1000, now - minsAgo * 60e3))).toISOString();

  try {
    mkdirSync(KITCHEN_DIR, { recursive: true });
    mkdirSync(RARITY_DIR, { recursive: true });
    mkdirSync(PACKS_DIR, { recursive: true });
    mkdirSync(RUN_DIR, { recursive: true });
    mkdirSync(SKETCH_DIR, { recursive: true });

    const tacos = PRESET_MENUS.find((m) => m.interest === "tacos")!;
    const burgers = PRESET_MENUS.find((m) => m.interest === "burgers")!;
    const ramen = PRESET_MENUS.find((m) => m.interest === "ramen")!;
    const f1Course = PRESET_COURSES.find((c) => c.interest === "f1")!;
    const moviesSketch = PRESET_SKETCH.find((p) => p.interest === "movies")!;
    const animalsSketch = PRESET_SKETCH.find((p) => p.interest === "animals")!;

    // Pixel popcorn bucket strokes on a 96x96 grid (red/white striped bucket + yellow fluffy kernels).
    const popcornStrokes: Stroke[] = [
      [3, 1, [30, 34, 36, 26, 44, 30, 48, 22, 54, 28, 62, 26, 66, 34, 58, 38, 38, 38, 30, 34]],
      [2, 0, [36, 30, 40, 32, 52, 26, 56, 30, 46, 34]],
      [1, 1, [30, 38, 66, 38, 60, 78, 36, 78, 30, 38]],
      [8, 1, [40, 42, 42, 74]],
      [8, 1, [54, 42, 52, 74]],
    ];
    // Pixel cat face strokes on a 96x96 grid.
    const catStrokes: Stroke[] = [
      [2, 1, [28, 42, 34, 22, 44, 36, 52, 36, 62, 22, 68, 42, 66, 66, 48, 74, 30, 66, 28, 42]],
      [0, 0, [40, 48, 40, 50]],
      [0, 0, [56, 48, 56, 50]],
      [1, 0, [46, 56, 50, 56, 48, 59, 46, 56]],
      [0, 0, [20, 54, 34, 55]],
      [0, 0, [62, 55, 76, 54]],
    ];
    // Smooth 22.85s ghost sample track ([pos, lane, pos, lane, ...]) for Ethan's F1 sprint.
    const ethanGhost: number[] = [];
    for (let step = 0; step <= 228; step++) {
      const pos = Math.min(COURSE_LENGTH, Math.round((step / 228) * COURSE_LENGTH));
      const lane = step < 60 ? 1 : step < 120 ? 0 : step < 175 ? 2 : 1;
      ethanGhost.push(pos, lane);
    }

    writeSeedRoom(join(SKETCH_DIR, "sqsfmv01.json"), {
      id: "sqsfmv01",
      pack: moviesSketch,
      seed: 90214,
      createdAt: todayIso(45),
      players: {
        [sqPid("sofia")]: { name: "Sofia", word: 0, joinedAt: todayIso(45), opened: {} },
      },
      drawings: [
        {
          id: "drwpop1",
          artist: sqPid("sofia"),
          word: 0, // "popcorn"
          strokes: popcornStrokes,
          at: todayIso(42),
          ai: { guess: "popcorn", correct: true },
          guesses: {},
        },
      ],
    });

    writeSeedRoom(join(SKETCH_DIR, "sqhnzoo1.json"), {
      id: "sqhnzoo1",
      pack: animalsSketch,
      seed: 61208,
      createdAt: todayIso(60),
      players: {
        [sqPid("maya")]: { name: "Maya", word: 0, joinedAt: todayIso(60), opened: {} },
      },
      drawings: [
        {
          id: "drwcat1",
          artist: sqPid("maya"),
          word: 0, // "cat"
          strokes: catStrokes,
          at: todayIso(58),
          ai: { guess: "cat", correct: true },
          guesses: {},
        },
      ],
    });

    writeSeedRoom(join(RUN_DIR, "sqetf101.json"), {
      id: "sqetf101",
      course: f1Course,
      seed: 73105,
      createdAt: todayIso(35),
      players: {
        [sqPid("ethan")]: { name: "Ethan", best: 22.85, plays: 2, ghost: ethanGhost },
      },
    });

    writeSeedRoom(join(KITCHEN_DIR, "sqmjrm05.json"), {
      id: "sqmjrm05",
      menu: ramen,
      seed: 31094,
      createdAt: dAgo(3),
      players: {
        [sqPid("maya")]: { name: "Maya", best: 192, plays: 2, served: 15, lost: 1, combo: 5 },
        [sqPid("jordan")]: { name: "Jordan", best: 205, plays: 2, served: 16, lost: 0, combo: 6 },
      },
    });

    writeSeedRoom(join(KITCHEN_DIR, "sqtaco01.json"), {
      id: "sqtaco01",
      menu: tacos,
      seed: 40219,
      createdAt: dAgo(2),
      players: {
        [sqPid("jordan")]: { name: "Jordan", best: 214, plays: 2, served: 16, lost: 1, combo: 6 },
        [sqPid("maya")]: { name: "Maya", best: 188, plays: 2, served: 14, lost: 1, combo: 5 },
      },
    });

    if (!existsSync(join(PACKS_DIR, "indie-bands.json"))) writeFileSync(join(PACKS_DIR, "indie-bands.json"), JSON.stringify(INDIE_PACK));
    writeSeedRoom(join(RARITY_DIR, "sqmusc04.json"), {
      id: "sqmusc04",
      interest: "indie bands",
      pack: INDIE_PACK,
      createdAt: dAgo(1),
      players: {
        [sqPid("maya")]: {
          name: "Maya",
          opened: { 0: now - DAY },
          tries: {},
          joinedAt: dAgo(1, 5),
          picks: {
            0: { raw: "Spoon", a: "Spoon", r: 4, at: dAgo(1, 5) },
            1: { raw: "Phoebe Bridgers", a: "Phoebe Bridgers", r: 1, at: dAgo(1, 5) },
            2: { raw: "Fleet Foxes", a: "Fleet Foxes", r: 3, at: dAgo(1, 5) },
            3: { raw: "Sun June", a: "Sun June", r: 5, at: dAgo(1, 5) },
            4: { raw: "Alvvays", a: "Alvvays", r: 4, at: dAgo(1, 5) },
            5: { raw: "Synth", a: "Synth", r: 2, at: dAgo(1, 5) },
            6: { raw: "ACL", a: "ACL", r: 2, at: dAgo(1, 5) },
          },
        },
        [sqPid("jordan")]: {
          name: "Jordan",
          opened: { 0: now - DAY + 600e3 },
          tries: {},
          joinedAt: dAgo(1, 15),
          picks: {
            0: { raw: "Spoon", a: "Spoon", r: 4, at: dAgo(1, 15) },
            1: { raw: "Elliott Smith", a: "Elliott Smith", r: 2, at: dAgo(1, 15) },
            2: { raw: "Tame Impala", a: "Tame Impala", r: 1, at: hAgo(13.5) },
            3: { raw: "Sun June", a: "Sun June", r: 5, at: dAgo(1, 15) },
            4: { raw: "Beach House", a: "Beach House", r: 1, at: dAgo(1, 15) },
            5: { raw: "Synth", a: "Synth", r: 2, at: dAgo(1, 15) },
            6: { raw: "SXSW", a: "SXSW", r: 2, at: dAgo(1, 15) },
          },
        },
      },
      judged: {},
    });

    writeSeedRoom(join(KITCHEN_DIR, "sqvbtac6.json"), {
      id: "sqvbtac6",
      menu: tacos,
      seed: 77123,
      createdAt: dAgo(2),
      players: {
        [sqPid("devon")]: { name: "Devon", best: 184, plays: 1, served: 14, lost: 1, combo: 4 },
        [sqPid("tyler")]: { name: "Tyler", best: 170, plays: 1, served: 13, lost: 1, combo: 4 },
        [sqPid("marcus")]: { name: "Marcus", best: 165, plays: 1, served: 12, lost: 2, combo: 3 },
        [sqPid("nina")]: { name: "Nina", best: 198, plays: 2, served: 15, lost: 0, combo: 5 },
        [sqPid("jordan")]: { name: "Jordan", best: 232, plays: 2, served: 18, lost: 0, combo: 7 },
      },
    });

    writeSeedRoom(join(KITCHEN_DIR, "sqburg03.json"), {
      id: "sqburg03",
      menu: burgers,
      seed: 88412,
      createdAt: dAgo(1),
      players: {
        [sqPid("devon")]: { name: "Devon", best: 196, plays: 1, served: 15, lost: 1, combo: 5 },
        [sqPid("sam")]: { name: "Sam", best: 204, plays: 2, served: 16, lost: 0, combo: 6 },
        [sqPid("tyler")]: { name: "Tyler", best: 162, plays: 1, served: 12, lost: 2, combo: 3 },
        [sqPid("grace")]: { name: "Grace", best: 175, plays: 1, served: 13, lost: 1, combo: 4 },
        [sqPid("jordan")]: { name: "Jordan", best: 228, plays: 1, served: 17, lost: 0, combo: 7 },
      },
    });

    writeSeedRoom(join(KITCHEN_DIR, "sqramn02.json"), {
      id: "sqramn02",
      menu: ramen,
      seed: 55102,
      createdAt: hAgo(16),
      players: {
        [sqPid("ethan")]: { name: "Ethan", best: 172, plays: 1, served: 13, lost: 1, combo: 4 },
        [sqPid("priya")]: { name: "Priya", best: 189, plays: 2, served: 14, lost: 1, combo: 5 },
      },
    });
  } catch {
    /* read-only fs fallback: message logs below still carry full context */
  }

  const inject = (convId: ID, msgs: { id: string; senderId: ID; at: string; text: string; attachment: Message["attachment"] }[]) => {
    const c = d.conversations.find((x) => x.id === convId);
    if (!c) return;
    for (const m of msgs) {
      if (c.messages.some((x) => x.id === m.id)) continue;
      c.messages.push({ id: m.id, senderId: m.senderId, text: m.text, createdAt: m.at, attachment: m.attachment, readBy: [...c.participantIds] });
    }
    c.messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  };

  inject("c_maya_jordan", [
    { id: "m_sq_mj_0a", senderId: "maya", at: dAgo(3, 0), text: "🎮 Order Up!: Ramen", attachment: { type: "sqgame", ref: "k:sqmjrm05" } },
    { id: "m_sq_mj_0b", senderId: "maya", at: dAgo(3, 4), text: "played Night Owl Noodles · $192", attachment: { type: "sqgamelog", ref: "k:sqmjrm05" } },
    { id: "m_sq_mj_0c", senderId: "jordan", at: dAgo(3, 9), text: "played Night Owl Noodles · $205 · took the lead", attachment: { type: "sqgamelog", ref: "k:sqmjrm05" } },
    { id: "m_sq_mj_1", senderId: "jordan", at: dAgo(2, 0), text: "🎮 Order Up!: Tacos", attachment: { type: "sqgame", ref: "k:sqtaco01" } },
    { id: "m_sq_mj_2", senderId: "jordan", at: dAgo(2, 4), text: "played Taco 'Bout It · $214", attachment: { type: "sqgamelog", ref: "k:sqtaco01" } },
    { id: "m_sq_mj_3", senderId: "maya", at: dAgo(2, 12), text: "played Taco 'Bout It · $188 · #2 of 2", attachment: { type: "sqgamelog", ref: "k:sqtaco01" } },
    { id: "m_sq_mj_4", senderId: "maya", at: dAgo(1, 0), text: "🎮 Deep Cuts: Indie bands", attachment: { type: "sqgame", ref: "sqmusc04" } },
    { id: "m_sq_mj_5", senderId: "maya", at: dAgo(1, 5), text: "played East Side Soundcheck · 1,020 fans", attachment: { type: "sqgamelog", ref: "sqmusc04" } },
    { id: "m_sq_mj_6", senderId: "jordan", at: dAgo(1, 15), text: "played East Side Soundcheck · 840 fans · #2 of 2", attachment: { type: "sqgamelog", ref: "sqmusc04" } },
  ]);

  inject("c_volleyball", [
    { id: "m_sq_vb_0a", senderId: "jordan", at: dAgo(2, 0), text: "🎮 Order Up!: Tacos", attachment: { type: "sqgame", ref: "k:sqvbtac6" } },
    { id: "m_sq_vb_0b", senderId: "jordan", at: dAgo(2, 3), text: "played Taco 'Bout It · $232", attachment: { type: "sqgamelog", ref: "k:sqvbtac6" } },
    { id: "m_sq_vb_0c", senderId: "nina", at: dAgo(2, 8), text: "played Taco 'Bout It · $198 · #2 of 2", attachment: { type: "sqgamelog", ref: "k:sqvbtac6" } },
    { id: "m_sq_vb_0d", senderId: "devon", at: dAgo(2, 14), text: "played Taco 'Bout It · $184 · #3 of 3", attachment: { type: "sqgamelog", ref: "k:sqvbtac6" } },
    { id: "m_sq_vb_0e", senderId: "tyler", at: dAgo(2, 20), text: "played Taco 'Bout It · $170 · #4 of 4", attachment: { type: "sqgamelog", ref: "k:sqvbtac6" } },
    { id: "m_sq_vb_0f", senderId: "marcus", at: dAgo(2, 25), text: "played Taco 'Bout It · $165 · #5 of 5", attachment: { type: "sqgamelog", ref: "k:sqvbtac6" } },
    { id: "m_sq_vb_1", senderId: "sam", at: dAgo(1, 0), text: "🎮 Order Up!: Burgers", attachment: { type: "sqgame", ref: "k:sqburg03" } },
    { id: "m_sq_vb_2", senderId: "sam", at: dAgo(1, 4), text: "played Bun Voyage · $204", attachment: { type: "sqgamelog", ref: "k:sqburg03" } },
    { id: "m_sq_vb_3", senderId: "devon", at: dAgo(1, 10), text: "played Bun Voyage · $196 · #2 of 2", attachment: { type: "sqgamelog", ref: "k:sqburg03" } },
    { id: "m_sq_vb_4", senderId: "jordan", at: dAgo(1, 18), text: "played Bun Voyage · $228 · took the lead", attachment: { type: "sqgamelog", ref: "k:sqburg03" } },
    { id: "m_sq_vb_5", senderId: "grace", at: dAgo(1, 24), text: "played Bun Voyage · $175 · #4 of 4", attachment: { type: "sqgamelog", ref: "k:sqburg03" } },
    { id: "m_sq_vb_6", senderId: "tyler", at: dAgo(1, 30), text: "played Bun Voyage · $162 · #5 of 5", attachment: { type: "sqgamelog", ref: "k:sqburg03" } },
  ]);

  inject("c_ethan_priya", [
    { id: "m_sq_ep_1", senderId: "priya", at: hAgo(16), text: "🎮 Order Up!: Ramen", attachment: { type: "sqgame", ref: "k:sqramn02" } },
    { id: "m_sq_ep_2", senderId: "priya", at: hAgo(15.9), text: "played Night Owl Noodles · $189", attachment: { type: "sqgamelog", ref: "k:sqramn02" } },
    { id: "m_sq_ep_3", senderId: "ethan", at: hAgo(15.6), text: "played Night Owl Noodles · $172 · #2 of 2", attachment: { type: "sqgamelog", ref: "k:sqramn02" } },
  ]);

  // ---------- Hangout 1:1 DM game histories across all 4 Sidequest games ----------
  // Past days use lightweight GamePigeon completion logs (`sqgamelog`) so threads stay crisp with zero 404 cards,
  // while today's active games (`s:sqsfmv01`, `r:sqetf101`, `s:sqhnzoo1`) have full `.cache` rooms on disk.
  // Sofia (`c_maya_sofia`): 7-day streak on Sketch Off + Sofia drew popcorn TODAY -> "yourTurn"
  const sofiaMsgs: { id: string; senderId: ID; at: string; text: string; attachment: Message["attachment"] }[] = [];
  for (let day = 7; day >= 1; day--) {
    const ref = `s:sqsfh0${day}`;
    sofiaMsgs.push(
      { id: `m_sq_sf_${day}b`, senderId: "sofia", at: dAgo(day, -25), text: "played Cosmic Doodles (Space) · 210 pts", attachment: { type: "sqgamelog", ref } },
      { id: `m_sq_sf_${day}c`, senderId: "maya", at: dAgo(day, -18), text: "played Cosmic Doodles (Space) · 230 pts", attachment: { type: "sqgamelog", ref } },
    );
  }
  sofiaMsgs.push(
    { id: "m_sq_sf_td1", senderId: "sofia", at: todayIso(45), text: "🎮 Sketch Off: Movies", attachment: { type: "sqgame", ref: "s:sqsfmv01" } },
    { id: "m_sq_sf_td2", senderId: "sofia", at: todayIso(42), text: "drew in Frame by Frame · AI guessed it!", attachment: { type: "sqgamelog", ref: "s:sqsfmv01" } },
  );
  inject("c_maya_sofia", sofiaMsgs);

  // Ethan (`c_maya_ethan`): 2-day streak on Ghost Run (F1) + Ethan raced TODAY -> "yourTurn"
  inject("c_maya_ethan", [
    { id: "m_sq_et_2b", senderId: "ethan", at: dAgo(2, -16), text: "played Lights Out Sprint (F1) · 23.40s", attachment: { type: "sqgamelog", ref: "r:sqeth02" } },
    { id: "m_sq_et_2c", senderId: "maya", at: dAgo(2, -10), text: "played Lights Out Sprint (F1) · 23.12s · took the lead", attachment: { type: "sqgamelog", ref: "r:sqeth02" } },
    { id: "m_sq_et_1b", senderId: "maya", at: dAgo(1, -16), text: "played Lights Out Sprint (F1) · 22.95s", attachment: { type: "sqgamelog", ref: "r:sqeth01" } },
    { id: "m_sq_et_1c", senderId: "ethan", at: dAgo(1, -11), text: "played Lights Out Sprint (F1) · 22.88s · took the lead", attachment: { type: "sqgamelog", ref: "r:sqeth01" } },
    { id: "m_sq_et_td1", senderId: "ethan", at: todayIso(35), text: "🎮 Ghost Run: F1", attachment: { type: "sqgame", ref: "r:sqetf101" } },
    { id: "m_sq_et_td2", senderId: "ethan", at: todayIso(33), text: "played Lights Out Sprint · 22.85s", attachment: { type: "sqgamelog", ref: "r:sqetf101" } },
  ]);

  // Aisha (`c_maya_aisha`): 7-day streak on Deep Cuts (Coffee), BOTH played today -> "done" (celebrating!)
  const aishaMsgs: { id: string; senderId: ID; at: string; text: string; attachment: Message["attachment"] }[] = [];
  for (let day = 6; day >= 1; day--) {
    const ref = `sqai0${day}`;
    aishaMsgs.push(
      { id: `m_sq_ai_${day}b`, senderId: "aisha", at: dAgo(day, -24), text: "played Coffee Culture · 680 pts", attachment: { type: "sqgamelog", ref } },
      { id: `m_sq_ai_${day}c`, senderId: "maya", at: dAgo(day, -18), text: "played Coffee Culture · 720 pts", attachment: { type: "sqgamelog", ref } },
    );
  }
  aishaMsgs.push(
    { id: "m_sq_ai_td2", senderId: "aisha", at: todayIso(52), text: "played Matcha Hour · 760 pts", attachment: { type: "sqgamelog", ref: "sqaitd01" } },
    { id: "m_sq_ai_td3", senderId: "maya", at: todayIso(48), text: "played Matcha Hour · 810 pts · took the lead", attachment: { type: "sqgamelog", ref: "sqaitd01" } },
  );
  inject("c_maya_aisha", aishaMsgs);

  // Hannah (`c_maya_hannah`): 3-day streak on Sketch Off (Animals) + Maya drew TODAY, waiting on Hannah -> "theirTurn"
  for (let day = 3; day >= 1; day--) {
    const ref = `s:sqhnh0${day}`;
    inject("c_maya_hannah", [
      { id: `m_sq_hn_${day}b`, senderId: "hannah", at: dAgo(day, -24), text: "played Zoo Doodles (Animals) · 190 pts", attachment: { type: "sqgamelog", ref } },
      { id: `m_sq_hn_${day}c`, senderId: "maya", at: dAgo(day, -16), text: "played Zoo Doodles (Animals) · 220 pts", attachment: { type: "sqgamelog", ref } },
    ]);
  }
  inject("c_maya_hannah", [
    { id: "m_sq_hn_td1", senderId: "maya", at: todayIso(60), text: "🎮 Sketch Off: Animals", attachment: { type: "sqgame", ref: "s:sqhnzoo1" } },
    { id: "m_sq_hn_td2", senderId: "maya", at: todayIso(58), text: "drew in Zoo Doodles · AI guessed it!", attachment: { type: "sqgamelog", ref: "s:sqhnzoo1" } },
  ]);

  // Grace (`c_maya_grace`): played together 4 days ago, missed since -> "lost" (napping in hammock!)
  inject("c_maya_grace", [
    { id: "m_sq_gr_4b", senderId: "grace", at: dAgo(4, -25), text: "played Pilates Studio · 540 pts", attachment: { type: "sqgamelog", ref: "sqgrpl04" } },
    { id: "m_sq_gr_4c", senderId: "maya", at: dAgo(4, -20), text: "played Pilates Studio · 580 pts", attachment: { type: "sqgamelog", ref: "sqgrpl04" } },
  ]);

  // Judges' chat (`c_judges`, the /demo thread): six straight days of food games, everyone playing and trash-talking after,
  // so the Connection Score sits above the Marketplace tier (75) before the judges play today's game.
  // Past days are completion logs only; today's game is dropped live from /admin (src/lib/demo/drop.ts).
  const JUDGE_DAYS: { title: string; scores: Record<ID, number>; banter: [ID, string][] }[] = [
    { title: "Taco 'Bout It (Tacos)", scores: { jordan: 241, tyler: 198, nina: 205, devon: 170, grace: 188 }, banter: [["devon", "rigged"], ["jordan", "the birria order is a trap every time"], ["nina", "rematch"]] },
    { title: "Bun Voyage (Burgers)", scores: { tyler: 236, jordan: 229, devon: 201, grace: 176, nina: 190 }, banter: [["tyler", "grill guy wins the grill game, shocking"], ["grace", "I put pickles on everything and it worked"], ["devon", "again tonight?"]] },
    { title: "Night Owl Noodles (Ramen)", scores: { grace: 214, nina: 222, jordan: 219, devon: 187, tyler: 166 }, banter: [["nina", "nurses run on ramen, this was home turf"], ["tyler", "who puts corn in ramen"], ["grace", "everyone in Sapporo"]] },
    { title: "Smoke Signals (BBQ)", scores: { tyler: 251, devon: 210, jordan: 238, nina: 181, grace: 169 }, banter: [["jordan", "brisket queue was brutal"], ["devon", "I'm bringing ribs sunday to settle this"], ["grace", "I'll judge"]] },
    { title: "Rise & Shine (Brunch)", scores: { grace: 247, nina: 219, jordan: 205, tyler: 172, devon: 195 }, banter: [["grace", "brunch is my sport"], ["tyler", "this one was rigged for grace"], ["nina", "mimosa bar sunday??"]] },
    { title: "Sweet Tooth (Baking)", scores: { nina: 258, grace: 221, devon: 190, jordan: 202, tyler: 177 }, banter: [["nina", "tres leches confirmed for sunday"], ["devon", "can we do a bake-off"], ["jordan", "devon can't bake"]] },
  ];
  JUDGE_DAYS.forEach((g, i) => {
    const day = JUDGE_DAYS.length - i; // oldest first: 6 days ago … yesterday
    const ref = `k:sqjd0${day}`;
    const msgs: { id: string; senderId: ID; at: string; text: string; attachment: Message["attachment"] }[] = [];
    const order = Object.entries(g.scores);
    order.forEach(([uid, tips], k) => {
      const lead = order.slice(0, k).every(([, t]) => t < tips) && k > 0;
      msgs.push({ id: `m_sq_jd_${day}_${uid}`, senderId: uid, at: dAgo(day, -90 + k * 8), text: `played ${g.title} · $${tips}${lead ? " · took the lead" : ""}`, attachment: { type: "sqgamelog", ref } });
    });
    g.banter.forEach(([uid, text], k) => {
      const at = order.findIndex(([id]) => id === uid);
      msgs.push({ id: `m_sq_jd_${day}_b${k}`, senderId: uid, at: dAgo(day, -90 + at * 8 + 4), text, attachment: undefined });
    });
    inject("c_judges", msgs);
  });
}

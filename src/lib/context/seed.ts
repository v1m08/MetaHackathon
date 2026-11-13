// Seeds realistic Sidequest (Deep Cuts + Order Up!) rooms on disk + message cards in seeded threads so
// the pixel cards, leaderboards, /dev/context, and Events/Groups/Marketplace rankings all work out-of-the-box
// with zero Model API calls, and update live whenever new games are played.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PRESET_MENUS } from "../../../sidequest/shared/kitchen";
import type { Pack } from "../../../sidequest/shared/rarity";
import type { Database, ID, Message } from "@/types";

export const sqPid = (userId: string) => `fbu${userId.toLowerCase().replace(/[^a-z0-9]/g, "")}`.padEnd(6, "0").slice(0, 32);

const CACHE_ROOT = join(process.cwd(), "sidequest", ".cache");
const KITCHEN_DIR = join(CACHE_ROOT, "kitchen");
const RARITY_DIR = join(CACHE_ROOT, "rarity");
const PACKS_DIR = join(CACHE_ROOT, "packs");

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
  const dAgo = (days: number, minsOffset = 0) => new Date(now - days * DAY + minsOffset * 60e3).toISOString();
  const hAgo = (h: number) => new Date(now - h * 3600e3).toISOString();

  try {
    mkdirSync(KITCHEN_DIR, { recursive: true });
    mkdirSync(RARITY_DIR, { recursive: true });
    mkdirSync(PACKS_DIR, { recursive: true });

    const tacos = PRESET_MENUS.find((m) => m.interest === "tacos")!;
    const burgers = PRESET_MENUS.find((m) => m.interest === "burgers")!;
    const ramen = PRESET_MENUS.find((m) => m.interest === "ramen")!;

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
}

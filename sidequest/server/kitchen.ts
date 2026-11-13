// "Order Up!" server: menu generation per topic (one model call, cached), presets, rooms and leaderboards.
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PRESET_MENUS, sanitizeMenu, type Menu } from "../shared/kitchen";
import { cleanText, normalizeInterest } from "../shared/schema";
import { chatJSON, extractJson } from "./llm";

const ROOT = join(__dirname, "..", ".cache");
const MENUS = join(ROOT, "menus");
const ROOMS = join(ROOT, "kitchen");
const key = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "x";

const MENU_SYSTEM = `You design the restaurant for a fast cooking game played by friends in a group chat. Players run the kitchen for 75 seconds: customers order dishes, the player taps ingredients onto a plate and serves them. Some ingredients must be grilled first.

Given a topic, create a restaurant that feels made for fans of it. If the topic is a food, make that kind of restaurant. If it isn't (a sport, a band, a hobby), make a themed restaurant for that world (e.g. rock climbing → a crag-side café with dishes named after climbing terms) but with REAL food.

Rules:
- ingredients: 6-8 real food items, each a single common food emoji that clearly shows it, a short name, and "cook": true for 1-2 that need grilling/boiling (meat, noodles, eggs, tortillas, dumplings...). Use emoji that render everywhere (no flags, no newest emoji). Every ingredient's emoji must be different.
- dishes: 5-6 dishes. Each uses 2-4 ingredient ids (no repeats within a dish), has a fun themed name (<= 22 chars) and a price 6-20 (more items = higher price). At least 2 dishes use a cook ingredient. Make 2 dishes simple (2 items).
- name: original restaurant name (<= 24 chars), no real brands or people. tagline <= 60 chars.
- chef: a character with a name, one emoji, and a one-line pep talk in their voice (<= 90 chars).
- theme: hex colors: wall, wall2 (a gradient for the back wall), counter (wood/stone/steel), primary (buttons), accent (highlights). Make text readable: walls light or dark consistently.
- customers: 6-8 emoji people or characters that would eat here.

Reply with only JSON:
{"name","tagline","chef":{"name","emoji","line"},"theme":{"wall","wall2","counter","primary","accent"},"ingredients":[{"id","emoji","name","cook"}],"dishes":[{"name","items":[ids],"price"}],"customers":[emoji]}`;

export function presetFor(interest: string): Menu | null {
  const k = key(interest);
  return PRESET_MENUS.find((m) => key(m.interest) === k || k.includes(key(m.interest).replace(/s$/, ""))) ?? null;
}
export function cachedMenu(interest: string): Menu | null {
  const preset = presetFor(interest);
  if (preset) return { ...preset, interest };
  const f = join(MENUS, `${key(interest)}.json`);
  return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as Menu) : null;
}
export function readyKitchenTopics() {
  const out = PRESET_MENUS.map((m) => ({ interest: m.interest, title: m.name, emoji: m.chef.emoji }));
  if (existsSync(MENUS))
    for (const f of readdirSync(MENUS).filter((x) => x.endsWith(".json"))) {
      try {
        const m = JSON.parse(readFileSync(join(MENUS, f), "utf8")) as Menu;
        out.push({ interest: m.interest, title: m.name, emoji: m.chef.emoji });
      } catch {
        /* skip */
      }
    }
  return out;
}

export async function generateMenu(rawInterest: string): Promise<Menu> {
  const interest = normalizeInterest(rawInterest) || "comfort food";
  const cached = cachedMenu(interest);
  if (cached) return cached;
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await chatJSON(
      [
        { role: "system", content: MENU_SYSTEM },
        { role: "user", content: `Topic: ${JSON.stringify(interest)}` },
      ],
      { maxTokens: 5000, timeoutMs: 60000, reasoning: "low", temperature: 0.9, task: "kitchen.menu" },
    );
    const menu = sanitizeMenu(extractJson(r.text), interest);
    if (menu) {
      mkdirSync(MENUS, { recursive: true });
      writeFileSync(join(MENUS, `${key(interest)}.json`), JSON.stringify(menu));
      return menu;
    }
  }
  throw new Error("couldn't design a menu for that topic");
}

// ---------- rooms ----------
interface KPlayer {
  name: string;
  best: number;
  plays: number;
  served: number;
  lost: number;
  combo: number;
}
export interface KRoom {
  id: string;
  menu: Menu;
  seed: number;
  createdAt: string;
  players: Record<string, KPlayer>;
}
const rooms = new Map<string, KRoom>();
const file = (id: string) => join(ROOMS, `${id}.json`);
function save(r: KRoom) {
  mkdirSync(ROOMS, { recursive: true });
  writeFileSync(file(r.id) + ".tmp", JSON.stringify(r));
  renameSync(file(r.id) + ".tmp", file(r.id));
}
export function getKRoom(id: string): KRoom | null {
  if (!/^[a-z0-9]{4,12}$/.test(id)) return null;
  if (rooms.has(id)) return rooms.get(id)!;
  if (!existsSync(file(id))) return null;
  const r = JSON.parse(readFileSync(file(id), "utf8")) as KRoom;
  rooms.set(id, r);
  return r;
}
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export function createKRoom(menu: Menu): KRoom {
  let id = "";
  do id = Array.from(randomBytes(6), (b) => ALPHABET[b % ALPHABET.length]).join("");
  while (getKRoom(id));
  const r: KRoom = { id, menu, seed: randomBytes(4).readUInt32LE(0), createdAt: new Date().toISOString(), players: {} };
  rooms.set(id, r);
  save(r);
  return r;
}
const validPid = (p: unknown): p is string => typeof p === "string" && /^[a-z0-9]{6,32}$/i.test(p);

export function kRoomView(r: KRoom, me: unknown) {
  const pid = validPid(me) ? me : "";
  const board = Object.entries(r.players)
    .map(([id, p]) => ({ name: p.name, score: p.best, served: p.served, me: id === pid }))
    .sort((a, b) => b.score - a.score);
  const mine = pid ? r.players[pid] : undefined;
  return { id: r.id, menu: r.menu, seed: r.seed, board, me: mine ? { name: mine.name, best: mine.best, plays: mine.plays } : null };
}

export function submitKScore(r: KRoom, body: Record<string, unknown>) {
  if (!validPid(body.pid)) return null;
  const score = Math.max(0, Math.min(5000, Math.round(Number(body.score) || 0)));
  const p = (r.players[body.pid] ??= { name: "Player", best: 0, plays: 0, served: 0, lost: 0, combo: 0 });
  p.name = cleanText(body.name, 16) || p.name;
  p.plays++;
  if (score >= p.best) {
    p.best = score;
    p.served = Math.max(0, Math.round(Number(body.served) || 0));
    p.lost = Math.max(0, Math.round(Number(body.lost) || 0));
    p.combo = Math.max(0, Math.round(Number(body.combo) || 0));
  }
  save(r);
  return kRoomView(r, body.pid);
}

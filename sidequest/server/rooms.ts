// Rooms: one generated game shared by a group. Everyone in a room plays the same config with the same
// seed (same course), and the room keeps a leaderboard of each player's best score.
// Stored in memory and persisted to sidequest/.cache/rooms.json, so links survive a restart.
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanText, sanitizeConfig, type GameConfig } from "../shared/schema";
import type { Puzzle } from "../shared/wordhunt";
import { generatePuzzle } from "./wordhunt";

export interface ScoreRow {
  playerId: string;
  name: string;
  score: number;
  plays: number;
  at: string;
}
export interface Room {
  id: string;
  config: GameConfig;
  seed: number;
  createdAt: string;
  scores: ScoreRow[];
  /** Word hunt: one board for everyone in the room. */
  puzzle?: Puzzle;
}

const DIR = join(__dirname, "..", ".cache");
const FILE = join(DIR, "rooms.json");
const MAX_ROOMS = 2000;
const MAX_PLAYERS = 200;
const rooms = new Map<string, Room>();

try {
  if (existsSync(FILE)) for (const r of JSON.parse(readFileSync(FILE, "utf8")) as Room[]) rooms.set(r.id, { ...r, config: sanitizeConfig(r.config) });
} catch {
  /* corrupt file: start empty */
}

let saveTimer: NodeJS.Timeout | null = null;
function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      mkdirSync(DIR, { recursive: true });
      const tmp = FILE + ".tmp";
      writeFileSync(tmp, JSON.stringify([...rooms.values()]));
      renameSync(tmp, FILE);
    } catch {
      /* read-only fs: memory only */
    }
  }, 200);
}

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no look-alikes
function newId() {
  const b = randomBytes(6);
  return Array.from(b, (x) => ALPHABET[x % ALPHABET.length]).join("");
}

export function createRoom(config: unknown): Room {
  const room: Room = { id: newId(), config: sanitizeConfig(config), seed: randomBytes(4).readUInt32LE(0), createdAt: new Date().toISOString(), scores: [] };
  while (rooms.has(room.id)) room.id = newId();
  if (room.config.wordhunt) room.puzzle = generatePuzzle(room.config.wordhunt.themed, room.seed);
  rooms.set(room.id, room);
  if (rooms.size > MAX_ROOMS) rooms.delete(rooms.keys().next().value!);
  save();
  return room;
}

export const getRoom = (id: string) => rooms.get(id) ?? null;

export const sortedScores = (r: Room) => [...r.scores].sort((a, b) => b.score - a.score || a.at.localeCompare(b.at));

/** Record a play. Keeps each player's best; returns the leaderboard. */
export function submitScore(id: string, body: { playerId?: unknown; name?: unknown; score?: unknown }): ScoreRow[] | null {
  const room = rooms.get(id);
  if (!room) return null;
  const playerId = typeof body.playerId === "string" && /^[a-z0-9]{6,32}$/i.test(body.playerId) ? body.playerId : null;
  const score = Math.max(0, Math.min(1e7, Math.round(Number(body.score) || 0)));
  if (!playerId) return sortedScores(room);
  const name = cleanText(body.name, 16) || "Player";
  const now = new Date().toISOString();
  const row = room.scores.find((s) => s.playerId === playerId);
  if (row) {
    row.name = name;
    row.plays++;
    if (score > row.score) {
      row.score = score;
      row.at = now;
    }
  } else if (room.scores.length < MAX_PLAYERS) room.scores.push({ playerId, name, score, plays: 1, at: now });
  save();
  return sortedScores(room);
}

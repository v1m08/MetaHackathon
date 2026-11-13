// Sketch Off server: word packs (one model call, cached; presets instant), rooms, drawings, the AI guesser,
// and guess checking. Words never reach a guesser's phone; only the artist sees their own word.
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { matchAnswer } from "../shared/rarity";
import { ARTIST_AI_BONUS, ARTIST_PER_GUESS, GUESS_SECONDS, guessPoints, PRESET_SKETCH, sanitizeSketch, wordOrder, type SketchPack, type Stroke } from "../shared/sketch";
import { cleanText, normalizeInterest } from "../shared/text";
import { env } from "./env";
import { chatJSON, extractJson } from "./llm";

const ROOT = join(__dirname, "..", ".cache");
const PACKS = join(ROOT, "sketchpacks");
const ROOMS = join(ROOT, "sketch");
const key = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "x";

const SYSTEM = `You pick the words for a drawing game played by friends in a group chat: each player draws a word in 30 seconds on a tiny pixel canvas, and friends guess it.

Given a topic, choose 16 words fans of the topic would love to draw and guess:
- Concrete, DRAWABLE things: objects, animals, characters-as-types, places, gear, iconic items. No abstract ideas, no real people's names, no brand names, no letters/numbers.
- 1-2 words each, lowercase. Specific to the topic, but recognisable from a quick sketch.
- tier: 1 = easy to draw (5 words), 2 = medium (6), 3 = hard but fun (5).
- alias: other names a guesser might type (can be empty).
Also: title (<= 24 chars, original, playful), tagline (<= 60 chars), host {name (<= 16 chars), emoji, line (<= 90 chars, a funny art-critic voice)}, palette {wall, wall2 (gradient of the studio wall), primary (buttons), accent} as hex.
Reply with only JSON: {"title","tagline","host":{"name","emoji","line"},"palette":{"wall","wall2","primary","accent"},"words":[{"w","tier","alias":[]}]}`;

export function presetSketch(interest: string): SketchPack | null {
  const k = key(interest);
  return PRESET_SKETCH.find((p) => key(p.interest) === k || k.includes(key(p.interest).replace(/s$/, ""))) ?? null;
}
export function cachedSketch(interest: string): SketchPack | null {
  const p = presetSketch(interest);
  if (p) return { ...p, interest };
  const f = join(PACKS, `${key(interest)}.json`);
  return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as SketchPack) : null;
}
export function readySketchTopics() {
  const out = PRESET_SKETCH.map((p) => ({ interest: p.interest, title: p.title }));
  if (existsSync(PACKS))
    for (const f of readdirSync(PACKS).filter((x) => x.endsWith(".json"))) {
      try {
        const p = JSON.parse(readFileSync(join(PACKS, f), "utf8")) as SketchPack;
        out.push({ interest: p.interest, title: p.title });
      } catch {
        /* skip */
      }
    }
  return out;
}
export async function generateSketch(raw: string): Promise<SketchPack> {
  const interest = normalizeInterest(raw) || "anything";
  const cached = cachedSketch(interest);
  if (cached) return cached;
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await chatJSON(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Topic: ${JSON.stringify(interest)}` },
      ],
      { maxTokens: 3500, timeoutMs: 60000, reasoning: "low", temperature: 0.8, task: "sketch.words" },
    );
    const pack = sanitizeSketch(extractJson(r.text), interest);
    if (pack) {
      mkdirSync(PACKS, { recursive: true });
      writeFileSync(join(PACKS, `${key(interest)}.json`), JSON.stringify(pack));
      return pack;
    }
  }
  throw new Error("couldn't pick drawable words for that topic");
}

// ---------- rooms ----------
interface Drawing {
  id: string;
  artist: string; // pid
  word: number; // index into pack.words
  strokes: Stroke[];
  at: string;
  ai: { guess: string; correct: boolean } | null;
  guesses: Record<string, { correct: boolean; points: number; secondsLeft: number }>;
}
interface Artist {
  name: string;
  word: number; // assigned word index
  joinedAt: string;
  opened: Record<string, number>; // drawing id → epoch ms when guessing started
}
export interface SRoom {
  id: string;
  pack: SketchPack;
  seed: number;
  createdAt: string;
  players: Record<string, Artist>;
  drawings: Drawing[];
}
const rooms = new Map<string, SRoom>();
const file = (id: string) => join(ROOMS, `${id}.json`);
function save(r: SRoom) {
  mkdirSync(ROOMS, { recursive: true });
  writeFileSync(file(r.id) + ".tmp", JSON.stringify(r));
  renameSync(file(r.id) + ".tmp", file(r.id));
}
export function getSRoom(id: string): SRoom | null {
  if (!/^[a-z0-9]{4,12}$/.test(id)) return null;
  if (rooms.has(id)) return rooms.get(id)!;
  if (!existsSync(file(id))) return null;
  const r = JSON.parse(readFileSync(file(id), "utf8")) as SRoom;
  rooms.set(id, r);
  return r;
}
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export function createSRoom(pack: SketchPack): SRoom {
  let id = "";
  do id = Array.from(randomBytes(6), (b) => ALPHABET[b % ALPHABET.length]).join("");
  while (getSRoom(id));
  const r: SRoom = { id, pack, seed: randomBytes(4).readUInt32LE(0), createdAt: new Date().toISOString(), players: {}, drawings: [] };
  rooms.set(id, r);
  save(r);
  return r;
}
const validPid = (p: unknown): p is string => typeof p === "string" && /^[a-z0-9]{6,32}$/i.test(p);
function player(r: SRoom, pid: string, name: unknown): Artist {
  let p = r.players[pid];
  if (!p) {
    const order = wordOrder(r.pack, r.seed);
    p = r.players[pid] = { name: "Player", word: order[Object.keys(r.players).length % order.length], joinedAt: new Date().toISOString(), opened: {} };
  }
  const n = cleanText(name, 16);
  if (n) p.name = n;
  return p;
}

export function scoreOf(r: SRoom, pid: string) {
  let s = 0;
  for (const d of r.drawings) {
    if (d.guesses[pid]) s += d.guesses[pid].points;
    if (d.artist === pid) {
      s += Object.values(d.guesses).filter((g) => g.correct).length * ARTIST_PER_GUESS;
      if (d.ai?.correct) s += ARTIST_AI_BONUS;
    }
  }
  return s;
}

/** What a viewer may see: own word only; others' drawings without their word until guessed. */
export function sRoomView(r: SRoom, me: unknown) {
  const pid = validPid(me) ? me : "";
  const mine = pid ? r.players[pid] : undefined;
  const myDrawing = r.drawings.find((d) => d.artist === pid);
  const board = Object.entries(r.players)
    .filter(([id]) => r.drawings.some((d) => d.artist === id || d.guesses[id]))
    .map(([id, p]) => ({ name: p.name, score: scoreOf(r, id), me: id === pid }))
    .sort((a, b) => b.score - a.score);
  const drawings = r.drawings.map((d) => {
    const own = d.artist === pid;
    const g = d.guesses[pid];
    const reveal = own || !!g;
    const word = r.pack.words[d.word].w;
    return {
      id: d.id,
      artist: r.players[d.artist]?.name ?? "Someone",
      own,
      strokes: d.strokes,
      length: word.length,
      word: reveal ? word : undefined,
      ai: reveal ? d.ai : undefined,
      guessed: g ? { correct: g.correct, points: g.points } : undefined,
      correctGuesses: Object.values(d.guesses).filter((x) => x.correct).length,
    };
  });
  return {
    id: r.id,
    pack: { ...r.pack, words: undefined },
    me: mine ? { name: mine.name, word: myDrawing ? r.pack.words[myDrawing.word].w : undefined, drew: !!myDrawing, score: scoreOf(r, pid) } : null,
    board,
    drawings,
  };
}

/** Start your turn: returns your word (and remembers you). */
export function myTurn(r: SRoom, pid: unknown, name: unknown) {
  if (!validPid(pid)) return null;
  const p = player(r, pid, name);
  save(r);
  const w = r.pack.words[p.word];
  return { word: w.w, tier: w.tier };
}

async function aiGuess(r: SRoom, png: string): Promise<string> {
  const res = await chatJSON(
    [
      { role: "system", content: `You are playing a drawing guessing game about "${r.pack.interest}". Look at the quick pixel doodle and guess what single thing it shows (1-3 words). Reply with only JSON: {"guess": "..."}` },
      { role: "user", content: [{ type: "text", text: "What is this drawing?" }, { type: "image_url", image_url: { url: png } }] },
    ],
    { maxTokens: 2500, timeoutMs: 30000, reasoning: "low", temperature: 0.2, model: process.env.SIDEQUEST_VISION_MODEL || process.env.MODEL_VISION || env.model, task: "sketch.ai-guess" },
  );
  const j = extractJson(res.text) as { guess?: unknown };
  return cleanText(j.guess, 30).toLowerCase() || "no idea";
}
const isRight = (r: SRoom, wordIdx: number, guess: string) => {
  const w = r.pack.words[wordIdx];
  return !!matchAnswer(guess, [{ a: w.w, alias: w.alias, r: 1 }]);
};

export async function submitDrawing(r: SRoom, body: Record<string, unknown>) {
  if (!validPid(body.pid)) return { error: "bad player" };
  const p = player(r, body.pid, body.name);
  if (r.drawings.some((d) => d.artist === body.pid)) return { error: "already drew" };
  const strokes: Stroke[] = (Array.isArray(body.strokes) ? body.strokes : []).slice(0, 400).map((s) => {
    const a = Array.isArray(s) ? s : [];
    const pts = (Array.isArray(a[2]) ? a[2] : []).slice(0, 4000).map((n: unknown) => Math.max(0, Math.min(95, Math.round(Number(n) || 0))));
    return [Math.max(0, Math.min(8, Number(a[0]) || 0)), Math.max(0, Math.min(1, Number(a[1]) || 0)), pts] as Stroke;
  });
  const d: Drawing = { id: Array.from(randomBytes(5), (b) => ALPHABET[b % ALPHABET.length]).join(""), artist: body.pid, word: p.word, strokes, at: new Date().toISOString(), ai: null, guesses: {} };
  r.drawings.push(d);
  save(r);
  const png = typeof body.png === "string" && body.png.startsWith("data:image/png;base64,") && body.png.length < 400_000 ? body.png : "";
  if (png && strokes.length) {
    try {
      const guess = await aiGuess(r, png);
      d.ai = { guess, correct: isRight(r, d.word, guess) };
    } catch (e) {
      console.error("[sketch] ai guess failed:", String(e).slice(0, 300));
      d.ai = null;
    }
    save(r);
  }
  return { ok: true, word: r.pack.words[d.word].w, ai: d.ai };
}

export function openGuess(r: SRoom, pid: unknown, name: unknown, drawingId: unknown) {
  if (!validPid(pid)) return { error: "bad player" };
  const p = player(r, pid, name);
  const id = String(drawingId);
  if (!p.opened[id]) p.opened[id] = Date.now();
  save(r);
  return { secondsLeft: Math.max(0, GUESS_SECONDS - (Date.now() - p.opened[id]) / 1000) };
}

export function submitGuess(r: SRoom, body: Record<string, unknown>) {
  if (!validPid(body.pid)) return { error: "bad player" };
  const p = player(r, body.pid, body.name);
  const d = r.drawings.find((x) => x.id === body.drawing);
  if (!d || d.artist === body.pid) return { error: "no such drawing" };
  if (d.guesses[body.pid]) return { done: true, ...d.guesses[body.pid], word: r.pack.words[d.word].w };
  const opened = p.opened[d.id] ?? Date.now();
  const left = GUESS_SECONDS - (Date.now() - opened) / 1000;
  const giveUp = body.giveUp === true || left < -3;
  const text = cleanText(body.text, 30);
  if (!giveUp && !text) return { correct: false, done: false };
  const correct = !giveUp && isRight(r, d.word, text);
  if (!correct && !giveUp) return { correct: false, done: false };
  d.guesses[body.pid] = { correct, points: correct ? guessPoints(left) : 0, secondsLeft: Math.max(0, left) };
  save(r);
  return { done: true, ...d.guesses[body.pid], word: r.pack.words[d.word].w };
}

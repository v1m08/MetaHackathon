// Ghost Run server: course generation (one model call, cached; presets instant), rooms with best times + ghosts.
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PRESET_COURSES, sanitizeCourse, type Course } from "../shared/run";
import { cleanText, normalizeInterest } from "../shared/text";
import { chatJSON, extractJson } from "./llm";

const ROOT = join(__dirname, "..", ".cache");
const COURSES = join(ROOT, "courses");
const ROOMS = join(ROOT, "run");
const key = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "x";

const SYSTEM = `You theme a one-thumb racing game played by friends in a group chat. Players dodge between three lanes while moving forward through a world, racing friends' ghosts to the finish.

Given a topic (a sport, activity, vehicle, place...), design the race so fans recognise their world:
- scene.kind: the world the race moves through, one of "cliff" (climb a rock face), "track" (race up a circuit/road), "ocean" (dive down into the sea), "space" (launch upward), "tower" (climb a building/stage), "dig" (dig down through earth), "trail" (hills, forest, slopes, fields).
- scene.start / scene.end: two hex colors each for the sky/water gradient at the start and at the far end of the race. scene.ground: hex for the main material. scene.props: 4-6 emoji that belong at the side of this world.
- avatar: ONE emoji of the person or vehicle doing the activity.
- obstacles: 3 emoji of real hazards in this activity (things to dodge), each a single common emoji.
- boost: ONE emoji of something that speeds you up in this world.
- finish: the word shouted at the finish (<= 16 chars, e.g. "Topped out!", "Chequered flag!").
- callouts: 4 short hype lines fans would shout (<= 22 chars each).
- title (<= 24 chars, original, no brands or real people), tagline (<= 60 chars).
- palette: primary (buttons) and accent (highlights) hex colors.
Reply with only JSON: {"title","tagline","scene":{"kind","start":[2 hex],"end":[2 hex],"ground","props":[emoji]},"avatar","obstacles":[emoji],"boost","finish","callouts":[strings],"palette":{"primary","accent"}}`;

export function presetCourse(interest: string): Course | null {
  const k = key(interest);
  return PRESET_COURSES.find((c) => key(c.interest) === k || k.includes(key(c.interest))) ?? null;
}
export function cachedCourse(interest: string): Course | null {
  const p = presetCourse(interest);
  if (p) return { ...p, interest };
  const f = join(COURSES, `${key(interest)}.json`);
  return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as Course) : null;
}
export function readyRunTopics() {
  const out = PRESET_COURSES.map((c) => ({ interest: c.interest, title: c.title }));
  if (existsSync(COURSES))
    for (const f of readdirSync(COURSES).filter((x) => x.endsWith(".json"))) {
      try {
        const c = JSON.parse(readFileSync(join(COURSES, f), "utf8")) as Course;
        out.push({ interest: c.interest, title: c.title });
      } catch {
        /* skip */
      }
    }
  return out;
}
export async function generateCourse(raw: string): Promise<Course> {
  const interest = normalizeInterest(raw) || "running";
  const cached = cachedCourse(interest);
  if (cached) return cached;
  const r = await chatJSON(
    [
      { role: "system", content: SYSTEM },
      { role: "user", content: `Topic: ${JSON.stringify(interest)}` },
    ],
    { maxTokens: 3000, timeoutMs: 60000, reasoning: "low", temperature: 0.9, task: "run.course" },
  );
  const course = sanitizeCourse(extractJson(r.text), interest);
  mkdirSync(COURSES, { recursive: true });
  writeFileSync(join(COURSES, `${key(interest)}.json`), JSON.stringify(course));
  return course;
}

// ---------- rooms ----------
interface Runner {
  name: string;
  best: number | null; // seconds
  plays: number;
  ghost: number[]; // best run: [pos, lane, pos, lane, …] every SAMPLE_MS
}
export interface RRoom {
  id: string;
  course: Course;
  seed: number;
  createdAt: string;
  players: Record<string, Runner>;
}
const rooms = new Map<string, RRoom>();
const file = (id: string) => join(ROOMS, `${id}.json`);
function save(r: RRoom) {
  mkdirSync(ROOMS, { recursive: true });
  writeFileSync(file(r.id) + ".tmp", JSON.stringify(r));
  renameSync(file(r.id) + ".tmp", file(r.id));
}
export function getRRoom(id: string): RRoom | null {
  if (!/^[a-z0-9]{4,12}$/.test(id)) return null;
  if (rooms.has(id)) return rooms.get(id)!;
  if (!existsSync(file(id))) return null;
  const r = JSON.parse(readFileSync(file(id), "utf8")) as RRoom;
  rooms.set(id, r);
  return r;
}
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export function createRRoom(course: Course): RRoom {
  let id = "";
  do id = Array.from(randomBytes(6), (b) => ALPHABET[b % ALPHABET.length]).join("");
  while (getRRoom(id));
  const r: RRoom = { id, course, seed: randomBytes(4).readUInt32LE(0), createdAt: new Date().toISOString(), players: {} };
  rooms.set(id, r);
  save(r);
  return r;
}
const validPid = (p: unknown): p is string => typeof p === "string" && /^[a-z0-9]{6,32}$/i.test(p);

export function rRoomView(r: RRoom, me: unknown) {
  const pid = validPid(me) ? me : "";
  const finished = Object.entries(r.players).filter(([, p]) => p.best !== null);
  const board = finished.map(([id, p]) => ({ name: p.name, time: p.best!, me: id === pid })).sort((a, b) => a.time - b.time);
  // ghosts: the five fastest other runners
  const ghosts = finished
    .filter(([id]) => id !== pid)
    .sort((a, b) => a[1].best! - b[1].best!)
    .slice(0, 5)
    .map(([, p]) => ({ name: p.name, time: p.best!, samples: p.ghost }));
  const mine = pid ? r.players[pid] : undefined;
  return { id: r.id, course: r.course, seed: r.seed, board, ghosts, me: mine ? { name: mine.name, best: mine.best, plays: mine.plays } : null };
}

export function submitRun(r: RRoom, body: Record<string, unknown>) {
  if (!validPid(body.pid)) return null;
  const time = Math.round(Math.min(600, Math.max(5, Number(body.time) || 600)) * 100) / 100;
  const samples = Array.isArray(body.samples) ? body.samples.slice(0, 12000).map((n) => Math.round(Number(n) || 0)) : [];
  const p = (r.players[body.pid] ??= { name: "Player", best: null, plays: 0, ghost: [] });
  p.name = cleanText(body.name, 16) || p.name;
  p.plays++;
  if (p.best === null || time < p.best) {
    p.best = time;
    p.ghost = samples;
  }
  save(r);
  return rRoomView(r, body.pid);
}

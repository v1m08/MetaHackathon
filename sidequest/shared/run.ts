// Ghost Run: a three-lane race through a pixel world themed to the topic, against friends' ghosts.
// Same seed → same course for everyone in the room. Score = finish time (lower is better).
import { rng } from "./kitchen";
import { SCENE_DEFAULTS, SCENES, guessScene, type Scene, type SceneKind } from "./rarity";

export const LANES = 3;
export const COURSE_LENGTH = 2700; // art px along the journey (~35-40 s for a clean run)
export const SAMPLE_MS = 100; // ghost recording rate

export interface Course {
  interest: string;
  title: string;
  tagline: string;
  scene: Scene;
  avatar: string; // the runner (person/vehicle emoji)
  obstacles: string[]; // 2-4 emoji to dodge
  boost: string; // emoji that gives a burst of speed
  finish: string; // word at the finish line ("Summit!", "Chequered flag!")
  callouts: string[]; // short hype lines for boosts / close calls
  palette: { primary: string; accent: string };
}

export type Row = { pos: number; lane: number; kind: "obstacle" | "boost"; emoji: string };

/** The fixed course: rows of obstacles (never all lanes blocked) and boosts. */
export function buildCourse(c: Course, seed: number): Row[] {
  const r = rng(seed);
  const out: Row[] = [];
  let pos = 180;
  while (pos < COURSE_LENGTH - 120) {
    const f = pos / COURSE_LENGTH;
    const blocked = r() < 0.25 + f * 0.45 ? 2 : 1;
    const lanes = [0, 1, 2].sort(() => r() - 0.5);
    for (let k = 0; k < blocked; k++) out.push({ pos: pos + (k ? r() * 10 : 0), lane: lanes[k], kind: "obstacle", emoji: c.obstacles[Math.floor(r() * c.obstacles.length)] });
    if (r() < 0.32) out.push({ pos: pos + 38 + r() * 20, lane: lanes[2], kind: "boost", emoji: c.boost });
    pos += Math.max(46, 92 - f * 44) * (0.8 + r() * 0.4);
  }
  return out;
}

// ---------- validation ----------
const str = (v: unknown, max: number, d = "") => (typeof v === "string" && v.trim() ? v.trim().replace(/\s+/g, " ").slice(0, max) : d);
const emoji = (v: unknown) => (typeof v === "string" && v.trim() && [...v.trim()].length <= 4 && !/[a-z0-9]/i.test(v) ? v.trim() : "");
const hex = (v: unknown, d: string) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : d);

export function sanitizeCourse(raw: unknown, interest: string): Course {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const s = (o.scene && typeof o.scene === "object" ? o.scene : {}) as Record<string, unknown>;
  const kind: SceneKind = (SCENES as readonly string[]).includes(String(s.kind)) && s.kind !== "kitchen" ? (s.kind as SceneKind) : guessScene(interest) === "kitchen" ? "trail" : guessScene(interest);
  const d = SCENE_DEFAULTS[kind];
  const pair = (v: unknown, def: [string, string]): [string, string] => (Array.isArray(v) && /^#[0-9a-f]{6}$/i.test(String(v[0])) && /^#[0-9a-f]{6}$/i.test(String(v[1])) ? [String(v[0]), String(v[1])] : def);
  const props = (Array.isArray(s.props) ? s.props : []).map(emoji).filter(Boolean).slice(0, 6);
  const obstacles = (Array.isArray(o.obstacles) ? o.obstacles : []).map(emoji).filter(Boolean).slice(0, 4);
  const callouts = (Array.isArray(o.callouts) ? o.callouts : []).map((x) => str(x, 24)).filter(Boolean).slice(0, 6);
  const pal = (o.palette && typeof o.palette === "object" ? o.palette : {}) as Record<string, unknown>;
  return {
    interest,
    title: str(o.title, 26, `${interest} Run`),
    tagline: str(o.tagline, 60, "Fastest in the chat wins."),
    scene: { kind, start: pair(s.start, d.start), end: pair(s.end, d.end), ground: hex(s.ground, d.ground), props: props.length >= 2 ? props : d.props },
    avatar: emoji(o.avatar) || d.avatar,
    obstacles: obstacles.length >= 2 ? obstacles : ["🪨", "🚧"],
    boost: emoji(o.boost) || "⚡",
    finish: str(o.finish, 18, "Finish!"),
    callouts: callouts.length >= 2 ? callouts : ["Clean!", "Flying!", "Send it!"],
    palette: { primary: hex(pal.primary, "#ff5d3a"), accent: hex(pal.accent, "#ffd23f") },
  };
}

// ---------- hand-made courses: instant, and the quality bar ----------
const preset = (c: Omit<Course, "scene"> & { scene: Partial<Scene> & { kind: SceneKind } }): Course => sanitizeCourse(c, c.interest);
export const PRESET_COURSES: Course[] = [
  preset({
    interest: "rock climbing",
    title: "Crux Rush",
    tagline: "Race your friends up the wall. Don't touch the loose rock.",
    scene: { kind: "cliff", start: ["#7cc4f2", "#d8eefb"], end: ["#16224a", "#3b4f8a"], ground: "#8a7a6a", props: ["🪢", "🦅", "☁️", "🪨"] },
    avatar: "🧗",
    obstacles: ["🪨", "🐝", "🌵"],
    boost: "🧲",
    finish: "Topped out!",
    callouts: ["Send it!", "Clean beta!", "Dyno!", "Flash!"],
    palette: { primary: "#ff6b35", accent: "#f7c548" },
  }),
  preset({
    interest: "f1",
    title: "Lights Out Sprint",
    tagline: "Three lanes, no DRS for cowards.",
    scene: { kind: "track", start: ["#6fb6e8", "#cfe9f7"], end: ["#ff9a5a", "#ffd39a"], ground: "#3a3d46", props: ["🏁", "🛞", "🚧", "🏆"] },
    avatar: "🏎️",
    obstacles: ["🚧", "🛢️", "🛞"],
    boost: "⚡",
    finish: "Chequered flag!",
    callouts: ["Purple sector!", "DRS open!", "Send it!", "Undercut!"],
    palette: { primary: "#e10600", accent: "#ffd400" },
  }),
  preset({
    interest: "skiing",
    title: "Powder Panic",
    tagline: "Fresh tracks, frozen nerves.",
    scene: { kind: "trail", start: ["#cfe8ff", "#f4fbff"], end: ["#ffb38a", "#ffe0c2"], ground: "#e8f1f8", props: ["🌲", "⛄", "❄️", "🚡"] },
    avatar: "⛷️",
    obstacles: ["🌲", "🪨", "⛄"],
    boost: "❄️",
    finish: "First chair!",
    callouts: ["Pow day!", "Sent it!", "Clean line!", "Yard sale avoided!"],
    palette: { primary: "#2f6fd1", accent: "#ffcf4a" },
  }),
];

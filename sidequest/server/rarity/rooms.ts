// Rarity rooms: one pack, any number of friends playing async. Answers are checked here (lists never leave the
// server), the clock is enforced here, and you only see friends' answers to a prompt after answering it.
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanText } from "../../shared/text";
import { matchAnswer, norm, ONLY_YOU_BONUS, PROMPTS_PER_GAME, publicPack, SECONDS_PER_PROMPT, TIER_POINTS, type Pack, type Verdict } from "../../shared/rarity";
import { judgeAnswer } from "./generate";
import { bgUrl, hasBg, makeBackdrop } from "./backdrop";

const MAX_TRIES = 3;
const GRACE_S = 4;

interface Pick {
  raw: string;
  a: string; // canonical, "" if timed out / gave up
  r: number; // 0 if none
  at: string;
}
interface Player {
  name: string;
  opened: Record<number, number>; // prompt index → epoch ms
  tries: Record<number, number>;
  picks: Record<number, Pick>;
  joinedAt: string;
}
export interface XRoom {
  id: string;
  interest: string;
  pack: Pack;
  createdAt: string;
  players: Record<string, Player>;
  /** Judged unlisted answers per prompt: normalized guess → verdict, so friends get consistent rulings. */
  judged: Record<number, Record<string, { valid: boolean; a?: string; r?: number; note?: string; reason?: string }>>;
}

const DIR = join(__dirname, "..", "..", ".cache", "rarity");
const PACKS = join(__dirname, "..", "..", ".cache", "packs");
const rooms = new Map<string, XRoom>();

function file(id: string) {
  return join(DIR, `${id}.json`);
}
function save(r: XRoom) {
  mkdirSync(DIR, { recursive: true });
  const tmp = file(r.id) + ".tmp";
  writeFileSync(tmp, JSON.stringify(r));
  renameSync(tmp, file(r.id));
}
export function getXRoom(id: string): XRoom | null {
  if (!/^[a-z0-9]{4,12}$/.test(id)) return null;
  if (rooms.has(id)) return rooms.get(id)!;
  if (!existsSync(file(id))) return null;
  const r = JSON.parse(readFileSync(file(id), "utf8")) as XRoom;
  rooms.set(id, r);
  return r;
}

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export function createXRoom(full: Pack): XRoom {
  const pack: Pack = { ...full, prompts: full.prompts.slice(0, PROMPTS_PER_GAME) };
  // Older generated topics fell back to the generic tower world: paint them a backdrop in the background.
  if (!pack.scene?.bg && pack.scene?.kind === "tower") void makeBackdrop(pack);
  let id = "";
  do id = Array.from(randomBytes(6), (b) => ALPHABET[b % ALPHABET.length]).join("");
  while (getXRoom(id));
  const r: XRoom = { id, interest: pack.interest, pack, createdAt: new Date().toISOString(), players: {}, judged: {} };
  rooms.set(id, r);
  save(r);
  return r;
}

// ---------- pack cache (same interest → same pack, instant) ----------
const packKey = (interest: string) => norm(interest).replace(/ /g, "-").slice(0, 60) || "x";
export function cachedPack(interest: string): Pack | null {
  const f = join(PACKS, `${packKey(interest)}.json`);
  return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as Pack) : null;
}
export function cachePack(p: Pack) {
  mkdirSync(PACKS, { recursive: true });
  writeFileSync(join(PACKS, `${packKey(p.interest)}.json`), JSON.stringify(p));
}
export const listCachedPacks = () => (existsSync(PACKS) ? readdirSync(PACKS).map((f) => f.replace(/\.json$/, "")) : []);
/** Topics that are ready instantly: [{ interest, title, emoji }]. */
export function readyTopics() {
  if (!existsSync(PACKS)) return [];
  return readdirSync(PACKS)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try {
        const p = JSON.parse(readFileSync(join(PACKS, f), "utf8")) as Pack;
        return { interest: p.interest, title: p.title, emoji: p.host?.emoji ?? "🎮" };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

// ---------- players ----------
const validPid = (pid: unknown): pid is string => typeof pid === "string" && /^[a-z0-9]{6,32}$/i.test(pid);
function player(r: XRoom, pid: string, name?: unknown): Player {
  let p = r.players[pid];
  if (!p) p = r.players[pid] = { name: "Player", opened: {}, tries: {}, picks: {}, joinedAt: new Date().toISOString() };
  const n = cleanText(name, 16);
  if (n) p.name = n;
  return p;
}

/** Who else (by name) gave canonical answer `a` to prompt i. */
function sameAs(r: XRoom, i: number, a: string, exceptPid: string) {
  const k = norm(a);
  return Object.entries(r.players)
    .filter(([pid, p]) => pid !== exceptPid && p.picks[i]?.a && norm(p.picks[i].a) === k)
    .map(([, p]) => p.name);
}

function pointsFor(r: XRoom, pid: string, i: number): { base: number; onlyYou: boolean } {
  const pick = r.players[pid]?.picks[i];
  if (!pick?.a) return { base: 0, onlyYou: false };
  const others = Object.keys(r.players).filter((x) => x !== pid && r.players[x].picks[i]);
  return { base: TIER_POINTS[pick.r - 1] ?? 0, onlyYou: others.length > 0 && sameAs(r, i, pick.a, pid).length === 0 };
}
export function scoreOf(r: XRoom, pid: string) {
  let s = 0;
  for (let i = 0; i < r.pack.prompts.length; i++) {
    const { base, onlyYou } = pointsFor(r, pid, i);
    s += base + (onlyYou ? ONLY_YOU_BONUS : 0);
  }
  return s;
}

export function openPrompt(r: XRoom, pid: unknown, name: unknown, i: number) {
  if (!validPid(pid) || !(i >= 0 && i < r.pack.prompts.length)) return { ok: false as const };
  const p = player(r, pid, name);
  if (!p.opened[i]) p.opened[i] = Date.now();
  save(r);
  const left = Math.max(0, SECONDS_PER_PROMPT - (Date.now() - p.opened[i]) / 1000);
  return { ok: true as const, secondsLeft: p.picks[i] ? 0 : left, done: !!p.picks[i] };
}

function gemFor(r: XRoom, i: number) {
  const top = [...r.pack.prompts[i].answers].sort((a, b) => b.r - a.r || (b.note ? 1 : 0) - (a.note ? 1 : 0))[0];
  return top ? { a: top.a, note: top.note } : undefined;
}

function lock(r: XRoom, pid: string, i: number, pick: Pick): Verdict {
  r.players[pid].picks[i] = pick;
  save(r);
  const base = pick.a ? (TIER_POINTS[pick.r - 1] ?? 0) : 0;
  return { ok: !!pick.a, locked: true, answer: pick.a || undefined, tier: pick.r || undefined, points: base, gem: gemFor(r, i), same: pick.a ? sameAs(r, i, pick.a, pid) : [] };
}

export async function submitAnswer(r: XRoom, pid: unknown, name: unknown, i: number, text: unknown, giveUp = false): Promise<Verdict> {
  if (!validPid(pid) || !(i >= 0 && i < r.pack.prompts.length)) return { ok: false, locked: false, reason: "Bad request" };
  const p = player(r, pid, name);
  if (p.picks[i]) return { ok: false, locked: true, reason: "Already answered" };
  const opened = p.opened[i] ?? Date.now();
  const late = (Date.now() - opened) / 1000 > SECONDS_PER_PROMPT + GRACE_S;
  if (giveUp || late) return { ...lock(r, pid, i, { raw: "", a: "", r: 0, at: new Date().toISOString() }), reason: late ? "Time's up" : undefined };

  const raw = cleanText(text, 60);
  if (!raw) return { ok: false, locked: false, reason: "Type an answer" };
  const prompt = r.pack.prompts[i];
  // already given by you on another prompt doesn't matter; duplicates inside one prompt can't happen (one pick)
  const hit = matchAnswer(raw, prompt.answers);
  let verdict: { valid: boolean; a?: string; r?: number; note?: string; reason?: string };
  if (hit) verdict = { valid: true, a: hit.a, r: hit.r, note: hit.note };
  else {
    const k = norm(raw);
    const cached = r.judged[i]?.[k];
    if (cached) verdict = cached;
    else {
      try {
        verdict = await judgeAnswer(r.interest, prompt, raw);
      } catch {
        verdict = { valid: false, reason: "Couldn't check that one, try another" };
      }
      if (!verdict.reason?.startsWith("Couldn't")) {
        (r.judged[i] ??= {})[k] = verdict;
        // accepted unlisted answers join the list, so friends match instantly and consistently
        if (verdict.valid && verdict.a && !matchAnswer(verdict.a, prompt.answers)) prompt.answers.push({ a: verdict.a, alias: [raw], r: verdict.r ?? 4, note: verdict.note });
      }
    }
  }
  if (verdict.valid && verdict.a) {
    const v = lock(r, pid, i, { raw, a: verdict.a, r: verdict.r ?? 3, at: new Date().toISOString() });
    return { ...v, note: verdict.note };
  }
  // A check that failed (timeout, network) isn't the player's fault: don't burn one of their tries.
  if (verdict.reason?.startsWith("Couldn't")) return { ok: false, locked: false, reason: verdict.reason };
  p.tries[i] = (p.tries[i] ?? 0) + 1;
  save(r);
  if (p.tries[i] >= MAX_TRIES) return { ...lock(r, pid, i, { raw, a: "", r: 0, at: new Date().toISOString() }), ok: false, reason: verdict.reason ?? "Not quite" };
  return { ok: false, locked: false, reason: verdict.reason ?? "Not on the list", tier: undefined };
}

const withBg = <P extends { interest: string; scene: Pack["scene"] }>(p: P): P => (p.scene && !p.scene.bg && hasBg(p.interest) ? { ...p, scene: { ...p.scene, bg: bgUrl(p.interest) } } : p);

/** Everything the client needs. Friends' answers only for prompts you've finished. */
export function roomView(r: XRoom, me: unknown) {
  const pid = validPid(me) ? me : "";
  const mine = pid ? r.players[pid] : undefined;
  const n = r.pack.prompts.length;
  const done = mine ? Object.keys(mine.picks).length : 0;
  const board = Object.entries(r.players)
    .map(([id, p]) => ({ name: p.name, score: scoreOf(r, id), answered: Object.keys(p.picks).length, me: id === pid }))
    .filter((x) => x.answered > 0)
    .sort((a, b) => b.score - a.score);
  const prompts = r.pack.prompts.map((pr, i) => {
    const my = mine?.picks[i];
    const revealed = !!my;
    const pts = pid ? pointsFor(r, pid, i) : { base: 0, onlyYou: false };
    return {
      mine: my ? { a: my.a, raw: my.raw, tier: my.r, points: pts.base, onlyYou: pts.onlyYou } : null,
      friends: revealed
        ? Object.entries(r.players)
            .filter(([id, p]) => id !== pid && p.picks[i])
            .map(([id, p]) => ({ name: p.name, a: p.picks[i].a, tier: p.picks[i].r, onlyYou: pointsFor(r, id, i).onlyYou }))
        : [],
      gem: revealed ? gemFor(r, i) : undefined,
      count: pr.answers.length,
    };
  });
  return {
    id: r.id,
    pack: withBg(publicPack(r.pack)),
    me: mine ? { name: mine.name, done, finished: done >= n, score: pid ? scoreOf(r, pid) : 0 } : null,
    board,
    prompts,
  };
}

// Word hunt board generation. Places themed words on a 5x5 board (sharing letters where they can), fills
// the rest from English letter frequencies, solves the board against the dictionary, and keeps the best of
// many attempts. Deterministic for a given seed.
import { createRequire } from "node:module";
import { rng } from "../client/src/engine/util";
import { buildTrie, CELLS, findPath, MIN_LEN, neighbors, solve, type Puzzle, type ThemedWord, type Trie } from "../shared/wordhunt";

const req = createRequire(__filename);

// SCOWL tiers: 10-35 are everyday words, 40-60 are valid but less common. 70+ is too obscure.
const COMMON_TIERS = [10, 20, 35];
const ACCEPT_TIERS = [10, 20, 35, 40, 50, 55, 60];
const VARIANTS = ["", "american/", "british/", "canadian/", "australian/"];
// Words never accepted or shown, even if a board happens to spell them.
const BLOCK = new Set(
  "ANAL ANUS ARSE ASS BITCH BONER BOOB BOOBS BUTT CLIT COCK COON CRAP CUM CUNT DAMN DICK DIKE DYKE FAG FAGS FART FUCK GOOK HELL HOMO JAP JIZZ KIKE NAZI NIGGER PAKI PISS POOP PORN PUSSY RAPE RAPED RAPES SEX SEXY SHIT SLUT SPIC TIT TITS TWAT WANK WHORE WOP".split(" "),
);

let dict: { accept: Set<string>; common: Set<string>; trie: Trie } | null = null;

export function dictionary() {
  if (dict) return dict;
  const wl = req("wordlist-english") as Record<string, string[]>;
  const accept = new Set<string>();
  const common = new Set<string>();
  const ok = (w: string) => /^[a-z]{3,12}$/.test(w);
  for (const v of VARIANTS)
    for (const t of ACCEPT_TIERS) {
      const list = wl[`english/${v}${t}`];
      if (!list) continue;
      for (const w of list) {
        if (!ok(w)) continue;
        const u = w.toUpperCase();
        if (BLOCK.has(u)) continue;
        accept.add(u);
        if (COMMON_TIERS.includes(t)) common.add(u);
      }
    }
  dict = { accept, common, trie: buildTrie(accept) };
  return dict;
}

// English-ish letter weights for filler tiles (Q excluded; J/X/Z rare).
const WEIGHTS: Record<string, number> = {
  E: 12, A: 9, I: 8, O: 8, T: 9, N: 7, S: 7, R: 7, H: 4, L: 5, D: 4, C: 3, U: 4, M: 3, P: 3, G: 3, B: 2, F: 2, Y: 2, W: 2, K: 1.2, V: 1.2, X: 0.3, J: 0.3, Z: 0.3,
};
const VOWELS = new Set(["A", "E", "I", "O", "U"]);
const LETTERS = Object.keys(WEIGHTS);
const TOTAL = LETTERS.reduce((s, l) => s + WEIGHTS[l], 0);

export const cleanWord = (w: string) => w.toUpperCase().replace(/[^A-Z]/g, "");

function placeWord(board: (string | null)[], word: string, r: ReturnType<typeof rng>): boolean {
  // randomized DFS; may reuse a cell that already holds the right letter
  const used = new Set<number>();
  const path: number[] = [];
  const shuffle = <T>(a: T[]) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  let budget = 4000;
  const go = (i: number, k: number): boolean => {
    if (--budget < 0) return false;
    if (used.has(i) || (board[i] !== null && board[i] !== word[k])) return false;
    used.add(i);
    path.push(i);
    if (k === word.length - 1) return true;
    // prefer cells that already hold the next letter: overlapping words pack more theme onto the board
    const next = shuffle(neighbors(i)).sort((a, b) => Number(board[b] === word[k + 1]) - Number(board[a] === word[k + 1]));
    for (const j of next) if (go(j, k + 1)) return true;
    used.delete(i);
    path.pop();
    return false;
  };
  for (const start of shuffle([...Array(CELLS).keys()])) {
    if (go(start, 0)) {
      path.forEach((cell, k) => (board[cell] = word[k]));
      return true;
    }
  }
  return false;
}

function fill(board: (string | null)[], r: ReturnType<typeof rng>): string[] {
  const pick = () => {
    let x = r.next() * TOTAL;
    for (const l of LETTERS) if ((x -= WEIGHTS[l]) < 0) return l;
    return "E";
  };
  const out = board.map((c) => c ?? pick());
  // keep the board playable: at least 7 vowels, at most 2 of any rare letter
  const free = board.map((c, i) => (c === null ? i : -1)).filter((i) => i >= 0);
  let vowels = out.filter((c) => VOWELS.has(c)).length;
  for (const i of free) {
    if (vowels >= 7) break;
    if (!VOWELS.has(out[i])) {
      out[i] = r.pick(["A", "E", "E", "I", "O", "U", "A", "O"]);
      vowels++;
    }
  }
  return out;
}

export function generatePuzzle(themedIn: ThemedWord[], seed: number): Puzzle {
  const d = dictionary();
  const themed = themedIn
    .map((t) => ({ word: cleanWord(t.word), hint: t.hint }))
    .filter((t) => t.word.length >= MIN_LEN && t.word.length <= 10)
    .filter((t, i, a) => a.findIndex((x) => x.word === t.word) === i);

  let best: { score: number; puzzle: Puzzle } | null = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    const r = rng(seed + attempt * 7919);
    const board: (string | null)[] = new Array(CELLS).fill(null);
    // one or two long showpiece words, then as many short themed words as fit
    const long = themed.filter((t) => t.word.length >= 6).sort(() => r.next() - 0.5).slice(0, 2);
    const short = themed.filter((t) => t.word.length < 6).sort(() => r.next() - 0.5);
    const placed: ThemedWord[] = [];
    for (const t of [...long, ...short]) {
      const filled = board.filter(Boolean).length;
      if (filled + t.word.length > CELLS - 4 && !board.some((c, i) => c === t.word[0] && i >= 0)) continue;
      const snapshot = [...board];
      if (placeWord(board, t.word, r)) {
        if (board.filter(Boolean).length > CELLS - 4) board.splice(0, CELLS, ...snapshot); // keep room for filler
        else placed.push(t);
      }
    }
    const letters = fill(board, r);
    // placement can be broken by vowel fixing only on free cells, so this stays true; verify anyway
    const themedOk = placed.filter((t) => findPath(letters, t.word));
    const found = solve(letters, d.trie);
    for (const t of themedOk) found.add(t.word);
    const themedSet = new Set(themedOk.map((t) => t.word));
    const words = [...found].map((w) => ({ w, c: d.common.has(w) || themedSet.has(w) }));
    const common = words.filter((x) => x.c).length;
    const longThemed = themedOk.filter((t) => t.word.length >= 6).length;
    const score = themedOk.length * 12 + longThemed * 8 + Math.min(common, 140) / 3;
    if (!best || score > best.score) best = { score, puzzle: { board: letters, words, themed: themedOk } };
    if (themedOk.length >= Math.min(7, themed.length) && common >= 90 && longThemed >= 1) break;
  }
  return best!.puzzle;
}

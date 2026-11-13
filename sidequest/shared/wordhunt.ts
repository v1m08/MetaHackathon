// Word hunt core, shared by server (board generation, solving) and client (geometry, scoring).
// The client never needs a dictionary: the server ships every valid word on the board.

export const SIZE = 5;
export const CELLS = SIZE * SIZE;
export const MIN_LEN = 3;
export const ROUND_SECONDS = 80;

export interface ThemedWord {
  word: string; // uppercase A-Z
  hint: string; // short explanation shown when found / revealed
}

export interface Puzzle {
  board: string[]; // 25 uppercase letters, row-major
  /** Every valid word on the board, uppercase. `c` = common (shown in "you missed"). */
  words: { w: string; c: boolean }[];
  /** Themed words actually placed on this board. */
  themed: ThemedWord[];
}

export const rc = (i: number) => [Math.floor(i / SIZE), i % SIZE] as const;
export function adjacent(a: number, b: number) {
  const [r1, c1] = rc(a), [r2, c2] = rc(b);
  return a !== b && Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1;
}
export function neighbors(i: number): number[] {
  const out: number[] = [];
  const [r, c] = rc(i);
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE) out.push(rr * SIZE + cc);
    }
  return out;
}

/** Points by word length. Themed words score double. */
export function wordPoints(len: number, themed: boolean) {
  const base = len <= 3 ? 100 : len === 4 ? 300 : len === 5 ? 600 : len === 6 ? 1000 : len === 7 ? 1500 : 2000 + (len - 8) * 500;
  return themed ? base * 2 : base;
}

// ---------- solving (server + tests) ----------

export interface Trie {
  end: boolean;
  next: Map<string, Trie>;
}
export function buildTrie(words: Iterable<string>): Trie {
  const root: Trie = { end: false, next: new Map() };
  for (const w of words) {
    let n = root;
    for (const ch of w) {
      let m = n.next.get(ch);
      if (!m) n.next.set(ch, (m = { end: false, next: new Map() }));
      n = m;
    }
    n.end = true;
  }
  return root;
}

/** All words in the trie that can be traced on the board (adjacent cells, no reuse). */
export function solve(board: string[], trie: Trie, maxLen = 12): Set<string> {
  const found = new Set<string>();
  const used = new Array(CELLS).fill(false);
  const walk = (i: number, node: Trie, word: string) => {
    const n = node.next.get(board[i]);
    if (!n) return;
    const w = word + board[i];
    if (n.end && w.length >= MIN_LEN) found.add(w);
    if (w.length >= maxLen) return;
    used[i] = true;
    for (const j of neighbors(i)) if (!used[j]) walk(j, n, w);
    used[i] = false;
  };
  for (let i = 0; i < CELLS; i++) walk(i, trie, "");
  return found;
}

/** A path on the board that spells `word`, or null. */
export function findPath(board: string[], word: string): number[] | null {
  const path: number[] = [];
  const used = new Array(CELLS).fill(false);
  const go = (i: number, k: number): boolean => {
    if (board[i] !== word[k] || used[i]) return false;
    path.push(i);
    if (k === word.length - 1) return true;
    used[i] = true;
    for (const j of neighbors(i)) if (go(j, k + 1)) return true;
    used[i] = false;
    path.pop();
    return false;
  };
  for (let i = 0; i < CELLS; i++) if (go(i, 0)) return path;
  return null;
}

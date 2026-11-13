// Cost ledger + budget guard. Every live Model API call reserves a worst-case cost BEFORE it is sent and
// settles to the real usage afterwards. The ledger is a gitignored JSON file guarded by a lock file, so
// the dev server, eval scripts and persona swarms can all write to it at once without overshooting.
// No "@/" imports here on purpose: the test runner loads this file directly with node.
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** USD per 1M tokens. Third-party reported, unconfirmed → MARGIN applied everywhere. See DECISIONS.md. */
export const PRICES: Record<string, { input: number; cached: number; output: number }> = {
  "muse-ember-1.0": { input: 0.1, cached: 0.004, output: 0.5 },
  "muse-spark-1.3": { input: 1.25, cached: 0.15, output: 4.25 },
  "muse-spark-1.2": { input: 1.25, cached: 0.15, output: 4.25 },
  "muse-spark-1.1": { input: 1.25, cached: 0.15, output: 4.25 },
  "muse-wonder-1.0": { input: 4, cached: 0.2, output: 20 },
};
const UNKNOWN_PRICE = PRICES["muse-wonder-1.0"]; // deliberately the most expensive
export const IMAGE_GEN_USD = 0.15; // per generated image, deliberately high
export const MARGIN = 1.5;
/** Worst-case prompt tokens per input image (measured ≈600 for 256×192). */
export const IMAGE_INPUT_TOKENS = 2000;

export interface LedgerEntry {
  id: string;
  ts: string;
  task: string;
  model: string;
  kind: string;
  status: "pending" | "ok" | "error";
  /** Worst-case reservation made before the call. */
  reservedUsd: number;
  /** Final booked cost (= real usage × price × margin, or the reservation if the call failed without usage). */
  costUsd: number;
  promptTokens?: number;
  cachedTokens?: number;
  completionTokens?: number;
  images?: number;
  attempt?: number;
  note?: string;
}
interface LedgerFile {
  entries: LedgerEntry[];
}

export class BudgetExceededError extends Error {
  spentUsd: number;
  limitUsd: number;
  estimateUsd: number;
  constructor(spentUsd: number, limitUsd: number, estimateUsd: number) {
    super(`Muse budget guard: $${spentUsd.toFixed(2)} spent/reserved of $${limitUsd.toFixed(2)}; refusing a call estimated at $${estimateUsd.toFixed(4)}`);
    this.spentUsd = spentUsd;
    this.limitUsd = limitUsd;
    this.estimateUsd = estimateUsd;
  }
}

export interface LedgerOptions {
  file?: string;
  budgetUsd?: number;
  reserveUsd?: number;
  /** When true, calls may spend into the reserve (final QA, demo recordings). */
  final?: boolean;
}

const roundUp = (usd: number) => Math.ceil(usd * 10000) / 10000;

export function priceFor(model: string) {
  return PRICES[model] ?? UNKNOWN_PRICE;
}

/** Worst-case cost of a chat call, in USD, with margin. Rounded up. */
export function estimateChatUsd(model: string, promptChars: number, maxTokens: number, images = 0) {
  const p = priceFor(model);
  const promptTokens = Math.ceil(promptChars / 2.5) + images * IMAGE_INPUT_TOKENS + 64;
  return roundUp(((promptTokens * p.input + maxTokens * p.output) / 1e6) * MARGIN);
}
/** Real cost from a usage block, with margin. Rounded up. */
export function settleChatUsd(model: string, usage: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } }) {
  const p = priceFor(model);
  const cached = usage.prompt_tokens_details?.cached_tokens ?? 0;
  const prompt = Math.max(0, (usage.prompt_tokens ?? 0) - cached);
  const out = usage.completion_tokens ?? 0;
  return { usd: roundUp(((prompt * p.input + cached * p.cached + out * p.output) / 1e6) * MARGIN), cached };
}

function sleepSync(ms: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export class Ledger {
  readonly file: string;
  readonly budgetUsd: number;
  readonly reserveUsd: number;
  readonly final: boolean;
  constructor(o: LedgerOptions = {}) {
    this.file = o.file ?? join(process.cwd(), ".ai-ledger.json");
    this.budgetUsd = o.budgetUsd ?? Number(process.env.MODEL_BUDGET_USD ?? 50);
    this.reserveUsd = o.reserveUsd ?? Number(process.env.MODEL_BUDGET_RESERVE_USD ?? 10);
    this.final = o.final ?? process.env.AI_FINAL === "1";
  }
  /** The limit this process may spend up to. */
  get limitUsd() {
    return this.final ? this.budgetUsd : Math.max(0, this.budgetUsd - this.reserveUsd);
  }

  private lockPath() {
    return this.file + ".lock";
  }
  private withLock<T>(fn: (data: LedgerFile) => T): T {
    const lock = this.lockPath();
    mkdirSync(dirname(this.file), { recursive: true });
    const started = Date.now();
    for (;;) {
      try {
        const fd = openSync(lock, "wx");
        closeSync(fd);
        break;
      } catch {
        // stale lock (a crashed process) after 10s
        try {
          if (Date.now() - statSync(lock).mtimeMs > 10_000) unlinkSync(lock);
        } catch {
          /* raced */
        }
        if (Date.now() - started > 15_000) throw new Error("ledger lock timeout");
        sleepSync(5 + Math.random() * 10);
      }
    }
    try {
      const data = this.read();
      const out = fn(data);
      const tmp = this.file + ".tmp" + process.pid;
      writeFileSync(tmp, JSON.stringify(data));
      renameSync(tmp, this.file);
      return out;
    } finally {
      try {
        unlinkSync(lock);
      } catch {
        /* already gone */
      }
    }
  }
  read(): LedgerFile {
    if (!existsSync(this.file)) return { entries: [] };
    try {
      return JSON.parse(readFileSync(this.file, "utf8")) as LedgerFile;
    } catch {
      return { entries: [] };
    }
  }

  /** Spent + reserved so far (pending reservations count in full). */
  totals(data = this.read()) {
    let spent = 0;
    let pending = 0;
    let calls = 0;
    let errors = 0;
    const byModel: Record<string, number> = {};
    for (const e of data.entries) {
      if (e.status === "pending") pending += e.reservedUsd;
      else {
        spent += e.costUsd;
        calls++;
        if (e.status === "error") errors++;
      }
      byModel[e.model] = (byModel[e.model] ?? 0) + (e.status === "pending" ? e.reservedUsd : e.costUsd);
    }
    return { spentUsd: roundUp(spent), pendingUsd: roundUp(pending), committedUsd: roundUp(spent + pending), calls, errors, byModel, limitUsd: this.limitUsd, budgetUsd: this.budgetUsd, reserveUsd: this.reserveUsd, final: this.final };
  }

  /** Reserve a worst-case amount or throw BudgetExceededError. Atomic across processes. */
  reserve(e: Omit<LedgerEntry, "id" | "ts" | "status" | "costUsd">): string {
    return this.withLock((data) => {
      const t = this.totals(data);
      if (t.committedUsd + e.reservedUsd > this.limitUsd) throw new BudgetExceededError(t.committedUsd, this.limitUsd, e.reservedUsd);
      const id = `l_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      data.entries.push({ ...e, id, ts: new Date().toISOString(), status: "pending", costUsd: e.reservedUsd });
      return id;
    });
  }
  /** Replace the reservation with the real cost. */
  settle(id: string, patch: { costUsd: number; promptTokens?: number; cachedTokens?: number; completionTokens?: number; note?: string }) {
    this.withLock((data) => {
      const e = data.entries.find((x) => x.id === id);
      if (!e) return;
      Object.assign(e, patch, { status: "ok" });
    });
  }
  /** A failed call: no usage came back, so the reservation stands as the booked cost (it may have been billed). */
  fail(id: string, note: string) {
    this.withLock((data) => {
      const e = data.entries.find((x) => x.id === id);
      if (!e) return;
      e.status = "error";
      e.note = note.slice(0, 200);
    });
  }
}

let shared: Ledger | undefined;
export function ledger() {
  return (shared ??= new Ledger());
}

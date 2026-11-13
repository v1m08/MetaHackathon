// interest → design → code → static check → headless playtest (→ repair). Spike version: one repair pass.
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import * as esbuild from "esbuild";
import { normalizeInterest } from "../../shared/schema";
import { env } from "../env";
import { chatJSON, extractJson } from "../llm";
import { codeSystem, DESIGN_SYSTEM } from "./prompts";
import type { PlaytestResult } from "../../kit/headless";

export interface Design {
  title: string;
  tagline: string;
  howToPlay: string;
  palette: Record<string, string>;
  [k: string]: unknown;
}
export interface GeneratedGame {
  id: string;
  interest: string;
  design: Design;
  code: string;
  seed: number;
  createdAt: string;
  stats: { designMs: number; codeMs: number; costUsd: number; repairs: number; playtests: PlaytestResult[]; model: string; issues: string[] };
}

const DIR = join(__dirname, "..", "..", ".cache", "games");
export type Stage = "design" | "code" | "check" | "playtest" | "repair" | "done";

export function saveGame(g: GeneratedGame) {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(join(DIR, `${g.id}.json`), JSON.stringify(g, null, 1));
}
export function loadGame(id: string): GeneratedGame | null {
  if (!/^[a-z0-9]{4,16}$/.test(id)) return null;
  const f = join(DIR, `${id}.json`);
  return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as GeneratedGame) : null;
}
export function findByInterest(interest: string): GeneratedGame | null {
  if (!existsSync(DIR)) return null;
  const key = interest.toLowerCase();
  const hits = readdirSync(DIR)
    .map((f) => JSON.parse(readFileSync(join(DIR, f), "utf8")) as GeneratedGame)
    .filter((g) => g.interest.toLowerCase() === key && g.stats.issues.length === 0)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return hits[0] ?? null;
}

const DENY = /\b(fetch|XMLHttpRequest|WebSocket|document|window|globalThis|localStorage|sessionStorage|indexedDB|eval|importScripts|setTimeout|setInterval|requestAnimationFrame|navigator|location|postMessage|Date)\b|\bnew\s+Function\b|\bimport\s*\(/;

/** Syntax + safety checks. Returns problems (empty = fine) and the auto-fixed code. */
export async function staticCheck(code: string): Promise<{ code: string; problems: string[] }> {
  const problems: string[] = [];
  let fixed = code.replace(/Math\.random\(\)/g, "sq.rand()");
  if (!/export\s+default\s+function/.test(fixed)) problems.push("Missing `export default function game(sq)`.");
  if (fixed.length > 60000) problems.push("Module is too large (keep it under 60 KB).");
  try {
    const out = await esbuild.transform(fixed, { loader: "js", format: "esm", target: "es2020" });
    const m = out.code.match(DENY);
    if (m) problems.push(`Uses forbidden API \`${m[0]}\`. Only the sq kit is available.`);
  } catch (e) {
    problems.push(`Syntax error: ${(e as Error).message.split("\n").slice(0, 3).join(" ")}`);
  }
  return { code: fixed, problems };
}

let headlessBundle: string | null = null;
async function getHeadlessBundle() {
  if (headlessBundle) return headlessBundle;
  const r = await esbuild.build({
    entryPoints: [join(__dirname, "..", "..", "kit", "headless.ts")],
    bundle: true,
    write: false,
    format: "iife",
    globalName: "__KIT",
    platform: "neutral",
    target: "es2020",
    logLevel: "silent",
  });
  headlessBundle = r.outputFiles[0].text;
  return headlessBundle;
}

/** Run the game for full rounds with different bots inside a worker (killed after a timeout). */
export async function headlessPlaytest(code: string, seed: number): Promise<PlaytestResult[]> {
  const game = (await esbuild.transform(code, { loader: "js", format: "iife", globalName: "__GAMEMOD", target: "es2020" })).code;
  const kit = await getHeadlessBundle();
  const src = `
    const { parentPort, workerData } = require("node:worker_threads");
    ${kit}
    ${game}
    const out = [];
    for (const bot of ["idle", "random", "tapper"]) out.push(__KIT.playtest(__GAMEMOD.default, { seed: workerData.seed, bot }));
    parentPort.postMessage(out);
  `;
  return new Promise((resolve) => {
    const w = new Worker(src, { eval: true, workerData: { seed }, resourceLimits: { maxOldGenerationSizeMb: 256 } });
    const timer = setTimeout(() => {
      void w.terminate();
      resolve([{ bot: "all", ok: false, error: "Playtest timed out (infinite loop or far too slow).", ended: false, endedAt: 0, score: 0, slowestStepMs: 0 }]);
    }, 20000);
    w.once("message", (m) => {
      clearTimeout(timer);
      void w.terminate();
      resolve(m as PlaytestResult[]);
    });
    w.once("error", (e) => {
      clearTimeout(timer);
      resolve([{ bot: "all", ok: false, error: e.message, ended: false, endedAt: 0, score: 0, slowestStepMs: 0 }]);
    });
  });
}

/** Turn playtest results into concrete problems for the repair prompt. */
export function judge(results: PlaytestResult[]): string[] {
  const issues: string[] = [];
  for (const r of results) {
    if (!r.ok) issues.push(`Crash with ${r.bot} input: ${r.error}`);
    else if (!r.ended) issues.push(`With ${r.bot} input the round never called sq.end() within 95 s.`);
    if (r.ok && r.slowestStepMs > 8) issues.push(`update() took ${r.slowestStepMs.toFixed(1)} ms in one step; keep it under 2 ms.`);
  }
  const by = Object.fromEntries(results.map((r) => [r.bot, r]));
  const longest = Math.max(...results.map((r) => (r.ok ? r.endedAt : 99)));
  if (longest < 6) issues.push(`Every playtest round ended within ${longest}s. The round should last 30-60 s for a decent player; check that sq.end() isn't called too early and that the first 5 seconds are easy.`);
  if (by.idle?.ok && by.random?.ok && by.tapper?.ok && by.idle.score === by.random.score && by.random.score === by.tapper.score)
    issues.push(`Score is ${by.idle.score} no matter what the player does; input must affect the score.`);
  if (by.idle?.ok && by.idle.ended && by.idle.endedAt >= 25 && by.idle.score > 0 && by.idle.score >= Math.max(by.random?.score ?? 0, by.tapper?.score ?? 0))
    issues.push(`Doing nothing scores ${by.idle.score}, as much as playing; idle play should score little.`);
  return [...new Set(issues)];
}

const extractCode = (text: string) => {
  const m = text.match(/```(?:js|javascript)?\s*\n([\s\S]*?)```/);
  return (m ? m[1] : text).trim();
};

export async function generateGame(rawInterest: string, onStage: (s: Stage, info?: string) => void = () => {}, opts: { codeModel?: string } = {}): Promise<GeneratedGame> {
  const interest = normalizeInterest(rawInterest) || "fun";
  const codeModel = opts.codeModel ?? process.env.SIDEQUEST_CODE_MODEL ?? env.model;
  let cost = 0;

  onStage("design");
  const t0 = performance.now();
  const d = await chatJSON(
    [
      { role: "system", content: DESIGN_SYSTEM },
      { role: "user", content: `Interest: ${JSON.stringify(interest)}` },
    ],
    { maxTokens: 4000, timeoutMs: 60000, reasoning: "low", task: "sidequest.design" },
  );
  cost += d.costUsd;
  const design = extractJson(d.text) as Design;
  const designMs = Math.round(performance.now() - t0);
  onStage("code", `${design.title}: ${design.tagline}`);

  const t1 = performance.now();
  const messages = [
    { role: "system" as const, content: codeSystem() },
    { role: "user" as const, content: `Interest: ${JSON.stringify(interest)}\nDesign:\n${JSON.stringify(design, null, 1)}\n\nWrite the game.` },
  ];
  const c = await chatJSON(messages, { json: false, maxTokens: 24000, timeoutMs: 300000, reasoning: "medium", temperature: 0.6, model: codeModel, task: "sidequest.code" });
  cost += c.costUsd;
  let code = extractCode(c.text);
  const codeMs = Math.round(performance.now() - t1);
  const seed = randomBytes(4).readUInt32LE(0);

  let repairs = 0;
  let issues: string[] = [];
  let playtests: PlaytestResult[] = [];
  for (let round = 0; round < 2; round++) {
    onStage("check");
    const sc = await staticCheck(code);
    code = sc.code;
    issues = sc.problems;
    if (!issues.length) {
      onStage("playtest");
      playtests = await headlessPlaytest(code, seed);
      issues = judge(playtests);
    }
    if (!issues.length || round === 1) break;
    repairs++;
    onStage("repair", issues.join(" | ").slice(0, 160));
    const r = await chatJSON(
      [
        ...messages,
        { role: "assistant", content: "```js\n" + code + "\n```" },
        { role: "user", content: `Automated playtest found these problems. Fix them and return the complete corrected module in one \`\`\`js block:\n- ${issues.join("\n- ")}` },
      ],
      { json: false, maxTokens: 24000, timeoutMs: 300000, reasoning: "low", temperature: 0.3, model: codeModel, task: "sidequest.repair" },
    );
    cost += r.costUsd;
    code = extractCode(r.text);
  }

  const game: GeneratedGame = {
    id: Array.from(randomBytes(8), (b) => "abcdefghjkmnpqrstuvwxyz23456789"[b % 31]).join(""),
    interest,
    design,
    code,
    seed,
    createdAt: new Date().toISOString(),
    stats: { designMs, codeMs, costUsd: cost, repairs, playtests, model: codeModel, issues },
  };
  saveGame(game);
  onStage("done");
  return game;
}

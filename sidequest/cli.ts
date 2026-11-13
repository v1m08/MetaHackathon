// Sidequest CLI: type an interest, get a link to a game themed to it.
//
//   npm run sidequest                       interactive: keeps asking, prints a link per interest
//   npm run sidequest -- "F1 and cooking"   one interest, then keeps serving (and asking)
//
// Flags: --demo (hand-made F1 word hunt)  --fresh (skip cache)  --offline (keyword fallback only, no API)  --open (open in browser)
//        --port 5180  --no-serve (just print the link; assumes a server is already running)
import { execFile } from "node:child_process";
import { createInterface } from "node:readline";
import "./server/env";
import { env, liveEnabled } from "./server/env";
import { generate } from "./server/generate";
import { findByInterest, generateGame, type Stage } from "./server/gen/pipeline";
import { spentUsd } from "./server/llm";
import { isOurServer, lanAddress, startServer } from "./server/serve";
import { encodeShare } from "./shared/share";
import { sanitizeConfig } from "./shared/schema";
import { WORDHUNT_F1 } from "./server/themes";

const args = process.argv.slice(2);
const flag = (f: string) => args.includes(f);
const portIdx = args.indexOf("--port");
const port = portIdx >= 0 ? Number(args[portIdx + 1]) : Number(process.env.SIDEQUEST_PORT) || 5180;
const interests = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--port");

const c = { dim: "\x1b[2m", bold: "\x1b[1m", cyan: "\x1b[36m", green: "\x1b[32m", yellow: "\x1b[33m", reset: "\x1b[0m" };

const STAGES: Record<Stage, string> = { design: "designing the game", code: "writing the code", check: "checking the code", playtest: "playtesting", repair: "fixing what the playtest found", done: "done" };

/** v3: generate a brand-new game from scratch for the interest. */
async function makeGame(interest: string) {
  const t0 = performance.now();
  const cached = flag("--fresh") ? null : findByInterest(interest);
  const g =
    cached ??
    (await generateGame(interest, (stage, info) => {
      const secs = ((performance.now() - t0) / 1000).toFixed(0).padStart(3);
      console.log(`  ${c.dim}${secs}s  ${STAGES[stage]}${c.reset}${info ? `  ${c.dim}${info}${c.reset}` : ""}`);
    }).catch((e: Error) => {
      console.log(`  ${c.yellow}generation failed: ${e.message}${c.reset}\n`);
      return null;
    }));
  if (!g) return;
  const st = g.stats;
  console.log(`\n  ${c.bold}${g.design.title}${c.reset} ${c.dim}— ${g.design.tagline}${c.reset}`);
  console.log(`  ${c.dim}${String(g.design.howToPlay ?? "")}${c.reset}`);
  const verdict = st.issues.length ? `${c.yellow}${st.issues.length} unresolved issue(s): ${st.issues.join(" | ").slice(0, 200)}${c.reset}` : `${c.green}passed playtest${c.reset}`;
  console.log(`  ${cached ? "cached · " : ""}${verdict}${c.dim} · ${((st.designMs + st.codeMs) / 1000).toFixed(0)}s model time · ${st.repairs} repair(s) · $${st.costUsd.toFixed(3)} · ${st.model}${c.reset}`);
  const local = `http://localhost:${port}/play/${g.id}`;
  console.log(`  ${c.green}${local}${c.reset}`);
  const lan = lanAddress();
  if (lan) console.log(`  ${c.dim}phones on the same wifi:${c.reset} ${c.cyan}http://${lan}:${port}/play/${g.id}${c.reset}`);
  console.log();
  if (flag("--open")) execFile("open", [local]);
}

async function makeLink(interest: string, preset?: unknown) {
  process.stdout.write(`${c.dim}  generating…${c.reset}`);
  const r = preset
    ? { config: sanitizeConfig(preset), source: "preset" as const, ms: 0, costUsd: 0, note: undefined }
    : await generate(interest, { fresh: flag("--fresh"), offline: flag("--offline") });
  process.stdout.write("\r\x1b[K");
  // A room gives a short link with a shared leaderboard; without a server, fall back to a self-contained hash link.
  let path = "";
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/rooms`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ config: r.config }) });
    if (res.ok) path = `/g/${((await res.json()) as { id: string }).id}`;
  } catch {
    /* no server */
  }
  if (!path) path = `/#${await encodeShare({ config: r.config })}`;
  const cfg = r.config;
  const src = r.source === "fallback" ? `${c.yellow}fallback${c.reset}${r.note ? c.dim + " (" + r.note + ")" + c.reset : ""}` : r.source;
  console.log(`  ${c.bold}${cfg.sprites.player} ${cfg.title}${c.reset} ${c.dim}— ${cfg.template} · ${cfg.modifiers.join(", ")}${c.reset}`);
  console.log(`  ${c.dim}${cfg.tagline}${c.reset}`);
  console.log(`  ${c.dim}source: ${c.reset}${src}${c.dim} · ${r.ms}ms${r.costUsd ? ` · $${r.costUsd.toFixed(4)}` : ""}${c.reset}`);
  const local = `http://localhost:${port}${path}`;
  console.log(`  ${c.green}${local}${c.reset}`);
  const lan = lanAddress();
  if (lan) console.log(`  ${c.dim}phones on the same wifi:${c.reset} ${c.cyan}http://${lan}:${port}${path}${c.reset}`);
  console.log();
  if (flag("--open")) execFile("open", [local]);
}

async function main() {
  console.log(`\n${c.bold}🎮 Sidequest${c.reset} ${c.dim}— interest → themed minigame${c.reset}`);
  console.log(
    `${c.dim}   model: ${liveEnabled() && !flag("--offline") ? `${env.model} (live, timeout ${env.timeoutMs}ms, spent $${spentUsd().toFixed(2)} of $${env.budgetUsd - env.reserveUsd})` : "offline keyword fallback"}${c.reset}`,
  );
  if (!flag("--no-serve")) {
    if (await isOurServer(port)) console.log(`${c.dim}   using the server already running on :${port}${c.reset}`);
    else {
      try {
        await startServer(port);
        console.log(`${c.dim}   serving on http://localhost:${port}${c.reset}`);
      } catch (err) {
        console.error(`   could not start server on :${port}: ${(err as Error).message}. Try --port 5181.`);
        process.exit(1);
      }
    }
  }
  console.log();
  if (flag("--demo")) await makeLink("F1", WORDHUNT_F1); // Phase 0: hand-made F1 word hunt
  const make = flag("--legacy") ? (i: string) => makeLink(i) : makeGame;
  for (const i of interests) await make(i);

  if (!process.stdin.isTTY && interests.length) return process.exit(0);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = () =>
    rl.question(`${c.bold}What are you into?${c.reset} ${c.dim}(blank to quit)${c.reset} `, async (line) => {
      const t = line.trim();
      if (!t) {
        rl.close();
        return process.exit(0);
      }
      await make(t);
      ask();
    });
  ask();
}

main();

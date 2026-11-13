// Public demo: runs the Messenger app + Sidequest game server on this laptop and exposes them on one public
// https URL (a free Cloudflare quick tunnel) so judges can play from their phones.
//
//   npm run demo:public                build, start everything, print the QR code + links
//   npm run demo:public -- --no-build  reuse the last build (faster restarts)
//
// The app runs as a production build on :3030 (so it doesn't fight `npm run dev` on :3000) and proxies the game
// server, so phones only ever talk to one URL. Keep the laptop awake and online while the demo runs.
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
// @ts-expect-error no bundled types
import qrcode from "qrcode-terminal";

const APP_PORT = Number(process.env.DEMO_PORT) || 3030;
const SQ_PORT = Number(process.env.SIDEQUEST_PORT) || 5180;
const PLAYERS = ["nivan", "armaan", "vedansh", "keira", "abishek"]; // src/lib/demo.ts DEMO_IDS, numbered 1-5
const DIST = ".next-demo";
const c = { dim: "\x1b[2m", bold: "\x1b[1m", cyan: "\x1b[36m", green: "\x1b[32m", yellow: "\x1b[33m", red: "\x1b[31m", reset: "\x1b[0m" };
const env = { ...process.env, NEXT_PUBLIC_SIDEQUEST_URL: "same-origin", NEXT_DIST_DIR: DIST, SIDEQUEST_PORT: String(SQ_PORT) };

const children: ChildProcess[] = [];
const shutdown = (code = 0) => {
  for (const ch of children) ch.kill("SIGTERM");
  process.exit(code);
};
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

const die = (msg: string) => {
  console.error(`\n${c.red}✗ ${msg}${c.reset}\n`);
  shutdown(1);
};

function cloudflaredBin(): string {
  const local = join(homedir(), ".local", "bin", "cloudflared");
  if (existsSync(local)) return local;
  if (spawnSync("which", ["cloudflared"]).status === 0) return "cloudflared";
  return die(
    "cloudflared not found. Install it (Apple Silicon):\n  mkdir -p ~/.local/bin && curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64.tgz | tar xz -C ~/.local/bin",
  ) as never;
}

/** Runs a long-lived child, prefixing its output so the terminal stays readable. */
function run(name: string, cmd: string, args: string[], onLine?: (line: string) => void): ChildProcess {
  const ch = spawn(cmd, args, { env, stdio: ["ignore", "pipe", "pipe"] });
  children.push(ch);
  const pipe = (buf: Buffer) => {
    for (const line of buf.toString().split("\n")) {
      if (!line.trim()) continue;
      onLine?.(line);
      if (process.env.DEMO_VERBOSE || (/error|failed/i.test(line) && !/ INF /.test(line))) console.log(`${c.dim}[${name}]${c.reset} ${line}`);
    }
  };
  ch.stdout?.on("data", pipe);
  ch.stderr?.on("data", pipe);
  ch.on("exit", (code) => {
    if (code !== null && code !== 0) die(`${name} exited with code ${code}. Re-run with DEMO_VERBOSE=1 to see its output.`);
  });
  return ch;
}

/** Latest modification time of any file under these paths (to tell whether the last build is out of date). */
function newestMtime(paths: string[]): number {
  let newest = 0;
  const walk = (p: string) => {
    if (!existsSync(p)) return;
    const st = statSync(p);
    if (st.isDirectory()) for (const f of readdirSync(p)) walk(join(p, f));
    else newest = Math.max(newest, st.mtimeMs);
  };
  paths.forEach(walk);
  return newest;
}

async function waitFor(url: string, timeoutMs: number, ok: (r: Response) => boolean = (r) => r.ok): Promise<boolean> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      if (ok(await fetch(url, { signal: AbortSignal.timeout(4000) }))) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 700));
  }
  return false;
}

async function main() {
  console.log(`\n${c.bold}📱 Public demo${c.reset}\n`);
  if (Number(process.versions.node.split(".")[0]) < 22) die(`Node ${process.versions.node} is too old for the build (Tailwind needs Node 22). Run \`nvm use\` first.`);
  const cf = cloudflaredBin();

  // 1. Game server (reuse one that's already running).
  const sqUp = await waitFor(`http://127.0.0.1:${SQ_PORT}/api/health`, 500);
  if (sqUp) console.log(`${c.dim}• game server already running on :${SQ_PORT}${c.reset}`);
  else {
    console.log(`• starting game server on :${SQ_PORT}`);
    run("sidequest", "npx", ["tsx", "sidequest/cli.ts", "--port", String(SQ_PORT)]);
    if (!(await waitFor(`http://127.0.0.1:${SQ_PORT}/api/health`, 30_000))) die("game server didn't start");
  }

  // Fail fast if the app port is taken (before spending a minute on the build).
  const holder = spawnSync("lsof", ["-nP", `-iTCP:${APP_PORT}`, "-sTCP:LISTEN", "-t"]).stdout?.toString().trim();
  if (holder)
    die(`port ${APP_PORT} is already in use (pid ${holder.split("\n").join(", ")}), probably an earlier demo:public that's still running.\n  Stop it (Ctrl+C in its terminal, or: kill ${holder.split("\n").join(" ")}) or pick another port: DEMO_PORT=3031 npm run demo:public`);

  // 2. Production build of the app (into .next-demo so it never touches a running `npm run dev`).
  const built = existsSync(join(DIST, "BUILD_ID")) ? statSync(join(DIST, "BUILD_ID")).mtimeMs : 0;
  const stale = built > 0 && newestMtime(["src", "sidequest/shared", "next.config.ts"]) > built;
  if (process.argv.includes("--no-build") && stale) console.log(`${c.yellow}• code changed since the last build, rebuilding anyway${c.reset}`);
  if (!process.argv.includes("--no-build") || !built || stale) {
    console.log(`• building the app ${c.dim}(about a minute)${c.reset}`);
    const b = spawnSync("npx", ["next", "build", "--turbopack"], { env, stdio: process.env.DEMO_VERBOSE ? "inherit" : "pipe" });
    if (b.status !== 0) {
      if (!process.env.DEMO_VERBOSE) console.log(b.stdout?.toString().slice(-4000), b.stderr?.toString().slice(-4000));
      die("next build failed");
    }
  }

  // 3. App server.
  console.log(`• starting the app on :${APP_PORT}`);
  run("app", "npx", ["next", "start", "-p", String(APP_PORT)]);
  if (!(await waitFor(`http://127.0.0.1:${APP_PORT}/demo`, 60_000))) die(`app didn't start on :${APP_PORT} (port in use?)`);
  if (!(await waitFor(`http://127.0.0.1:${APP_PORT}/api/x/topics`, 5000))) die("app is up but can't reach the game server through the proxy");


  // 4. Tunnel.
  console.log("• opening the public tunnel");
  let publicUrl = "";
  run("tunnel", cf, ["tunnel", "--no-autoupdate", "--url", `http://localhost:${APP_PORT}`], (line) => {
    const m = line.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (m && !publicUrl) publicUrl = m[0];
  });
  const t0 = Date.now();
  while (!publicUrl && Date.now() - t0 < 30_000) await new Promise((r) => setTimeout(r, 300));
  if (!publicUrl) die("couldn't get a tunnel URL from cloudflared (re-run with DEMO_VERBOSE=1)");
  // The hostname takes a few seconds to resolve worldwide.
  if (!(await waitFor(`${publicUrl}/api/x/topics`, 60_000))) console.log(`${c.yellow}  tunnel isn't answering yet; give it a few more seconds${c.reset}`);

  // 5. Links.
  const demo = `${publicUrl}/demo`;
  console.log(`\n${c.green}${c.bold}✓ Live at ${publicUrl}${c.reset}\n`);
  console.log(`${c.bold}Judges: scan this, then each tap a different name${c.reset}`);
  qrcode.generate(demo, { small: true }, (q: string) => console.log(q));
  console.log(`  ${c.cyan}${demo}${c.reset}\n`);
  console.log(`${c.bold}Direct links${c.reset}`);
  PLAYERS.forEach((p, k) => console.log(`  ${k + 1}. ${p.padEnd(8)} ${c.cyan}${publicUrl}/profile/${p}?as=${p}${c.reset}`));
  console.log(`\n${c.bold}Reset chats to the starter data${c.reset}  ${c.cyan}${publicUrl}/admin${c.reset}`);
  console.log(`\n${c.dim}Muse posts the game when the first judge opens the group chat. Keep the game server running.`);
  console.log(`\n${c.bold}Second demo: the Austin "Sunday cookout" chat (Marketplace plan kits)${c.reset}`);
  console.log(`  judges pick a seat   ${c.cyan}${publicUrl}/demo/cookout${c.reset}`);
  console.log(`  you drop the game    ${c.cyan}${publicUrl}/admin${c.reset}  ${c.dim}(Muse pings every seat)${c.reset}`);
  console.log(`The URL changes every time this restarts. Ctrl+C to stop everything.${c.reset}\n`);
}

main().catch((e) => die((e as Error).message));

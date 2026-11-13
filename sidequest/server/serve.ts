// Tiny static + API server. Bundles the client with esbuild in memory (rebuilt on each page load, so edits
// show up on refresh). Routes: GET / (game page), GET /app.js, GET /api/health, POST /api/generate.
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { networkInterfaces } from "node:os";
import { join } from "node:path";
import * as esbuild from "esbuild";
import { generate } from "./generate";
import { createRoom, getRoom, sortedScores, submitScore, type ScoreRow } from "./rooms";

/** Never expose playerIds (they act as the write key); mark the caller's own row instead. */
const publicBoard = (rows: ScoreRow[], me: string | null) => rows.map((r) => ({ name: r.name, score: r.score, plays: r.plays, me: !!me && r.playerId === me }));

async function readJson(req: import("node:http").IncomingMessage, max = 64_000): Promise<Record<string, unknown>> {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > max) throw new Error("body too large");
  }
  try {
    const v = JSON.parse(body);
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

const CLIENT = join(__dirname, "..", "client");

export function lanAddress(): string | null {
  for (const list of Object.values(networkInterfaces())) for (const a of list ?? []) if (a.family === "IPv4" && !a.internal) return a.address;
  return null;
}

export async function isOurServer(port: number): Promise<boolean> {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(800) });
    return r.ok && (await r.json()).app === "sidequest";
  } catch {
    return false;
  }
}

export async function startServer(port: number): Promise<Server> {
  const ctx = await esbuild.context({
    entryPoints: [join(CLIENT, "src", "main.ts")],
    bundle: true,
    format: "iife",
    target: "es2020",
    write: false,
    sourcemap: "inline",
    logLevel: "silent",
  });
  let js = "";
  const build = async () => {
    try {
      const r = await ctx.rebuild();
      js = r.outputFiles?.[0]?.text ?? js;
    } catch (err) {
      const msg = (err as Error).message;
      console.error("\n[client build failed]\n" + msg);
      js = `document.body.innerHTML = ${JSON.stringify("<pre style='color:#fff;padding:16px;white-space:pre-wrap'>Client build failed:\n" + msg.replace(/</g, "&lt;") + "</pre>")}`;
    }
  };
  await build();

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    try {
      const json = (code: number, v: unknown) => {
        res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" });
        res.end(JSON.stringify(v));
      };
      const roomPath = url.pathname.match(/^\/api\/rooms\/([a-z0-9]{4,12})(\/scores)?$/);
      if (req.method === "POST" && url.pathname === "/api/rooms") {
        const body = await readJson(req);
        const room = createRoom(body.config);
        return json(200, { id: room.id });
      }
      if (roomPath && req.method === "GET" && !roomPath[2]) {
        const room = getRoom(roomPath[1]);
        if (!room) return json(404, { error: "room not found" });
        return json(200, { id: room.id, config: room.config, seed: room.seed, puzzle: room.puzzle, scores: publicBoard(sortedScores(room), url.searchParams.get("me")) });
      }
      if (roomPath && req.method === "POST" && roomPath[2]) {
        const body = await readJson(req, 2000);
        const rows = submitScore(roomPath[1], body);
        if (!rows) return json(404, { error: "room not found" });
        return json(200, { scores: publicBoard(rows, typeof body.playerId === "string" ? body.playerId : null) });
      }
      if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html" || /^\/g\/[a-z0-9]{4,12}$/.test(url.pathname))) {
        await build();
        res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
        return res.end(readFileSync(join(CLIENT, "index.html")));
      }
      if (req.method === "GET" && url.pathname === "/app.js") {
        res.writeHead(200, { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" });
        return res.end(js);
      }
      if (req.method === "GET" && url.pathname === "/api/health") {
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(JSON.stringify({ app: "sidequest" }));
      }
      if (req.method === "POST" && url.pathname === "/api/generate") {
        const interest = String((await readJson(req, 4000)).interest ?? "").slice(0, 60);
        if (!interest.trim()) {
          res.writeHead(400, { "content-type": "application/json" });
          return res.end(JSON.stringify({ error: "interest required" }));
        }
        const r = await generate(interest);
        const room = createRoom(r.config);
        console.log(`  [web] ${JSON.stringify(interest)} → ${r.config.template} "${r.config.title}" (${r.source}, ${r.ms}ms) room ${room.id}`);
        return json(200, { config: room.config, roomId: room.id, seed: room.seed, puzzle: room.puzzle });
      }
      res.writeHead(404).end("not found");
    } catch (err) {
      console.error(err);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    }
  });
  await new Promise<void>((ok, fail) => {
    server.once("error", fail);
    server.listen(port, "0.0.0.0", () => ok());
  });
  return server;
}

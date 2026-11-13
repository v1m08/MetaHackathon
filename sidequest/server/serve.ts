// Game server for the two chat games. Bundles each game's client with esbuild in memory (rebuilt on every
// page load, so edits show up on refresh).
//   Deep Cuts  (rarity trivia):  /x, /x/:id, /rarity.js,  /api/x/topics, /api/x/new, /api/x/:id[/open|/answer]
//   Order Up!  (restaurant):     /k/:id,     /kitchen.js, /api/k/topics, /api/k/new, /api/k/:id[/score]
//   Ghost Run  (lane race):      /r/:id,     /run.js,     /api/r/topics, /api/r/new, /api/r/:id[/score]
//   Sketch Off (draw + guess):   /s/:id,     /sketch.js,  /api/s/topics, /api/s/new, /api/s/:id[/turn|/draw|/open|/guess]
// The messenger app is another origin, so /api/* allows CORS.
import { existsSync, readFileSync } from "node:fs";
import { BG_DIR } from "./rarity/backdrop";
import { createServer, type IncomingMessage, type Server } from "node:http";
import { networkInterfaces } from "node:os";
import { join } from "node:path";
import * as esbuild from "esbuild";
import { createKRoom, generateMenu, getKRoom, kRoomView, readyKitchenTopics, submitKScore } from "./kitchen";
import { generatePack } from "./rarity/generate";
import { createRRoom, generateCourse, getRRoom, readyRunTopics, rRoomView, submitRun } from "./run";
import { createSRoom, generateSketch, getSRoom, myTurn, openGuess, readySketchTopics, sRoomView, submitDrawing, submitGuess } from "./sketch";
import { cachedPack, cachePack, createXRoom, getXRoom, openPrompt, readyTopics, roomView, submitAnswer } from "./rarity/rooms";

const CLIENT = join(__dirname, "..", "client");

async function readJson(req: IncomingMessage, max = 4000): Promise<Record<string, unknown>> {
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

/** An in-memory client bundle that rebuilds on demand; build errors show up in the page. */
async function bundle(entry: string) {
  const ctx = await esbuild.context({ entryPoints: [join(CLIENT, "src", entry)], bundle: true, format: "iife", target: "es2020", write: false, sourcemap: "inline", logLevel: "silent" });
  let js = "";
  const rebuild = async () => {
    try {
      js = (await ctx.rebuild()).outputFiles?.[0]?.text ?? js;
    } catch (err) {
      const msg = (err as Error).message;
      console.error(`\n[${entry} build failed]\n${msg}`);
      js = `document.body.innerHTML = ${JSON.stringify("<pre style='color:#fff;padding:16px;white-space:pre-wrap'>Client build failed:\n" + msg.replace(/</g, "&lt;") + "</pre>")}`;
    }
  };
  await rebuild();
  return { rebuild, get js() {
    return js;
  } };
}

export async function startServer(port: number): Promise<Server> {
  const deepCuts = await bundle("rarity/main.ts");
  const orderUp = await bundle("kitchen/main.ts");
  const ghostRun = await bundle("run/main.ts");
  const sketchOff = await bundle("sketch/main.ts");

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    const path = url.pathname;
    const json = (code: number, v: unknown) => {
      res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify(v));
    };
    const page = async (file: string, b: { rebuild: () => Promise<void> }) => {
      await b.rebuild();
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      res.end(readFileSync(join(CLIENT, file)));
    };
    const script = (js: string) => {
      res.writeHead(200, { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" });
      res.end(js);
    };
    try {
      if (path.startsWith("/api/")) {
        res.setHeader("access-control-allow-origin", "*");
        res.setHeader("access-control-allow-headers", "content-type");
        res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
        if (req.method === "OPTIONS") return void res.writeHead(204).end();
      }
      if (path === "/api/health") return json(200, { app: "sidequest" });
      if (req.method === "GET" && path === "/") return void res.writeHead(302, { location: "/x" }).end();

      // ---------- Deep Cuts ----------
      if (req.method === "GET" && (path === "/x" || /^\/x\/[a-z0-9]{4,12}$/.test(path))) return page("rarity.html", deepCuts);
      if (req.method === "GET" && path === "/rarity.js") return script(deepCuts.js);
      if (req.method === "GET" && /^\/bg\/[a-z0-9-]+\.png$/.test(path)) {
        const f = join(BG_DIR, path.slice(4));
        if (!existsSync(f)) return json(404, { error: "no backdrop" });
        res.writeHead(200, { "content-type": "image/png", "cache-control": "public, max-age=86400", "access-control-allow-origin": "*" });
        return void res.end(readFileSync(f));
      }
      if (req.method === "GET" && path === "/api/x/topics") return json(200, readyTopics());
      if (req.method === "POST" && path === "/api/x/new") {
        const body = await readJson(req);
        const interest = String(body.interest ?? "").slice(0, 60).trim();
        // optional: what the questions should touch, so a game feels made for one group (e.g. "Bay Area tech")
        const angles = Array.isArray(body.angles) ? body.angles.map((a) => String(a).slice(0, 60).trim()).filter(Boolean).slice(0, 3) : undefined;
        if (!interest) return json(400, { error: "topic required" });
        try {
          const cached = cachedPack(interest, angles);
          const pack = cached ?? (await generatePack(interest, undefined, angles)).pack;
          if (!cached) cachePack(pack, angles);
          const room = createXRoom(pack);
          console.log(`  [web] Deep Cuts ${JSON.stringify(interest)} → /x/${room.id}`);
          return json(200, { id: room.id });
        } catch (e) {
          return json(502, { error: `Couldn't build that one (${(e as Error).message}). Try again or another topic.` });
        }
      }
      const x = path.match(/^\/api\/x\/([a-z0-9]{4,12})(\/open|\/answer)?$/);
      if (x) {
        const room = getXRoom(x[1]);
        if (!room) return json(404, { error: "room not found" });
        if (req.method === "GET" && !x[2]) return json(200, roomView(room, url.searchParams.get("me")));
        if (req.method === "POST" && x[2]) {
          const b = await readJson(req);
          const i = Number(b.i);
          if (x[2] === "/open") return json(200, openPrompt(room, b.pid, b.name, i));
          return json(200, await submitAnswer(room, b.pid, b.name, i, b.text, b.giveUp === true));
        }
      }

      // ---------- Order Up! ----------
      if (req.method === "GET" && /^\/k\/[a-z0-9]{4,12}$/.test(path)) return page("kitchen.html", orderUp);
      if (req.method === "GET" && path === "/kitchen.js") return script(orderUp.js);
      if (req.method === "GET" && path === "/api/k/topics") return json(200, readyKitchenTopics());
      if (req.method === "POST" && path === "/api/k/new") {
        const interest = String((await readJson(req)).interest ?? "").slice(0, 60).trim();
        if (!interest) return json(400, { error: "topic required" });
        try {
          const room = createKRoom(await generateMenu(interest));
          console.log(`  [web] Order Up! ${JSON.stringify(interest)} → /k/${room.id}`);
          return json(200, { id: room.id });
        } catch (e) {
          return json(502, { error: `Couldn't open that restaurant (${(e as Error).message}). Try another topic.` });
        }
      }
      const k = path.match(/^\/api\/k\/([a-z0-9]{4,12})(\/score)?$/);
      if (k) {
        const room = getKRoom(k[1]);
        if (!room) return json(404, { error: "room not found" });
        if (req.method === "GET" && !k[2]) return json(200, kRoomView(room, url.searchParams.get("me")));
        if (req.method === "POST" && k[2]) return json(200, submitKScore(room, await readJson(req)));
      }

      // ---------- Ghost Run ----------
      if (req.method === "GET" && /^\/r\/[a-z0-9]{4,12}$/.test(path)) return page("run.html", ghostRun);
      if (req.method === "GET" && path === "/run.js") return script(ghostRun.js);
      if (req.method === "GET" && path === "/api/r/topics") return json(200, readyRunTopics());
      if (req.method === "POST" && path === "/api/r/new") {
        const interest = String((await readJson(req)).interest ?? "").slice(0, 60).trim();
        if (!interest) return json(400, { error: "topic required" });
        try {
          const room = createRRoom(await generateCourse(interest));
          console.log(`  [web] Ghost Run ${JSON.stringify(interest)} → /r/${room.id}`);
          return json(200, { id: room.id });
        } catch (e) {
          return json(502, { error: `Couldn't build that race (${(e as Error).message}). Try another topic.` });
        }
      }
      const rr = path.match(/^\/api\/r\/([a-z0-9]{4,12})(\/score)?$/);
      if (rr) {
        const room = getRRoom(rr[1]);
        if (!room) return json(404, { error: "room not found" });
        if (req.method === "GET" && !rr[2]) return json(200, rRoomView(room, url.searchParams.get("me")));
        if (req.method === "POST" && rr[2]) return json(200, submitRun(room, await readJson(req, 200_000)));
      }

      // ---------- Sketch Off ----------
      if (req.method === "GET" && /^\/s\/[a-z0-9]{4,12}$/.test(path)) return page("sketch.html", sketchOff);
      if (req.method === "GET" && path === "/sketch.js") return script(sketchOff.js);
      if (req.method === "GET" && path === "/api/s/topics") return json(200, readySketchTopics());
      if (req.method === "POST" && path === "/api/s/new") {
        const interest = String((await readJson(req)).interest ?? "").slice(0, 60).trim();
        if (!interest) return json(400, { error: "topic required" });
        try {
          const room = createSRoom(await generateSketch(interest));
          console.log(`  [web] Sketch Off ${JSON.stringify(interest)} → /s/${room.id}`);
          return json(200, { id: room.id });
        } catch (e) {
          return json(502, { error: `Couldn't pick words for that (${(e as Error).message}). Try another topic.` });
        }
      }
      const sr = path.match(/^\/api\/s\/([a-z0-9]{4,12})(\/turn|\/draw|\/open|\/guess)?$/);
      if (sr) {
        const room = getSRoom(sr[1]);
        if (!room) return json(404, { error: "room not found" });
        if (req.method === "GET" && !sr[2]) return json(200, sRoomView(room, url.searchParams.get("me")));
        if (req.method === "POST" && sr[2]) {
          const b = await readJson(req, 600_000);
          if (sr[2] === "/turn") return json(200, myTurn(room, b.pid, b.name));
          if (sr[2] === "/draw") return json(200, await submitDrawing(room, b));
          if (sr[2] === "/open") return json(200, openGuess(room, b.pid, b.name, b.drawing));
          return json(200, submitGuess(room, b));
        }
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

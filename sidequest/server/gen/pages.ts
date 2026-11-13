// HTML for generated games. /frame/:id is the untrusted game itself: served with a CSP that sandboxes it
// (opaque origin, scripts only, no network). /play/:id is our page that hosts it in a sandboxed iframe.
import { join } from "node:path";
import * as esbuild from "esbuild";
import type { GeneratedGame } from "./pipeline";

export const FRAME_CSP =
  "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data: blob:";

let kitJs = "";
export async function kitBundle(rebuild = false) {
  if (kitJs && !rebuild) return kitJs;
  const r = await esbuild.build({
    entryPoints: [join(__dirname, "..", "..", "kit", "frame.ts")],
    bundle: true,
    write: false,
    format: "iife",
    target: "es2020",
    minify: true,
    logLevel: "silent",
  });
  kitJs = r.outputFiles[0].text;
  return kitJs;
}

const safeJson = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function framePage(g: GeneratedGame): Promise<string> {
  const game = (await esbuild.transform(g.code, { loader: "js", format: "iife", globalName: "__GAMEMOD", target: "es2020" })).code.replace(/<\/script/gi, "<\\/script");
  const kit = await kitBundle(true);
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<link href="https://fonts.googleapis.com/css2?family=Rubik:wght@500;600;700;800&display=swap" rel="stylesheet">
<style>html,body{margin:0;height:100%;overflow:hidden;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}body{display:flex;align-items:center;justify-content:center}canvas{display:block;touch-action:none}</style>
<script>window.__SQ=${safeJson({ seed: g.seed, palette: g.design.palette, title: g.design.title })};</script>
<script>try{${game};window.__GAME=__GAMEMOD.default;}catch(e){window.__GAME_ERR=e;}</script>
<script>${kit.replace(/<\/script/gi, "<\\/script")}</script>
</head><body></body></html>`;
}

export function playPage(g: GeneratedGame): string {
  const d = g.design;
  const bg = typeof d.palette?.bg === "string" ? d.palette.bg : "#24324a";
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="theme-color" content="${esc(bg)}">
<title>${esc(String(d.title ?? "Sidequest"))}</title>
<link href="https://fonts.googleapis.com/css2?family=Rubik:wght@500;600;700;800&display=swap" rel="stylesheet">
<style>
  html,body{margin:0;height:100%;overflow:hidden;background:${esc(bg)};font-family:Rubik,system-ui,sans-serif;color:#fff}
  iframe{position:fixed;inset:0;width:100%;height:100%;border:0}
  .card{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.55);padding:16px}
  .card.show{display:flex}
  .box{width:100%;max-width:360px;background:#1f2430;border-radius:26px;padding:26px 22px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.4)}
  .box h1{margin:0;font-size:28px}.box .s{font-size:64px;font-weight:800;margin:6px 0}
  .box p{opacity:.8;margin:6px 0 16px}
  button{width:100%;font:600 19px Rubik,system-ui;border:0;border-radius:16px;padding:15px;cursor:pointer;background:#ffb020;color:#1d1d1d;box-shadow:0 4px 0 rgba(0,0,0,.3)}
</style></head><body>
<iframe id="g" sandbox="allow-scripts" allow="autoplay"></iframe>
<div class="card" id="c"><div class="box"><h1>${esc(String(d.title ?? ""))}</h1><div class="s" id="s">0</div><p>${esc(String(d.tagline ?? ""))}</p><button id="again">Play again</button></div></div>
<script>
  const f = document.getElementById("g"), c = document.getElementById("c");
  f.src = "/frame/${g.id}" + location.search;
  addEventListener("message", (e) => {
    if (e.source !== f.contentWindow) return;
    const m = e.data || {};
    if (m.type === "end") { document.getElementById("s").textContent = Number(m.score || 0).toLocaleString(); c.classList.add("show"); }
    if (m.type === "error") console.error("game error:", m.message);
  });
  document.getElementById("again").onclick = () => { c.classList.remove("show"); f.src = f.src; };
</script></body></html>`;
}

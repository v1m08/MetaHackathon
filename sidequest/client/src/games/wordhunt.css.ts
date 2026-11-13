// House style for word hunt. Pieces are always the same chunky keycaps; the theme changes the table.
const noise = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`;

export const WORDHUNT_CSS = `
.wh {
  --ink: #262a33;
  --cap: #fffdf8;
  --cap-2: #f1eadb;
  --cap-side: #c9bda4;
  --tray: color-mix(in srgb, var(--background) 62%, #000);
  --gap: clamp(6px, 2vw, 9px);
  position: fixed; inset: 0; overflow: hidden;
  display: flex; flex-direction: column; align-items: center;
  padding: max(14px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom));
  color: var(--text); font-family: "Rubik", system-ui, sans-serif;
  touch-action: none; -webkit-user-select: none; user-select: none;
}
.wh > * { position: relative; width: 100%; max-width: 440px; }
.wh .wh-table, .wh .wh-fx { position: absolute; inset: 0; max-width: none; pointer-events: none; }
.wh-fx { z-index: 30; width: 100%; height: 100%; }

/* ---------- table surfaces ---------- */
.wh-table {
  background:
    radial-gradient(120% 80% at 50% 45%, transparent 40%, rgba(0,0,0,.35) 100%),
    ${noise},
    var(--background);
  background-blend-mode: normal, soft-light, normal;
}
.wh[data-surface="pitlane"] .wh-table::before {
  /* painted pit-lane boundary lines */
  content: ""; position: absolute; inset: 0 14px;
  border-left: 5px solid rgba(255,255,255,.42); border-right: 5px solid rgba(255,255,255,.42);
  -webkit-mask: linear-gradient(transparent, #000 12%, #000 88%, transparent);
          mask: linear-gradient(transparent, #000 12%, #000 88%, transparent);
}
.wh[data-surface="pitlane"] .wh-table::after {
  /* faded chequered band behind the header */
  content: ""; position: absolute; left: 0; right: 0; top: 0; height: 120px;
  background: repeating-conic-gradient(rgba(255,255,255,.9) 0 25%, rgba(0,0,0,.9) 0 50%) 0 0 / 22px 22px;
  opacity: .1;
  -webkit-mask: linear-gradient(#000, transparent); mask: linear-gradient(#000, transparent);
}

/* ---------- header ---------- */
.wh-top { display: flex; justify-content: space-between; align-items: flex-end; padding-right: 54px; margin-top: 2px; z-index: 2; }
.wh-num, .wh-clock {
  font-family: var(--display), "Rubik", sans-serif; font-weight: 800; font-style: italic;
  font-variant-numeric: tabular-nums; line-height: .9; letter-spacing: -.01em;
}
.wh-score { display: flex; flex-direction: column; }
.wh-num { font-size: 46px; }
.wh-unit { font-size: 13px; font-weight: 600; opacity: .7; margin-top: 4px; }
.wh-clock { font-size: 42px; transition: color .2s; }
.wh-clock.urgent { color: var(--danger); }
.wh-clock.beat { animation: wh-beat .35s ease-out; }
@keyframes wh-beat { 30% { transform: scale(1.12); } }

.wh-theme { display: flex; align-items: center; gap: 10px; margin-top: 14px; z-index: 2; }
.wh-theme-label { font-size: 14px; font-weight: 600; opacity: .85; }
.wh-theme-dots { display: flex; gap: 5px; flex-wrap: wrap; }
.wh-theme-dots i {
  width: 14px; height: 14px; border-radius: 4px;
  background: rgba(255,255,255,.14); box-shadow: inset 0 1px 2px rgba(0,0,0,.35);
}
.wh-theme-dots i.got { background: var(--themed); box-shadow: 0 0 10px color-mix(in srgb, var(--themed) 70%, transparent); animation: wh-got .45s cubic-bezier(.3,1.8,.5,1); }
@keyframes wh-got { 0% { transform: scale(.3); } }

/* ---------- stage ---------- */
.wh-stage { flex: 1; display: flex; flex-direction: column; justify-content: center; min-height: 0; }
.wh-bubble {
  align-self: center; display: flex; align-items: baseline; gap: 10px;
  min-height: 52px; margin-bottom: 14px; padding: 8px 20px; border-radius: 16px;
  background: #e4e9f2; color: var(--ink);
  box-shadow: 0 4px 0 rgba(0,0,0,.25);
  opacity: 0; transform: translateY(6px) scale(.92);
  transition: opacity .12s, transform .16s cubic-bezier(.3,1.5,.5,1), background-color .1s;
}
.wh-bubble.show { opacity: 1; transform: none; }
.wh-bubble-word { font-family: var(--display), "Rubik", sans-serif; font-weight: 800; font-style: italic; font-size: 30px; letter-spacing: .02em; }
.wh-bubble-pts { font-weight: 700; font-size: 16px; opacity: .85; }
.wh-bubble[data-state="word"] { background: var(--word); color: var(--on-word); }
.wh-bubble[data-state="themed"] { background: var(--themed); color: var(--on-themed); }
.wh-bubble[data-state="repeat"] { background: var(--repeat); color: var(--ink); }
.wh-bubble.win { animation: wh-win .4s cubic-bezier(.3,1.7,.5,1); }
.wh-bubble.shake { animation: wh-shake .32s; }
.wh-bubble.fade { opacity: 0; }
@keyframes wh-win { 0% { transform: scale(.85); } 50% { transform: scale(1.08); } }
@keyframes wh-shake { 20% { transform: translateX(-9px); } 40% { transform: translateX(8px); } 60% { transform: translateX(-5px); } 80% { transform: translateX(3px); } }

.wh-tray {
  position: relative;
  padding: calc(var(--gap) + 3px); border-radius: 26px; background: var(--tray);
  box-shadow: inset 0 3px 10px rgba(0,0,0,.5), inset 0 -1px 0 rgba(255,255,255,.08), 0 1px 0 rgba(255,255,255,.1);
}
.wh-tray.bump { animation: wh-bump .25s ease-out; }
@keyframes wh-bump { 40% { transform: scale(.992); } }
.wh-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: var(--gap); touch-action: none; position: relative; z-index: 1; }

/* ---------- keycap tiles ---------- */
.wh-tile {
  position: relative; aspect-ratio: 1 / 1; border-radius: 24%;
  background: var(--cap-side);
  box-shadow: 0 7px 9px -5px rgba(0,0,0,.55);
}
.wh-face {
  position: absolute; inset: 0 0 6px 0; border-radius: inherit;
  display: grid; place-items: center;
  background: linear-gradient(180deg, var(--cap) 0%, var(--cap-2) 100%);
  box-shadow: inset 0 2px 0 rgba(255,255,255,.95), inset 0 -2px 0 rgba(110,90,60,.12);
  color: var(--ink); font-weight: 800; font-size: clamp(22px, 8.4vw, 40px); line-height: 1;
  transition: transform 60ms ease-out, background-color 80ms;
}
.wh-tile.on .wh-face { transform: translateY(4px); }
.wh-tile[data-state="building"] .wh-face { background: linear-gradient(180deg, #ffffff, #dfe5ef); }
.wh-tile[data-state="word"] { background: color-mix(in srgb, var(--word) 62%, #000); }
.wh-tile[data-state="word"] .wh-face { background: linear-gradient(180deg, color-mix(in srgb, var(--word) 75%, #fff), var(--word)); color: var(--on-word); }
.wh-tile[data-state="themed"] { background: color-mix(in srgb, var(--themed) 55%, #000); }
.wh-tile[data-state="themed"] .wh-face { background: linear-gradient(180deg, color-mix(in srgb, var(--themed) 70%, #fff), var(--themed)); color: var(--on-themed); }
.wh-tile[data-state="repeat"] { background: color-mix(in srgb, var(--repeat) 60%, #000); }
.wh-tile[data-state="repeat"] .wh-face { background: linear-gradient(180deg, color-mix(in srgb, var(--repeat) 70%, #fff), var(--repeat)); }
.wh-tile.pop .wh-face { animation: wh-pop .4s calc(var(--k) * 32ms) cubic-bezier(.3,1.7,.5,1) both; }
@keyframes wh-pop { 0% { transform: translateY(4px); } 45% { transform: translateY(-7px) scale(1.09); } 100% { transform: none; } }
.wh-tile.nope { animation: wh-nope .28s; }
@keyframes wh-nope { 25% { transform: translateX(-4px) rotate(-2deg); } 75% { transform: translateX(4px) rotate(2deg); } }

.wh-path { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 2; pointer-events: none; overflow: visible; }
.wh-path polyline { fill: none; stroke-width: 15; stroke-linecap: round; stroke-linejoin: round; stroke: #9aa6ba; opacity: .55; }
.wh-path[data-state="word"] polyline { stroke: color-mix(in srgb, var(--word) 70%, #000); }
.wh-path[data-state="themed"] polyline { stroke: color-mix(in srgb, var(--themed) 70%, #000); }
.wh-path[data-state="repeat"] polyline { stroke: color-mix(in srgb, var(--repeat) 60%, #000); }

/* ---------- deal in / round over ---------- */
.wh.deal .wh-tile { animation: wh-deal .44s var(--d) cubic-bezier(.25,1.5,.45,1) both; }
@keyframes wh-deal { from { transform: translateY(-46px) scale(.8); opacity: 0; } }
.wh:not(.live) .wh-grid { pointer-events: none; }
.wh.over .wh-tile { animation: wh-out .45s var(--d) ease-in both; }
@keyframes wh-out { to { transform: translateY(24px) scale(.9); opacity: 0; } }

/* ---------- start lights (pit lane only) ---------- */
.wh-lights { display: none; }
.wh[data-surface="pitlane"] .wh-lights {
  position: absolute; left: 50%; top: 50%; z-index: 5; display: flex; gap: 10px;
  padding: 12px 14px; border-radius: 16px; background: #15171c;
  box-shadow: 0 10px 30px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.08);
  transform: translate(-50%, -50%); transition: opacity .25s, transform .3s;
}
.wh-lights i { width: 28px; height: 28px; border-radius: 50%; background: #3a1414; box-shadow: inset 0 2px 4px rgba(0,0,0,.6); transition: background .05s, box-shadow .05s; }
.wh-lights i.on { background: radial-gradient(circle at 40% 35%, #ff8a80, #ff2a1a 55%, #b30d00); box-shadow: 0 0 18px #ff2a1a, 0 0 4px #ff6a5a; }
.wh.go .wh-lights { opacity: 0; transform: translate(-50%, -90%); pointer-events: none; }
.wh.go .wh-lights i { background: #3a1414; box-shadow: none; }

/* ---------- theme-word hint + found feed ---------- */
.wh-hint {
  min-height: 58px; margin-top: 14px; padding: 0 8px; font-size: 15px; line-height: 1.35; text-align: center; text-wrap: balance;
  opacity: 0; transform: translateY(-4px); transition: opacity .2s, transform .2s;
}
.wh-hint.show { opacity: 1; transform: none; }
.wh-hint b { display: block; color: var(--themed); font-family: var(--display), "Rubik", sans-serif; font-style: italic; font-size: 20px; font-weight: 800; letter-spacing: .02em; filter: brightness(1.3); }
.wh-feed { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; min-height: 34px; align-content: flex-start; margin-top: 4px; }
.wh-chip {
  display: inline-flex; align-items: baseline; gap: 6px; padding: 6px 10px; border-radius: 10px;
  background: rgba(255,255,255,.1); font-weight: 700; font-size: 14px; letter-spacing: .03em;
  animation: wh-chip .3s cubic-bezier(.3,1.6,.5,1);
}
.wh-chip small { font-weight: 600; opacity: .65; font-size: 12px; }
.wh-chip.themed { background: var(--themed); color: var(--on-themed); }
@keyframes wh-chip { from { transform: scale(.6); opacity: 0; } }

/* ---------- results ---------- */
.whr-stats { display: flex; justify-content: center; gap: 22px; margin: 2px 0 4px; }
.whr-stats div { display: flex; flex-direction: column; }
.whr-stats b { font-size: 22px; font-weight: 800; }
.whr-stats span { font-size: 13px; opacity: .7; }
.whr-themed { text-align: left; display: flex; flex-direction: column; gap: 6px; margin: 4px 0; padding: 0; }
.whr-themed li { list-style: none; display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; align-items: baseline; padding: 8px 12px; border-radius: 12px; background: color-mix(in srgb, var(--background) 55%, transparent); }
.whr-themed li b { font-weight: 800; letter-spacing: .03em; }
.whr-themed li.got b { color: var(--primary); filter: brightness(1.3); }
.whr-themed li:not(.got) b { opacity: .6; }
.whr-themed li span { font-size: 13px; opacity: .75; }
.whr-themed ul { margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.whr-missed { font-size: 14px; opacity: .8; margin: 2px 0 6px; }

@media (prefers-reduced-motion: reduce) {
  .wh *, .wh *::before { animation-duration: 1ms !important; animation-delay: 0s !important; transition-duration: 1ms !important; }
}
`;

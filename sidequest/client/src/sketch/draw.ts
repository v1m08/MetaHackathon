// Pixel drawing: strokes on a 96x96 grid, rendered crisp. Shared by the game and the chat thumbnail.
import { BRUSH, GRID, INK, type Stroke } from "../../../shared/sketch";

/** Plot a brush square at every grid cell along a line (Bresenham). */
function line(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, size: number) {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  const off = Math.floor(size / 2);
  for (;;) {
    g.fillRect(x0 - off, y0 - off, size, size);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

/** Draw strokes onto a GRID-sized context. `upTo` (0..1) draws only part, for the replay animation. */
export function renderStrokes(g: CanvasRenderingContext2D, strokes: Stroke[], upTo = 1, bg: string | null = null) {
  g.imageSmoothingEnabled = false;
  if (bg) {
    g.fillStyle = bg;
    g.fillRect(0, 0, GRID, GRID);
  } else g.clearRect(0, 0, GRID, GRID);
  const total = strokes.reduce((n, s) => n + Math.max(1, s[2].length / 2), 0);
  let budget = Math.ceil(total * upTo);
  for (const [ink, brush, pts] of strokes) {
    if (budget <= 0) break;
    g.fillStyle = INK[ink] ?? INK[0];
    const size = BRUSH[brush] ?? BRUSH[0];
    const n = pts.length / 2;
    if (n === 1) g.fillRect(pts[0] - Math.floor(size / 2), pts[1] - Math.floor(size / 2), size, size);
    for (let i = 1; i < n && budget > 0; i++, budget--) line(g, pts[i * 2 - 2], pts[i * 2 - 1], pts[i * 2], pts[i * 2 + 1], size);
    budget--;
  }
}

/** A fresh GRID x GRID canvas with the strokes on it. */
export function strokesCanvas(strokes: Stroke[], bg = "#fffdf8") {
  const c = document.createElement("canvas");
  c.width = c.height = GRID;
  renderStrokes(c.getContext("2d")!, strokes, 1, bg);
  return c;
}

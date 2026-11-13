// Emoji rendered once to offscreen canvases and cached by (emoji, size bucket).
export class Sprites {
  private cache = new Map<string, HTMLCanvasElement>();
  constructor(private dpr = 1) {}

  get(emoji: string, size: number): HTMLCanvasElement {
    const px = Math.max(8, Math.round((size * this.dpr) / 8) * 8);
    const key = emoji + "|" + px;
    let c = this.cache.get(key);
    if (!c) {
      c = document.createElement("canvas");
      c.width = c.height = Math.ceil(px * 1.3);
      const x = c.getContext("2d")!;
      x.textAlign = "center";
      x.textBaseline = "middle";
      x.font = `${px}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      x.fillText(emoji, c.width / 2, c.height / 2 + px * 0.06);
      this.cache.set(key, c);
    }
    return c;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    emoji: string,
    x: number,
    y: number,
    size: number,
    o: { rot?: number; sx?: number; sy?: number; alpha?: number; flip?: boolean } = {},
  ) {
    const img = this.get(emoji, size);
    const s = (size * 1.3) / 1;
    ctx.save();
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    ctx.scale((o.sx ?? 1) * (o.flip ? -1 : 1), o.sy ?? 1);
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    ctx.drawImage(img, -s / 2, -s / 2, s, s);
    ctx.restore();
  }
}

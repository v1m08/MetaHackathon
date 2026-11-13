// Unified pointer + keyboard input in logical (390x844) coordinates. Edge events (tap) and relative drag
// are consumed by the next fixed update step, so a tap is seen on the same frame it happens.
export class Input {
  x = 195;
  y = 600;
  down = false;
  /** Pointer went down since the last update step (or space/enter/up was pressed). */
  tapped = false;
  tapX = 0;
  tapY = 0;
  /** Accumulated horizontal drag since the last step, in logical px. */
  dragDX = 0;
  left = false;
  right = false;
  /** Number keys 1-4 pressed this step (0 = none). */
  numKey = 0;
  holdTime = 0;
  /** Last swipe this step: -1 left, 1 right, 0 none. */
  swipe = 0;
  private startX = 0;
  private startT = 0;
  private detach: (() => void) | null = null;

  attach(el: HTMLElement, toLogical: (cx: number, cy: number) => [number, number], onFirstTap: () => void) {
    const pos = (e: PointerEvent) => toLogical(e.clientX, e.clientY);
    const down = (e: PointerEvent) => {
      e.preventDefault();
      onFirstTap();
      const [x, y] = pos(e);
      this.x = x;
      this.y = y;
      this.down = true;
      this.tapped = true;
      this.tapX = x;
      this.tapY = y;
      this.startX = x;
      this.startT = performance.now();
      el.setPointerCapture?.(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      const [x, y] = pos(e);
      if (this.down) this.dragDX += x - this.x;
      this.x = x;
      this.y = y;
    };
    const up = (e: PointerEvent) => {
      if (!this.down) return;
      const [x] = pos(e);
      const dt = performance.now() - this.startT;
      if (dt < 300 && Math.abs(x - this.startX) > 50) this.swipe = Math.sign(x - this.startX);
      this.down = false;
    };
    const key = (e: KeyboardEvent, isDown: boolean) => {
      const k = e.key;
      if (k === "ArrowLeft" || k === "a") this.left = isDown;
      else if (k === "ArrowRight" || k === "d") this.right = isDown;
      else if (isDown && !e.repeat && (k === " " || k === "Enter" || k === "ArrowUp")) {
        onFirstTap();
        this.tapped = true;
        this.tapX = -1;
        this.tapY = -1;
      } else if (isDown && /^[1-4]$/.test(k)) this.numKey = Number(k);
      else return;
      e.preventDefault();
    };
    const kd = (e: KeyboardEvent) => key(e, true);
    const ku = (e: KeyboardEvent) => key(e, false);
    const block = (e: Event) => e.preventDefault();
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    el.addEventListener("touchmove", block, { passive: false });
    el.addEventListener("contextmenu", block);
    this.detach = () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      el.removeEventListener("touchmove", block);
      el.removeEventListener("contextmenu", block);
    };
  }

  /** -1..1 from arrow keys. */
  get axis() {
    return (this.right ? 1 : 0) - (this.left ? 1 : 0);
  }

  /** Called by the engine after each update step. */
  endStep(dt: number) {
    this.tapped = false;
    this.dragDX = 0;
    this.numKey = 0;
    this.swipe = 0;
    this.holdTime = this.down ? this.holdTime + dt : 0;
  }

  reset() {
    this.down = this.tapped = this.left = this.right = false;
    this.dragDX = 0;
    this.numKey = 0;
  }

  dispose() {
    this.detach?.();
  }
}

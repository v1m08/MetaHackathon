// Synthesized sound effects. No audio files. Safe to construct in Node (it just stays silent).
export type Sfx = "hit" | "miss" | "collect" | "combo" | "win" | "lose" | "tick" | "whoosh" | "start";

const MUTE_KEY = "sidequest.muted";

export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;

  constructor() {
    try {
      this.muted = typeof localStorage !== "undefined" && localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      /* storage blocked */
    }
  }

  /** Must be called from a user gesture (first tap). */
  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp).connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? "1" : "0");
    } catch {
      /* ignore */
    }
    return this.muted;
  }

  private tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; to?: number; delay?: number } = {}) {
    const c = this.ctx;
    if (!c || !this.master) return;
    const t = c.currentTime + (opts.delay ?? 0);
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = opts.type ?? "square";
    o.frequency.setValueAtTime(freq, t);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    const peak = opts.gain ?? 0.18;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, gain = 0.25, freq = 800, delay = 0) {
    const c = this.ctx;
    if (!c || !this.master) return;
    const t = c.currentTime + delay;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = c.createBufferSource();
    s.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.value = gain;
    s.connect(f).connect(g).connect(this.master);
    s.start(t);
  }

  // ---------- house kit: soft, musical, layered ----------

  /** A rounded mallet-like note: sine body + quiet octave, filtered. */
  private mallet(freq: number, opts: { delay?: number; gain?: number; dur?: number } = {}) {
    const c = this.ctx;
    if (!c || !this.master || this.muted) return;
    const t = c.currentTime + (opts.delay ?? 0);
    const dur = opts.dur ?? 0.35;
    const peak = opts.gain ?? 0.22;
    const out = c.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(peak, t + 0.006);
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(Math.min(9000, freq * 6), t);
    f.frequency.exponentialRampToValueAtTime(Math.max(400, freq * 1.5), t + dur);
    out.connect(f).connect(this.master);
    for (const [mult, g, type] of [[1, 1, "sine"], [2, 0.25, "triangle"], [3.01, 0.08, "sine"]] as const) {
      const o = c.createOscillator();
      const og = c.createGain();
      o.type = type;
      o.frequency.value = freq * mult;
      og.gain.value = g;
      o.connect(og).connect(out);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }

  /** Major pentatonic step from C5; each tile in a swipe climbs one step. */
  static penta(step: number) {
    const scale = [0, 2, 4, 7, 9];
    const oct = Math.floor(step / 5);
    return 523.25 * Math.pow(2, (scale[((step % 5) + 5) % 5] + 12 * oct) / 12);
  }

  /** One swipe step. */
  step(i: number) {
    this.mallet(Audio.penta(Math.min(i, 14)), { gain: 0.18, dur: 0.25 });
  }
  /** Backing out of a tile. */
  unstep(i: number) {
    this.mallet(Audio.penta(Math.max(0, i - 1)) / 2, { gain: 0.1, dur: 0.12 });
  }
  /** A found word: a quick rising run, longer words climb higher. Themed words get a bright top note. */
  word(len: number, special = false) {
    const n = Math.min(len, 8);
    for (let k = 0; k < n; k++) this.mallet(Audio.penta(k + 2), { delay: k * 0.035, gain: 0.16, dur: 0.3 });
    this.mallet(Audio.penta(n + 4), { delay: n * 0.035 + 0.03, gain: 0.22, dur: 0.6 });
    if (special) {
      this.mallet(Audio.penta(n + 7), { delay: n * 0.035 + 0.1, gain: 0.18, dur: 0.9 });
      this.mallet(Audio.penta(n + 9), { delay: n * 0.035 + 0.16, gain: 0.14, dur: 1.1 });
    }
  }
  /** Soft muted thud for "not a word". */
  thud() {
    this.mallet(140, { gain: 0.25, dur: 0.18 });
    this.noise(0.06, 0.08, 500);
  }
  /** Two quick same notes for "already found". */
  repeat() {
    this.mallet(Audio.penta(4), { gain: 0.14, dur: 0.12 });
    this.mallet(Audio.penta(4), { delay: 0.09, gain: 0.14, dur: 0.15 });
  }
  /** Tile landing on the tray. */
  clack(delay = 0) {
    this.noise(0.03, 0.12, 2400, delay);
    this.mallet(900 + Math.random() * 200, { delay, gain: 0.05, dur: 0.05 });
  }
  /** Start-light beep; `go` is the higher, longer one. */
  beep(go = false) {
    this.tone(go ? 1320 : 660, go ? 0.35 : 0.14, { type: "sine", gain: go ? 0.2 : 0.14 });
  }
  tick(urgent = false) {
    this.mallet(urgent ? 1760 : 1320, { gain: urgent ? 0.1 : 0.06, dur: 0.06 });
  }
  /** End of round. */
  finish() {
    [0, 4, 7, 12].forEach((s, k) => this.mallet(392 * Math.pow(2, s / 12), { delay: k * 0.09, gain: 0.2, dur: 0.8 }));
  }

  /** `level` lets combos climb in pitch. */
  play(s: Sfx, level = 0) {
    if (!this.ctx || this.muted) return;
    const up = Math.pow(2, Math.min(level, 12) / 12);
    switch (s) {
      case "collect":
        this.tone(660 * up, 0.07, { type: "square", gain: 0.12 });
        this.tone(990 * up, 0.1, { type: "square", gain: 0.1, delay: 0.05 });
        break;
      case "hit":
        this.tone(520 * up, 0.12, { type: "triangle", gain: 0.25, to: 1040 * up });
        this.noise(0.05, 0.12, 4000);
        break;
      case "miss":
        this.tone(180, 0.25, { type: "sawtooth", gain: 0.2, to: 60 });
        this.noise(0.22, 0.35, 900);
        break;
      case "combo":
        [0, 4, 7, 12].forEach((n, i) => this.tone(523 * up * Math.pow(2, n / 12), 0.09, { type: "square", gain: 0.1, delay: i * 0.05 }));
        break;
      case "win":
        [0, 4, 7, 12, 16].forEach((n, i) => this.tone(392 * Math.pow(2, n / 12), 0.18, { type: "triangle", gain: 0.22, delay: i * 0.09 }));
        break;
      case "lose":
        [7, 4, 0, -5].forEach((n, i) => this.tone(330 * Math.pow(2, n / 12), 0.22, { type: "triangle", gain: 0.2, delay: i * 0.13 }));
        break;
      case "tick":
        this.tone(1200, 0.03, { type: "square", gain: 0.06 });
        break;
      case "whoosh":
        this.noise(0.3, 0.2, 2500);
        break;
      case "start":
        this.tone(440, 0.12, { type: "square", gain: 0.12 });
        this.tone(880, 0.25, { type: "square", gain: 0.14, delay: 0.14 });
        break;
    }
  }
}

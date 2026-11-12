"use client";
// Friendship critters (and the plant theme) as layered SVG parts. Every part ID comes from lib/hangout/parts.
// States animate through CSS classes in globals.css (crit-awake, crit-napping…), which respect prefers-reduced-motion.
// Animated groups never carry a transform attribute (CSS animations would replace it).
import { colorById } from "@/lib/hangout/parts";
import type { CritterState } from "@/lib/hangout/types";
import { cx } from "@/components/ui";

export type Theme = "critters" | "plants";
export interface DesignLike {
  body: string;
  color: string;
  accessory: string;
  keepsakes?: string[];
}

const INK = "#2B2B33";
type Anchor = { cx: number; eyeY: number; eyeDx: number; top: number; w: number; mouthY: number; cheekDx: number; neckY: number; midY: number };
const ANCHOR: Record<string, Anchor> = {
  blob: { cx: 60, eyeY: 64, eyeDx: 13, top: 30, w: 80, mouthY: 75, cheekDx: 22, neckY: 88, midY: 93 },
  noodle: { cx: 60, eyeY: 44, eyeDx: 9, top: 14, w: 44, mouthY: 54, cheekDx: 15, neckY: 66, midY: 84 },
  bean: { cx: 62, eyeY: 60, eyeDx: 12, top: 27, w: 66, mouthY: 71, cheekDx: 21, neckY: 84, midY: 92 },
  puff: { cx: 60, eyeY: 64, eyeDx: 13, top: 34, w: 72, mouthY: 75, cheekDx: 22, neckY: 88, midY: 93 },
  pebble: { cx: 60, eyeY: 72, eyeDx: 15, top: 48, w: 92, mouthY: 83, cheekDx: 27, neckY: 95, midY: 92 },
};

const BODY_PATH: Record<string, string> = {
  blob: "M60 30 C88 30 100 52 100 74 C100 94 84 104 60 104 C36 104 20 94 20 74 C20 52 32 30 60 30 Z",
  noodle: "M60 14 C76 14 82 26 80 40 C78 52 84 60 82 74 C80 92 76 104 60 104 C44 104 40 92 38 74 C36 60 42 52 40 40 C38 26 44 14 60 14 Z",
  bean: "M46 32 C66 22 92 34 96 60 C100 86 84 104 62 104 C40 104 24 94 24 76 C24 64 34 60 36 50 C38 40 38 36 46 32 Z",
  puff: "M36 58 C30 46 40 34 52 38 C56 28 72 28 76 38 C88 34 98 46 92 58 C102 64 100 82 90 86 C92 100 76 106 66 100 C58 108 42 106 40 96 C26 98 20 82 28 74 C20 68 26 56 36 58 Z",
  pebble: "M60 48 C90 48 106 64 106 80 C106 96 88 104 60 104 C32 104 14 96 14 80 C14 64 30 48 60 48 Z",
};
const EGG = "M60 26 C80 26 92 56 92 76 C92 96 78 106 60 106 C42 106 28 96 28 76 C28 56 40 26 60 26 Z";

export const PIN_EMOJI: Record<string, string> = { chopsticks: "🥢", coffee: "☕", sneaker: "👟", wave: "🌊", leaf: "🍃", ticket: "🎟️", taco: "🌮", pancake: "🥞", music: "🎵", star: "⭐" };

type Face = "awake" | "sleepy" | "closed" | "happy";
const faceFor = (s: CritterState): Face => (s === "sleepy" ? "sleepy" : s === "napping" || s === "resting" ? "closed" : s === "celebrating" || s === "hatching" ? "happy" : "awake");

function Eyes({ face, x, y, dx, r = 4.4 }: { face: Face; x: number; y: number; dx: number; r?: number }) {
  const eye = (ex: number) => {
    if (face === "awake")
      return (
        <g key={ex}>
          <circle cx={ex} cy={y} r={r} fill={INK} />
          <circle cx={ex + r * 0.35} cy={y - r * 0.35} r={r * 0.32} fill="#fff" />
        </g>
      );
    if (face === "sleepy")
      return (
        <g key={ex}>
          <path d={`M${ex - r - 0.6} ${y - 0.5} h${2 * r + 1.2}`} stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
          <path d={`M${ex - r + 0.4} ${y} A${r - 0.4} ${r * 0.75} 0 0 0 ${ex + r - 0.4} ${y} Z`} fill={INK} />
        </g>
      );
    if (face === "happy") return <path key={ex} d={`M${ex - r - 0.6} ${y + 2} Q${ex} ${y - r - 1.4} ${ex + r + 0.6} ${y + 2}`} stroke={INK} strokeWidth={2.4} strokeLinecap="round" fill="none" />;
    return <path key={ex} d={`M${ex - r - 0.6} ${y} Q${ex} ${y + r} ${ex + r + 0.6} ${y}`} stroke={INK} strokeWidth={2.2} strokeLinecap="round" fill="none" />;
  };
  return <g className="crit-eyes">{[x - dx, x + dx].map(eye)}</g>;
}

function Mouth({ face, x, y, s = 1 }: { face: Face; x: number; y: number; s?: number }) {
  if (face === "happy")
    return (
      <g>
        <path d={`M${x - 6 * s} ${y} Q${x} ${y + 10 * s} ${x + 6 * s} ${y} Z`} fill={INK} />
        <ellipse cx={x} cy={y + 4.6 * s} rx={2.6 * s} ry={1.6 * s} fill="#FF7A8A" />
      </g>
    );
  if (face === "sleepy") return <path d={`M${x - 3 * s} ${y + 1} h${6 * s}`} stroke={INK} strokeWidth={2} strokeLinecap="round" />;
  if (face === "closed") return <circle cx={x} cy={y + 1.5} r={2.2 * s} stroke={INK} strokeWidth={1.8} fill="none" />;
  return <path d={`M${x - 5 * s} ${y} Q${x} ${y + 5 * s} ${x + 5 * s} ${y}`} stroke={INK} strokeWidth={2.2} strokeLinecap="round" fill="none" />;
}

function star(x: number, y: number, R: number, r = R * 0.45) {
  return Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 ? r : R;
    return `${(x + rad * Math.cos(a)).toFixed(1)},${(y + rad * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
}

function Accessory({ id, a }: { id: string; a: Anchor }) {
  const { cx: x, top: t, w, eyeY, eyeDx, neckY: n } = a;
  switch (id) {
    case "beanie":
      return (
        <g>
          <path d={`M${x - w * 0.36} ${t + 12} Q${x - w * 0.36} ${t - 14} ${x} ${t - 14} Q${x + w * 0.36} ${t - 14} ${x + w * 0.36} ${t + 12} Z`} fill="#E5484D" />
          <rect x={x - w * 0.4} y={t + 5} width={w * 0.8} height={9} rx={4.5} fill="#C93339" />
          <circle cx={x} cy={t - 16} r={5} fill="#fff" />
        </g>
      );
    case "party_hat":
      return (
        <g>
          <path d={`M${x - 11} ${t + 5} L${x} ${t - 24} L${x + 11} ${t + 5} Z`} fill="#7C5CFF" />
          <path d={`M${x - 7} ${t - 5} L${x + 7} ${t - 9} M${x - 4} ${t - 14} L${x + 4} ${t - 16}`} stroke="#FFD43B" strokeWidth={2.4} strokeLinecap="round" />
          <circle cx={x} cy={t - 25} r={3.6} fill="#FFD43B" />
        </g>
      );
    case "bow": {
      const bx = x + w * 0.26, by = t + 8;
      return (
        <g>
          <path d={`M${bx} ${by} L${bx - 11} ${by - 7} L${bx - 11} ${by + 7} Z M${bx} ${by} L${bx + 11} ${by - 7} L${bx + 11} ${by + 7} Z`} fill="#FF6B9A" stroke="#E2487A" strokeWidth={1} strokeLinejoin="round" />
          <circle cx={bx} cy={by} r={3.2} fill="#E2487A" />
        </g>
      );
    }
    case "headphones":
      return (
        <g>
          <path d={`M${x - w * 0.46} ${eyeY} Q${x - w * 0.46} ${t - 10} ${x} ${t - 10} Q${x + w * 0.46} ${t - 10} ${x + w * 0.46} ${eyeY}`} stroke="#333" strokeWidth={4} fill="none" strokeLinecap="round" />
          <rect x={x - w * 0.46 - 5} y={eyeY - 9} width={10} height={17} rx={4} fill="#FF6B6B" />
          <rect x={x + w * 0.46 - 5} y={eyeY - 9} width={10} height={17} rx={4} fill="#FF6B6B" />
        </g>
      );
    case "glasses":
      return (
        <g stroke={INK} strokeWidth={2} fill="rgba(255,255,255,.28)">
          <circle cx={x - eyeDx} cy={eyeY} r={7.5} />
          <circle cx={x + eyeDx} cy={eyeY} r={7.5} />
          <path d={`M${x - eyeDx + 7.5} ${eyeY} Q${x} ${eyeY - 3} ${x + eyeDx - 7.5} ${eyeY}`} fill="none" />
        </g>
      );
    case "flower": {
      const fx = x + w * 0.24, fy = t + 5;
      return (
        <g>
          {[0, 72, 144, 216, 288].map((deg) => (
            <circle key={deg} cx={fx + 5.2 * Math.cos((deg * Math.PI) / 180)} cy={fy + 5.2 * Math.sin((deg * Math.PI) / 180)} r={4.2} fill="#FF9AC8" />
          ))}
          <circle cx={fx} cy={fy} r={3.2} fill="#FFD43B" />
        </g>
      );
    }
    case "cap":
      return (
        <g>
          <path d={`M${x - w * 0.34} ${t + 10} Q${x - w * 0.34} ${t - 10} ${x} ${t - 10} Q${x + w * 0.34} ${t - 10} ${x + w * 0.34} ${t + 10} Z`} fill="#3B82F6" />
          <path d={`M${x + w * 0.18} ${t + 7} Q${x + w * 0.5} ${t + 4} ${x + w * 0.6} ${t + 11} L${x + w * 0.18} ${t + 13} Z`} fill="#2563EB" />
          <circle cx={x} cy={t - 10} r={2.2} fill="#2563EB" />
        </g>
      );
    case "scarf":
      return (
        <g>
          <path d={`M${x - w * 0.43} ${n - 5} Q${x} ${n + 6} ${x + w * 0.43} ${n - 5} L${x + w * 0.43} ${n + 4} Q${x} ${n + 15} ${x - w * 0.43} ${n + 4} Z`} fill="#E5484D" />
          <path d={`M${x - w * 0.3} ${n + 2} Q${x} ${n + 11} ${x + w * 0.3} ${n + 2}`} stroke="#fff" strokeWidth={1.6} strokeDasharray="3 3" fill="none" />
          <rect x={x + w * 0.1} y={n + 5} width={8} height={18} rx={3} fill="#C93339" transform={`rotate(-10 ${x + w * 0.1} ${n + 5})`} />
        </g>
      );
    case "feather": {
      const fx = x + w * 0.16, fy = t + 5;
      return (
        <g>
          <path d={`M${fx} ${fy} C${fx + 2} ${fy - 14} ${fx + 12} ${fy - 24} ${fx + 20} ${fy - 28} C${fx + 14} ${fy - 16} ${fx + 10} ${fy - 6} ${fx} ${fy} Z`} fill="#F7F7F7" stroke="#B8B8B8" strokeWidth={1.2} strokeLinejoin="round" />
          <path d={`M${fx + 1} ${fy - 1} Q${fx + 9} ${fy - 13} ${fx + 18} ${fy - 26}`} stroke="#B8B8B8" strokeWidth={1} fill="none" />
        </g>
      );
    }
    case "sprout":
      return (
        <g>
          <path d={`M${x} ${t + 2} Q${x - 1} ${t - 6} ${x} ${t - 11}`} stroke="#3E9B57" strokeWidth={2.4} fill="none" strokeLinecap="round" />
          <ellipse cx={x - 6} cy={t - 12} rx={6.5} ry={3.6} fill="#58B368" transform={`rotate(-25 ${x - 6} ${t - 12})`} />
          <ellipse cx={x + 6} cy={t - 13} rx={6.5} ry={3.6} fill="#58B368" transform={`rotate(25 ${x + 6} ${t - 13})`} />
        </g>
      );
    case "star_clip":
      return <polygon points={star(x - w * 0.26, t + 7, 7.5)} fill="#FFD43B" stroke="#F0AE00" strokeWidth={1.2} strokeLinejoin="round" />;
    case "bandana":
      return (
        <g>
          <rect x={x - w * 0.43} y={t + 6} width={w * 0.86} height={8} rx={4} fill="#FF6B6B" />
          <path d={`M${x - w * 0.43 + 3} ${t + 10} h${w * 0.86 - 6}`} stroke="#fff" strokeWidth={1.4} />
          <path d={`M${x + w * 0.43 - 2} ${t + 9} l9 -5 l-2 7 Z M${x + w * 0.43 - 2} ${t + 11} l8 6 l-8 0 Z`} fill="#E04F4F" />
        </g>
      );
    default:
      return null;
  }
}

function Pins({ ids, x, y, vertical }: { ids: string[]; x: number; y: number; vertical?: boolean }) {
  return (
    <g>
      {ids.slice(-3).map((id, i) => {
        const px = vertical ? x : x - i * 13;
        const py = vertical ? y - i * 13 : y;
        return (
          <g key={id}>
            <circle cx={px} cy={py} r={6.6} fill="#fff" stroke="rgba(0,0,0,.12)" />
            <text x={px} y={py + 3} fontSize={8} textAnchor="middle">{PIN_EMOJI[id] ?? "⭐"}</text>
          </g>
        );
      })}
    </g>
  );
}

function Zzz({ x, y }: { x: number; y: number }) {
  return (
    <g fill="#7A86A8" fontWeight={700} fontFamily="system-ui, sans-serif">
      <text className="crit-zzz" x={x} y={y} fontSize={10}>z</text>
      <text className="crit-zzz" x={x + 6} y={y - 6} fontSize={12}>z</text>
      <text className="crit-zzz" x={x + 13} y={y - 13} fontSize={14}>Z</text>
    </g>
  );
}

function Confetti({ petals }: { petals?: boolean }) {
  const bits = [[18, 22, "#FF6B9A"], [34, 10, "#FFD43B"], [52, 18, "#5BC0EB"], [74, 8, "#9BE3C4"], [92, 20, "#7C5CFF"], [104, 12, "#FF9E5E"], [26, 36, "#5BC0EB"], [96, 34, "#FF6B9A"]] as const;
  return (
    <g className="crit-confetti">
      {bits.map(([x, y, c], i) => (petals ? <ellipse key={i} cx={x} cy={y} rx={3} ry={1.8} fill="#FF9AC8" /> : <rect key={i} x={x} y={y} width={4} height={6} rx={1} fill={c} />))}
    </g>
  );
}

function CritterArt({ design, state, showKeepsakes }: { design: DesignLike; state: CritterState; showKeepsakes: boolean }) {
  const c = colorById(design.color);
  const a = ANCHOR[design.body] ?? ANCHOR.blob;
  const face = faceFor(state);
  if (state === "egg")
    return (
      <g className="crit-body">
        <path d={EGG} fill="#FFF6E5" stroke="#EAD9BC" strokeWidth={2} />
        <ellipse cx={48} cy={60} rx={6} ry={4.5} fill={c.fill} />
        <ellipse cx={70} cy={78} rx={7.5} ry={5} fill={c.fill} />
        <ellipse cx={52} cy={92} rx={5} ry={3.5} fill={c.fill} />
        <ellipse cx={74} cy={50} rx={3.5} ry={2.6} fill={c.fill} />
      </g>
    );
  return (
    <>
      <g className="crit-body">
        <path d={BODY_PATH[design.body] ?? BODY_PATH.blob} fill={c.fill} stroke={c.shade} strokeWidth={2} />
        {design.body === "noodle" && (
          <g stroke={c.shade} strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.8}>
            <path d="M44 72 Q50 68 56 72 T68 72 T78 71" />
            <path d="M43 84 Q49 80 55 84 T67 84 T77 83" />
            <path d="M46 95 Q52 91 58 95 T70 95" />
          </g>
        )}
        <ellipse cx={a.cx - a.cheekDx} cy={a.eyeY + 8} rx={design.body === "noodle" ? 3.6 : 5} ry={3} fill={c.cheek} opacity={0.55} />
        <ellipse cx={a.cx + a.cheekDx} cy={a.eyeY + 8} rx={design.body === "noodle" ? 3.6 : 5} ry={3} fill={c.cheek} opacity={0.55} />
        <Eyes face={face} x={a.cx} y={a.eyeY} dx={a.eyeDx} />
        <Mouth face={face} x={a.cx} y={a.mouthY} />
        <Accessory id={design.accessory} a={a} />
        {showKeepsakes && !!design.keepsakes?.length && <Pins ids={design.keepsakes} x={a.cx + a.w * 0.22} y={a.midY} />}
      </g>
      {state === "hatching" && <path className="crit-shell" d="M28 86 L36 79 L44 87 L52 79 L60 87 L68 79 L76 87 L84 79 L92 86 C92 101 79 110 60 110 C41 110 28 101 28 86 Z" fill="#FFF6E5" stroke="#EAD9BC" strokeWidth={2} />}
    </>
  );
}

const LEAF: Record<string, string> = { awake: "#4DB86A", celebrating: "#4DB86A", hatching: "#7CCB7F", resting: "#6FBF80", sleepy: "#B9C25B", napping: "#A9A189", egg: "#7CCB7F" };

function Foliage({ body, leaf, dark, bloom, flower }: { body: string; leaf: string; dark: string; bloom: boolean; flower: string }) {
  const Bloom = ({ x, y, r = 4 }: { x: number; y: number; r?: number }) =>
    bloom ? (
      <g>
        {[0, 72, 144, 216, 288].map((d) => (
          <circle key={d} cx={x + r * 1.2 * Math.cos((d * Math.PI) / 180)} cy={y + r * 1.2 * Math.sin((d * Math.PI) / 180)} r={r} fill={flower} />
        ))}
        <circle cx={x} cy={y} r={r * 0.75} fill="#FFD43B" />
      </g>
    ) : null;
  switch (body) {
    case "noodle": // trailing vine
      return (
        <g>
          <g stroke={dark} strokeWidth={2.2} fill="none" strokeLinecap="round">
            <path d="M60 78 C50 68 34 70 28 94" />
            <path d="M60 78 C70 66 88 68 93 94" />
            <path d="M60 78 C57 64 63 52 60 38" />
          </g>
          {[[40, 72], [30, 86], [80, 70], [91, 86], [59, 62], [61, 46], [59, 36]].map(([x, y], i) => (
            <ellipse key={i} cx={x} cy={y} rx={6} ry={4.4} fill={leaf} stroke={dark} strokeWidth={1} transform={`rotate(${i % 2 ? 30 : -30} ${x} ${y})`} />
          ))}
          <Bloom x={60} y={33} />
          <Bloom x={30} y={92} r={3} />
        </g>
      );
    case "bean": // cactus
      return (
        <g fill={leaf} stroke={dark} strokeWidth={1.6}>
          <rect x={37} y={48} width={9} height={20} rx={4.5} />
          <rect x={39} y={62} width={14} height={7} rx={3.5} />
          <rect x={75} y={40} width={9} height={20} rx={4.5} />
          <rect x={68} y={54} width={14} height={7} rx={3.5} />
          <rect x={49} y={34} width={22} height={46} rx={11} />
          <g fill={dark} stroke="none">
            {[[56, 44], [64, 52], [56, 60], [64, 68], [41, 54], [79, 46]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={0.9} />)}
          </g>
          <Bloom x={60} y={32} />
        </g>
      );
    case "puff": // fern
      return (
        <g>
          {[-66, -44, -22, 0, 22, 44, 66].map((d) => (
            <ellipse key={d} cx={60} cy={56} rx={4.6} ry={22} fill={leaf} stroke={dark} strokeWidth={1} transform={`rotate(${d} 60 78)`} />
          ))}
          <Bloom x={60} y={34} r={3.4} />
        </g>
      );
    case "pebble": // tulip
      return (
        <g>
          <path d="M60 78 Q57 62 60 46" stroke={dark} strokeWidth={3} fill="none" strokeLinecap="round" />
          <ellipse cx={51} cy={66} rx={5} ry={13} fill={leaf} stroke={dark} strokeWidth={1} transform="rotate(-24 51 66)" />
          <ellipse cx={69} cy={66} rx={5} ry={13} fill={leaf} stroke={dark} strokeWidth={1} transform="rotate(24 69 66)" />
          {bloom ? (
            <path d="M46 34 Q46 52 60 52 Q74 52 74 34 L67 41 L60 28 L53 41 Z" fill={flower} stroke="rgba(0,0,0,.12)" />
          ) : (
            <path d="M52 40 Q52 52 60 52 Q68 52 68 40 L64 44 L60 34 L56 44 Z" fill={flower} opacity={0.85} stroke="rgba(0,0,0,.12)" />
          )}
        </g>
      );
    default: // succulent
      return (
        <g>
          {[-64, -32, 0, 32, 64].map((d) => (
            <ellipse key={d} cx={60} cy={60} rx={8} ry={17} fill={leaf} stroke={dark} strokeWidth={1.2} transform={`rotate(${d} 60 78)`} />
          ))}
          {[-24, 24].map((d) => (
            <ellipse key={d} cx={60} cy={66} rx={6} ry={11} fill={leaf} stroke={dark} strokeWidth={1} transform={`rotate(${d} 60 78)`} opacity={0.95} />
          ))}
          <Bloom x={60} y={44} />
        </g>
      );
  }
}

function PlantArt({ design, state, showKeepsakes }: { design: DesignLike; state: CritterState; showKeepsakes: boolean }) {
  const c = colorById(design.color);
  const face = faceFor(state);
  const leaf = LEAF[state] ?? LEAF.awake;
  const dark = state === "napping" ? "#8A846C" : state === "sleepy" ? "#98A043" : "#2F8A4A";
  // Thirsty plants droop, dormant ones shrink. Static transforms live on an outer group, never the animated one.
  const pose = state === "sleepy" ? "rotate(7 60 78) translate(0 3)" : state === "napping" ? "translate(60 78) scale(.78) translate(-60 -78)" : undefined;
  return (
    <>
      {state === "egg" ? (
        <g className="crit-body">
          <ellipse cx={60} cy={76} rx={11} ry={6} fill="#7A5A41" />
          <ellipse cx={60} cy={72} rx={4.5} ry={6} fill="#C9A26B" stroke="#9C7A4C" transform="rotate(20 60 72)" />
        </g>
      ) : state === "hatching" ? (
        <g className="crit-body">
          <path d="M60 79 Q59 70 60 62" stroke="#3E9B57" strokeWidth={2.6} fill="none" strokeLinecap="round" />
          <ellipse cx={53} cy={61} rx={7.5} ry={4} fill="#7CCB7F" transform="rotate(-25 53 61)" />
          <ellipse cx={67} cy={60} rx={7.5} ry={4} fill="#7CCB7F" transform="rotate(25 67 60)" />
        </g>
      ) : (
        <g transform={pose}>
          <g className="crit-body">
            <Foliage body={design.body} leaf={leaf} dark={dark} bloom={state === "celebrating"} flower={c.cheek} />
          </g>
        </g>
      )}
      <ellipse cx={60} cy={80} rx={23} ry={3.6} fill="#6B4F3A" />
      <path d="M36 82 L84 82 L79 106 Q60 110 41 106 Z" fill={c.fill} stroke={c.shade} strokeWidth={1.6} />
      <rect x={33} y={77} width={54} height={9} rx={4} fill={c.shade} />
      {state !== "egg" && (
        <>
          <Eyes face={face} x={60} y={92} dx={8} r={3} />
          <Mouth face={face} x={60} y={98} s={0.7} />
        </>
      )}
      {showKeepsakes && !!design.keepsakes?.length && <Pins ids={design.keepsakes} x={88} y={100} vertical />}
    </>
  );
}

export function Critter({ design, state, theme = "critters", size = 96, showKeepsakes = true, className, label }: { design: DesignLike; state: CritterState; theme?: Theme; size?: number; showKeepsakes?: boolean; className?: string; label?: string }) {
  const plants = theme === "plants";
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className={cx("crit overflow-visible", `crit-${state}`, className)} role="img" aria-label={label}>
      <ellipse cx={60} cy={110} rx={state === "egg" ? 24 : 32} ry={5} fill="rgba(60,40,20,.12)" />
      {plants ? <PlantArt design={design} state={state} showKeepsakes={showKeepsakes} /> : <CritterArt design={design} state={state} showKeepsakes={showKeepsakes} />}
      {(state === "napping" || (state === "resting" && !plants)) && <Zzz x={plants ? 82 : 86} y={plants ? 50 : 34} />}
      {state === "celebrating" && <Confetti petals={plants} />}
    </svg>
  );
}

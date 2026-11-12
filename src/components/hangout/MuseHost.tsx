"use client";
// Placeholder host sprite for the Hangout. Deliberately generic, NOT Meta's official Muse avatar.
// Swap in official assets here if the hackathon provides them.
export function MuseHost({ size = 64 }: { size?: number }) {
  return (
    <svg viewBox="0 0 80 80" width={size} height={size} className="crit crit-awake overflow-visible" role="img" aria-label="Muse (placeholder host)">
      <defs>
        <radialGradient id="muse-glow" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#FFF4C7" />
          <stop offset="100%" stopColor="#FFC94D" />
        </radialGradient>
      </defs>
      <ellipse cx={40} cy={74} rx={18} ry={3.5} fill="rgba(60,40,20,.12)" />
      <g className="crit-body">
        <path d="M40 8 L48 26 L68 28 L53 41 L58 62 L40 51 L22 62 L27 41 L12 28 L32 26 Z" fill="url(#muse-glow)" stroke="#F0A92B" strokeWidth={2.5} strokeLinejoin="round" />
        <g className="crit-eyes">
          <circle cx={34} cy={36} r={3} fill="#2B2B33" />
          <circle cx={46} cy={36} r={3} fill="#2B2B33" />
        </g>
        <path d="M35 43 Q40 47 45 43" stroke="#2B2B33" strokeWidth={2} strokeLinecap="round" fill="none" />
        <ellipse cx={29} cy={42} rx={3} ry={1.8} fill="#FF9A7A" opacity={0.6} />
        <ellipse cx={51} cy={42} rx={3} ry={1.8} fill="#FF9A7A" opacity={0.6} />
      </g>
    </svg>
  );
}

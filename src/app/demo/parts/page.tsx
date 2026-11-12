"use client";
// Critter showcase: every friend's Muse-drawn moods (what the Hangout shows for each state), then the SVG
// parts library the app falls back to when a friend has no art yet.
import { Critter, PIN_EMOJI } from "@/components/hangout/Critter";
import { MuseHost } from "@/components/hangout/MuseHost";
import { useApi } from "@/lib/api";
import { ACCESSORIES, BODIES, COLORS, CRITTER_STATE_LABEL, KEEPSAKES } from "@/lib/hangout/parts";
import type { CritterState } from "@/lib/hangout/types";
import type { HangoutView } from "@/server/hangout/views";

const STATES: CritterState[] = ["awake", "sleepy", "napping", "celebrating", "egg", "hatching", "resting"];
const MOODS = [
  { mood: "awake", label: "Awake", when: "You've been in touch" },
  { mood: "sleepy", label: "Sleepy", when: "Drifting past your usual rhythm" },
  { mood: "napping", label: "Napping", when: "It's been a long while" },
  { mood: "celebrating", label: "Celebrating", when: "3 days after you meet up" },
] as const;
type Gallery = { friends: { id: string; first: string; caption?: string; base: string; moods: Record<(typeof MOODS)[number]["mood"], string | null> }[] };

export default function PartsPage() {
  const { data } = useApi<Gallery>("/api/hangout/art");
  const { data: h } = useApi<HangoutView>("/api/hangout");
  return (
    <div className="min-h-dvh bg-[#FFF8EE] p-6 text-ink">
      <div className="flex items-center gap-3">
        <MuseHost size={56} image={h?.host.image} />
        <div>
          <h1 className="text-[22px] font-bold">Critter showcase</h1>
          <p className="text-[14px] text-ink-2">Each friendship&apos;s animal is picked by Muse Wonder from what you share, then drawn by Muse Image in every mood.</p>
        </div>
      </div>

      <h2 className="mt-6 mb-2 font-bold">Moods, drawn by Muse</h2>
      <div className="overflow-x-auto">
        <div className="grid min-w-[760px] gap-2" style={{ gridTemplateColumns: `150px repeat(${MOODS.length}, 1fr)` }}>
          <span />
          {MOODS.map((m) => (
            <span key={m.mood} className="text-center">
              <span className="block text-[13px] font-semibold">{m.label}</span>
              <span className="block text-[11px] text-ink-2">{m.when}</span>
            </span>
          ))}
          {data?.friends.map((f) => (
            <div key={f.id} className="contents">
              <span className="self-center">
                <span className="block text-[14px] font-semibold">{f.first}</span>
                {f.caption && <span className="block text-[11px] leading-snug text-ink-2">{f.caption}</span>}
              </span>
              {MOODS.map(({ mood }) => (
                <div key={mood} className="flex justify-center rounded-xl bg-white py-2">
                  {f.moods[mood] ? (
                    <Critter state={mood} design={{ body: "blob", color: "sky", accessory: "none", image: f.moods[mood]!, imageOwn: true }} size={120} label={`${f.first}, ${mood}`} />
                  ) : (
                    <div className="flex h-[120px] flex-col items-center justify-center text-center text-[11px] text-ink-2">
                      <Critter state={mood} design={{ body: "blob", color: "sky", accessory: "none", image: f.base }} size={84} />
                      not drawn yet
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      {data && !data.friends.length && <p className="text-[14px] text-ink-2">No Muse art yet. Run npm run critters:generate -- --style soft, then npm run critters:moods.</p>}

      <h2 className="mt-8 mb-2 font-bold">Fallback: SVG parts library</h2>
      <div className="grid gap-2" style={{ gridTemplateColumns: `120px repeat(${STATES.length}, 1fr)` }}>
        <span />
        {STATES.map((s) => <span key={s} className="text-center text-[13px] font-semibold text-ink-2">{CRITTER_STATE_LABEL[s]}</span>)}
        {BODIES.map((b, i) => (
          <div key={b.id} className="contents">
            <span className="self-center text-[13px] font-semibold">{b.label}</span>
            {STATES.map((s) => (
              <div key={s} className="flex justify-center rounded-xl bg-white py-2">
                <Critter state={s} design={{ body: b.id, color: COLORS[i % COLORS.length].id, accessory: ACCESSORIES[(i * 2 + 1) % ACCESSORIES.length].id, keepsakes: i === 0 ? ["chopsticks", "coffee"] : [] }} size={92} />
              </div>
            ))}
          </div>
        ))}
      </div>

      <h2 className="mt-6 mb-2 font-bold">Accessories</h2>
      <div className="flex flex-wrap gap-2">
        {ACCESSORIES.map((a, i) => (
          <div key={a.id} className="flex w-[104px] flex-col items-center rounded-xl bg-white py-2">
            <Critter state="awake" design={{ body: BODIES[i % BODIES.length].id, color: COLORS[i % COLORS.length].id, accessory: a.id }} size={84} />
            <span className="text-[12px] text-ink-2">{a.label}</span>
          </div>
        ))}
      </div>

      <h2 className="mt-6 mb-2 font-bold">Colors · keepsake pins</h2>
      <div className="flex flex-wrap gap-2">
        {COLORS.map((c) => <span key={c.id} className="rounded-full px-3 py-1 text-[13px] font-semibold" style={{ background: c.fill, border: `2px solid ${c.shade}` }}>{c.label}</span>)}
        {KEEPSAKES.map((k) => <span key={k.id} className="rounded-full bg-white px-3 py-1 text-[13px]">{PIN_EMOJI[k.id]} {k.label}</span>)}
      </div>
    </div>
  );
}

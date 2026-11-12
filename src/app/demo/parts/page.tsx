"use client";
// Critter library preview: every body, color, accessory, keepsake and state, in both themes.
import { useEffect, useState } from "react";
import { Critter, PIN_EMOJI, type Theme } from "@/components/hangout/Critter";
import { MuseHost } from "@/components/hangout/MuseHost";
import { ACCESSORIES, BODIES, COLORS, CRITTER_STATE_LABEL, KEEPSAKES, PLANT_STATE_LABEL } from "@/lib/hangout/parts";
import type { CritterState } from "@/lib/hangout/types";

const STATES: CritterState[] = ["awake", "sleepy", "napping", "celebrating", "egg", "hatching", "resting"];

export default function PartsPage() {
  const [theme, setTheme] = useState<Theme>("critters");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("theme") === "plants") setTheme("plants");
  }, []);
  const label = theme === "plants" ? PLANT_STATE_LABEL : CRITTER_STATE_LABEL;
  return (
    <div className="min-h-dvh bg-[#FFF8EE] p-6 text-ink">
      <div className="flex items-center gap-3">
        <MuseHost size={48} />
        <h1 className="text-[22px] font-bold">Critter library</h1>
        <div className="ml-auto flex rounded-full bg-white p-1 shadow-sm">
          {(["critters", "plants"] as const).map((t) => (
            <button key={t} onClick={() => setTheme(t)} className={`rounded-full px-4 py-1.5 text-[14px] font-semibold capitalize ${theme === t ? "bg-fb text-white" : "text-ink-2"}`}>{t}</button>
          ))}
        </div>
      </div>

      <h2 className="mt-6 mb-2 font-bold">States × bodies</h2>
      <div className="grid gap-2" style={{ gridTemplateColumns: `120px repeat(${STATES.length}, 1fr)` }}>
        <span />
        {STATES.map((s) => <span key={s} className="text-center text-[13px] font-semibold text-ink-2">{label[s]}</span>)}
        {BODIES.map((b, i) => (
          <div key={b.id} className="contents">
            <span className="self-center text-[13px] font-semibold">{b.label}</span>
            {STATES.map((s) => (
              <div key={s} className="flex justify-center rounded-xl bg-white py-2">
                <Critter theme={theme} state={s} design={{ body: b.id, color: COLORS[i % COLORS.length].id, accessory: ACCESSORIES[(i * 2 + 1) % ACCESSORIES.length].id, keepsakes: i === 0 ? ["chopsticks", "coffee"] : [] }} size={92} />
              </div>
            ))}
          </div>
        ))}
      </div>

      <h2 className="mt-6 mb-2 font-bold">Accessories</h2>
      <div className="flex flex-wrap gap-2">
        {ACCESSORIES.map((a, i) => (
          <div key={a.id} className="flex w-[104px] flex-col items-center rounded-xl bg-white py-2">
            <Critter theme="critters" state="awake" design={{ body: BODIES[i % BODIES.length].id, color: COLORS[i % COLORS.length].id, accessory: a.id }} size={84} />
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

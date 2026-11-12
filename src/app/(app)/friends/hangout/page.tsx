"use client";
// Friends tab > Hangout: one critter per close friend, hosted by Muse. Only the user sees this.
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ChevronRight, Leaf, Lock, PawPrint, Users } from "lucide-react";
import { Critter, type Theme } from "@/components/hangout/Critter";
import { HangPage, STATE_CHIP } from "@/components/hangout/HangPage";
import { MuseHost } from "@/components/hangout/MuseHost";
import { NudgeSheet } from "@/components/hangout/NudgeSheet";
import { SeeAgainSheet } from "@/components/hangout/SeeAgainSheet";
import { cx } from "@/components/ui";
import { api, useApi } from "@/lib/api";
import { CRITTER_STATE_LABEL, PLANT_STATE_LABEL } from "@/lib/hangout/parts";
import type { CritterCard, HangoutView } from "@/server/hangout/views";

export default function HangoutPage() {
  return (
    <Suspense>
      <Hangout />
    </Suspense>
  );
}

function Tile({ c, theme }: { c: CritterCard; theme: Theme }) {
  const label = theme === "plants" ? PLANT_STATE_LABEL : CRITTER_STATE_LABEL;
  return (
    <Link href={`/friends/hangout/${c.friendId}`} className="flex flex-col items-center rounded-2xl py-1 active:scale-[.97]">
      <Critter design={c.design} state={c.state} theme={theme} size={94} label={`${c.first}'s ${theme === "plants" ? "plant" : "critter"}: ${label[c.state]}`} />
      <span className="-mt-1 text-[14px] font-semibold">{c.first}</span>
      <span className={cx("mt-0.5 rounded-full px-2 py-[1px] text-[11px] font-semibold", STATE_CHIP[c.state])}>{label[c.state]}</span>
    </Link>
  );
}

function Hammock({ friends, theme }: { friends: CritterCard[]; theme: Theme }) {
  return (
    <div className="relative h-[112px] w-[176px]">
      <svg viewBox="0 0 176 112" className="absolute inset-0" aria-hidden>
        <rect x={6} y={14} width={7} height={92} rx={3} fill="#A47148" />
        <rect x={163} y={14} width={7} height={92} rx={3} fill="#A47148" />
        <path d="M13 24 L30 34 M163 24 L146 34" stroke="#C8A27A" strokeWidth={2} />
        <path d="M30 34 Q88 92 146 34" stroke="#5BC0EB" strokeWidth={14} fill="none" strokeLinecap="round" />
        <path d="M30 34 Q88 92 146 34" stroke="#fff" strokeWidth={4} fill="none" strokeDasharray="8 8" opacity={0.7} />
      </svg>
      <div className="absolute inset-x-0 top-[6px] flex justify-center gap-0">
        {friends.map((c) => (
          <Link key={c.friendId} href={`/friends/hangout/${c.friendId}`} className="flex flex-col items-center">
            <Critter design={c.design} state="resting" theme={theme} size={62} label={`${c.first} is resting`} />
          </Link>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 text-center text-[11px] font-semibold text-[#7A5A41]">
        {friends.length ? `Resting: ${friends.map((c) => c.first).join(", ")}` : "Hammock · resting friends nap here"}
      </div>
    </div>
  );
}

function Nest({ eggs, theme }: { eggs: CritterCard[]; theme: Theme }) {
  if (!eggs.length) return <div className="w-[120px]" />;
  return (
    <div className="flex flex-col items-center">
      <div className="relative flex h-[96px] items-end">
        <svg viewBox="0 0 130 40" className="absolute bottom-0 left-1/2 w-[130px] -translate-x-1/2" aria-hidden>
          <ellipse cx={65} cy={24} rx={60} ry={14} fill="#B98552" />
          <path d="M10 22 Q40 10 70 20 T122 18 M14 28 Q50 18 84 28 T120 26" stroke="#8A5E35" strokeWidth={2} fill="none" />
        </svg>
        {eggs.map((c) => (
          <Link key={c.friendId} href={`/friends/hangout/${c.friendId}`} className="relative -mb-1">
            <Critter design={c.design} state="egg" theme={theme} size={70} label={`${c.first}'s egg`} />
          </Link>
        ))}
      </div>
      <span className="mt-1 text-[11px] font-semibold text-[#7A5A41]">{eggs.map((c) => c.first).join(", ")} · say hi to hatch</span>
    </div>
  );
}

function Hangout() {
  const params = useSearchParams();
  const router = useRouter();
  const nudgeId = params.get("nudge");
  const [seeAgain, setSeeAgain] = useState(params.get("seeAgain") === "1");
  const { data: h, mutate } = useApi<HangoutView>("/api/hangout", { poll: 2000 });
  const theme: Theme = h?.theme ?? "critters";

  // Let a hatching critter finish its animation, then remember it hatched.
  const hatching = h?.critters.filter((c) => c.state === "hatching").map((c) => c.friendId).join() ?? "";
  useEffect(() => {
    if (!hatching) return;
    const t = setTimeout(async () => {
      await Promise.all(hatching.split(",").map((id) => api(`/api/hangout/friends/${id}`, { method: "POST", json: { hatchSeen: true } })));
      mutate();
    }, 3200);
    return () => clearTimeout(t);
  }, [hatching, mutate]);

  const setTheme = async (t: Theme) => {
    mutate(h && { ...h, theme: t }, { revalidate: false });
    await api("/api/hangout", { method: "POST", json: { theme: t } });
    mutate();
  };

  return (
    <HangPage title="Hangout">
      <div className="flex items-center justify-between px-4 pt-3">
        <div>
          <h1 className="text-[22px] font-bold leading-tight">Your Hangout</h1>
          <p className="flex items-center gap-1 text-[13px] text-ink-2"><Lock size={12} /> Only you can see this</p>
        </div>
        <div className="flex rounded-full bg-[#e4e6eb] p-0.5" role="group" aria-label="Theme">
          {(["critters", "plants"] as const).map((t) => (
            <button key={t} onClick={() => setTheme(t)} aria-pressed={theme === t} className={cx("flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-semibold capitalize transition", theme === t ? "bg-white text-ink shadow-sm" : "text-ink-2")}>
              {t === "critters" ? <PawPrint size={14} /> : <Leaf size={14} />} {t}
            </button>
          ))}
        </div>
      </div>

      {h?.nudges.map((n) => (
        <button key={n.id} onClick={() => router.push(`/friends/hangout?nudge=${n.id}`)} className="hang-glow mx-3 mt-3 flex w-[calc(100%-24px)] items-center gap-2 rounded-2xl bg-white p-2.5 text-left shadow-sm">
          <Critter design={n.critter.design} state={n.critter.state} theme={theme} size={52} showKeepsakes={false} />
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-bold tracking-wide text-fb uppercase">Muse noticed something</span>
            <span className="block text-[15px] leading-snug font-semibold">{n.reason}</span>
          </span>
          <ChevronRight size={20} className="shrink-0 text-ink-2" />
        </button>
      ))}

      {h?.seeAgain && (
        <button onClick={() => setSeeAgain(true)} className="mx-3 mt-3 flex w-[calc(100%-24px)] items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#e7f3ff] text-fb"><Users size={22} /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold leading-snug">You went to {h.seeAgain.name}{h.seeAgain.today ? " today" : ""}. See anyone again?</span>
            <span className="block text-[13px] text-ink-2">Pick privately. Only mutual picks are shared.</span>
          </span>
          <ChevronRight size={20} className="shrink-0 text-ink-2" />
        </button>
      )}

      <section
        className="relative mx-3 mt-3 overflow-hidden rounded-3xl shadow-sm"
        style={{ background: theme === "plants" ? "linear-gradient(#EAF6EC 0 62%, #DCC6A7 62%)" : "linear-gradient(#FFF3E2 0 62%, #F3D7B6 62%)" }}
      >
        <div className="absolute top-3 right-3 h-14 w-[72px] overflow-hidden rounded-lg border-4 border-white bg-gradient-to-b from-[#9fd3ff] to-[#dff0ff] shadow-sm" aria-hidden>
          <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 bg-white" />
          <div className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 bg-white" />
        </div>
        <div className="absolute bottom-[132px] left-1/2 h-20 w-[88%] -translate-x-1/2 rounded-[50%] bg-[#F4B996]/45" aria-hidden />

        <div className="relative flex items-start gap-2 px-3 pt-3 pr-24">
          <div className="shrink-0"><MuseHost size={54} /></div>
          <div className="relative mt-1 rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-[14px] leading-snug shadow-sm">
            {h ? h.host.line : <span className="skeleton block h-4 w-40 rounded" />}
          </div>
        </div>

        <div className="relative grid grid-cols-3 gap-y-2 px-1 pt-2 pb-1">
          {h?.critters.map((c) => <Tile key={c.friendId} c={c} theme={theme} />)}
          {!h && Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton mx-auto my-3 h-24 w-20 rounded-2xl" />)}
        </div>

        <div className="relative flex items-end justify-between px-2 pt-1 pb-3">
          <Nest eggs={h?.eggs ?? []} theme={theme} />
          <Hammock friends={h?.hammock ?? []} theme={theme} />
        </div>
      </section>

      <p className="px-6 pt-3 pb-6 text-center text-[12px] leading-snug text-ink-2">
        {theme === "plants" ? "Plants get thirsty when you drift and perk up when you reconnect." : "Critters get sleepy when you drift and wake up when you reconnect."} They never get sick. Tap one to see what you two share.
      </p>

      <NudgeSheet id={nudgeId} onClose={() => router.replace("/friends/hangout")} />
      <SeeAgainSheet open={seeAgain} onClose={() => setSeeAgain(false)} />
    </HangPage>
  );
}

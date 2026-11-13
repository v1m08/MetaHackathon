"use client";
// Your Hangout, opened from the card at the top of Chats. Hang Again's room with one critter per friend, kept awake
// by playing each day's Chat Game together: live streaks in the room, eggs in the nest, ended ones in the hammock.
// Below it, everyone in a list grouped by what today needs.
import Link from "next/link";
import { Critter } from "@/components/hangout/Critter";
import { MuseHost } from "@/components/hangout/MuseHost";
import { MessengerShell } from "@/components/messenger/MessengerShell";
import { Count, StreakRow, streakHref } from "@/components/streaks/ui";
import { useApi } from "@/lib/api";
import { endsLabel, hostLine, SECTIONS, STATUS } from "@/lib/streaks/copy";
import type { StreakCard, StreaksView } from "@/lib/streaks/views";

function Tile({ c }: { c: StreakCard }) {
  return (
    <Link href={streakHref(c)} className="flex flex-col items-center rounded-2xl py-1 active:scale-[.97]">
      <Critter design={c.design} state={c.state} size={94} label={`${c.first}'s critter: ${STATUS[c.status].label}`} />
      <span className="-mt-1 text-[14px] font-semibold">{c.first}</span>
      <Count c={c} className="mt-0.5" />
    </Link>
  );
}

function Hammock({ friends }: { friends: StreakCard[] }) {
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
          <Link key={c.friendId} href={streakHref(c)} className="flex flex-col items-center">
            <Critter design={c.design} state="resting" size={62} label={`${c.first}'s streak ended`} />
          </Link>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 text-center text-[11px] font-semibold text-[#7A5A41]">
        {friends.length ? `Napping: ${friends.map((c) => c.first).join(", ")}` : "Ended streaks nap here"}
      </div>
    </div>
  );
}

function Nest({ eggs }: { eggs: StreakCard[] }) {
  if (!eggs.length) return <div className="w-[120px]" />;
  return (
    <div className="flex flex-col items-center">
      <div className="relative flex h-[96px] items-end">
        <svg viewBox="0 0 130 40" className="absolute bottom-0 left-1/2 w-[130px] -translate-x-1/2" aria-hidden>
          <ellipse cx={65} cy={24} rx={60} ry={14} fill="#B98552" />
          <path d="M10 22 Q40 10 70 20 T122 18 M14 28 Q50 18 84 28 T120 26" stroke="#8A5E35" strokeWidth={2} fill="none" />
        </svg>
        {eggs.map((c) => (
          <Link key={c.friendId} href={streakHref(c)} className="relative -mb-1">
            <Critter design={c.design} state="egg" size={70} label={`${c.first}'s egg`} />
          </Link>
        ))}
      </div>
      <span className="mt-1 text-[11px] font-semibold text-[#7A5A41]">{eggs.map((c) => c.first).join(", ")} · play to hatch</span>
    </div>
  );
}

export default function HangoutPage() {
  const { data: v } = useApi<StreaksView>("/api/streaks", { poll: 3000 });
  const ends = v ? endsLabel(v.endsAt) : "";
  const friends = v?.friends ?? [];
  const room = friends.filter((c) => c.status !== "new" && c.status !== "lost");
  return (
    <MessengerShell back title="Your Hangout">
      <section className="relative mx-3 mt-1 overflow-hidden rounded-3xl shadow-sm" style={{ background: "linear-gradient(#FFF3E2 0 62%, #F3D7B6 62%)" }}>
        <div className="absolute top-3 right-3 h-14 w-[72px] overflow-hidden rounded-lg border-4 border-white bg-gradient-to-b from-[#9fd3ff] to-[#dff0ff] shadow-sm" aria-hidden>
          <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 bg-white" />
          <div className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 bg-white" />
        </div>
        <div className="absolute bottom-[132px] left-1/2 h-20 w-[88%] -translate-x-1/2 rounded-[50%] bg-[#F4B996]/45" aria-hidden />

        <div className="relative flex items-start gap-2 px-3 pt-3 pr-24">
          <div className="shrink-0"><MuseHost size={64} image={v?.host.image} /></div>
          <div className="relative mt-1 rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-[14px] leading-snug shadow-sm">
            {v ? hostLine(v, ends) : <span className="skeleton block h-4 w-40 rounded" />}
          </div>
        </div>

        <div className="relative grid grid-cols-3 gap-y-2 px-1 pt-2 pb-1">
          {room.map((c) => <Tile key={c.friendId} c={c} />)}
          {!v && Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton mx-auto my-3 h-24 w-20 rounded-2xl" />)}
        </div>

        <div className="relative flex items-end justify-between px-2 pt-1 pb-3">
          <Nest eggs={friends.filter((c) => c.status === "new")} />
          <Hammock friends={friends.filter((c) => c.status === "lost")} />
        </div>
      </section>

      <div className="pt-3">
        {SECTIONS.map((s) => {
          const rows = friends.filter((c) => s.statuses.includes(c.status));
          if (!rows.length) return null;
          return (
            <section key={s.title} className="pb-1">
              <h3 className="flex items-center gap-2 px-4 pt-2 pb-1 text-[13px] font-semibold text-ink-2 uppercase">
                {s.title} <span className="rounded-full bg-[#f0f2f5] px-1.5 text-[11px] text-ink-2">{rows.length}</span>
              </h3>
              {rows.map((c) => <StreakRow key={c.friendId} c={c} ends={ends} />)}
            </section>
          );
        })}
      </div>

      <p className="px-6 pt-2 pb-8 text-center text-[12px] leading-snug text-ink-2">
        A day counts when you both finish that chat&apos;s daily game. Critters get sleepy when a streak is about to end. Tap one to see your streak.
      </p>
    </MessengerShell>
  );
}

"use client";
import Link from "next/link";
import { Play, Trophy } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Avatar, Pill, SectionTitle } from "@/components/ui";
import { useApi } from "@/lib/api";
import type { Game } from "@/types";

type Card = { id: string; name: string; avatar: string };
type G = Omit<Game, "leaderboard"> & { leaderboard: { userId: string; score: number; user: Card; isFriend: boolean }[]; friendsPlaying: Card[] };

export default function GamingPage() {
  const { data } = useApi<G[]>("/api/games");
  return (
    <Shell back title="Gaming">
      <div className="bg-white pb-3">
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3">
          <Pill active>Play</Pill><Pill>Following</Pill><Pill>Live</Pill>
        </div>
        <SectionTitle>Play with friends</SectionTitle>
        <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-2">
          {data?.filter((g) => g.playable).map((g) => (
            <Link key={g.id} href={`/gaming/${g.id}`} className="w-40 shrink-0 overflow-hidden rounded-xl border border-line/60">
              <div className="flex h-28 items-center justify-center bg-gradient-to-br from-fb to-purple-600 text-[48px]">{g.icon}</div>
              <div className="p-2.5">
                <div className="text-[15px] font-semibold">{g.name}</div>
                <div className="text-[12px] text-ink-2">{g.genre} · {g.players}</div>
                <div className="mt-2 flex items-center gap-1 text-[13px] font-semibold text-fb"><Play size={14} className="fill-fb" /> Play now</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
      <div className="mt-2 bg-white pb-4">
        <SectionTitle>Instant games</SectionTitle>
        {data?.map((g) => (
          <Link key={g.id} href={`/gaming/${g.id}`} className="flex items-center gap-3 px-4 py-2.5">
            <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#f0f2f5] text-[34px]">{g.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="text-[16px] font-semibold">{g.name}</div>
              <div className="text-[13px] text-ink-2">{g.genre} · {g.players}</div>
              {g.friendsPlaying.length > 0 && (
                <div className="mt-1 flex items-center gap-1.5 text-[12px] text-ink-2">
                  <span className="flex -space-x-1">{g.friendsPlaying.slice(0, 3).map((f) => <span key={f.id} className="rounded-full border border-white"><Avatar src={f.avatar} name={f.name} size={18} /></span>)}</span>
                  {g.friendsPlaying.length} friends play
                </div>
              )}
            </div>
            <span className="rounded-full bg-[#e4e6eb] px-4 py-1.5 text-[14px] font-semibold">{g.playable ? "Play" : "Open"}</span>
          </Link>
        ))}
        <div className="mt-2 flex items-center gap-2 px-4 text-[13px] text-ink-2"><Trophy size={14} /> Leaderboards update live from the store.</div>
      </div>
    </Shell>
  );
}

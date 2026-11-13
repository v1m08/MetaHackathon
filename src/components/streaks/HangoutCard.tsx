"use client";
// Entry to the Hangout, pinned at the top of Chats (Hang Again's card): the host's line and a peek at the critters
// who need you most.
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Critter } from "@/components/hangout/Critter";
import { useApi } from "@/lib/api";
import { endsLabel, hostLine, needsYou } from "@/lib/streaks/copy";
import type { StreaksView } from "@/lib/streaks/views";

export function HangoutCard() {
  const { data: v } = useApi<StreaksView>("/api/streaks", { poll: 4000 });
  const waiting = v ? needsYou(v.friends).length : 0;
  return (
    <Link href="/streaks" className="mx-3 mt-1 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#FFF3E2] to-[#FFF9F1] p-3 active:scale-[.99]">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[16px] font-bold">
          Your Hangout
          {!!waiting && <span className="rounded-full bg-messenger px-2 py-[1px] text-[11px] font-semibold text-white">{waiting} need{waiting === 1 ? "s" : ""} you today</span>}
        </div>
        <div className="truncate text-[13px] text-ink-2">{v ? hostLine(v, endsLabel(v.endsAt)) : "Your friends, as critters. Keep your streaks going."}</div>
        <div className="mt-1 flex h-11 -space-x-3">
          {v?.friends.slice(0, 5).map((c) => <Critter key={c.friendId} design={c.design} state={c.state} size={44} showKeepsakes={false} />)}
        </div>
      </div>
      <ChevronRight size={20} className="shrink-0 text-ink-2" />
    </Link>
  );
}

"use client";
// The feed strip: under a drifted friend's post, the one line linking it to your shared history, with the evidence
// as chips. One a day. Tapping goes to the person page; the chips open the evidence screen.
import Link from "next/link";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { useApi } from "@/lib/api";
import { EvidenceChips, EvidenceSheet, SayHi, SparkLine } from "./ui";
import type { Nudge } from "@/lib/reconnect/store";
import type { Drift, RecentPost } from "@/lib/reconnect/drift";

export type Daily = { nudge: { nudge: Nudge; friend: { id: string; name: string; avatar: string; city?: string }; post?: RecentPost; drift: Drift } | null };

export function useDailyNudge() {
  return useApi<Daily>("/api/reconnect/nudge");
}

export function WhyNowStrip({ d }: { d: NonNullable<Daily["nudge"]> }) {
  const [sheet, setSheet] = useState(false);
  const weeks = d.drift.daysSince === null ? null : Math.round(d.drift.daysSince / 7);
  return (
    <div className="border-t border-line/60 bg-[#f7faff] px-4 py-3">
      <div className="flex items-center justify-between"><SparkLine>You and {d.friend.name.split(" ")[0]}</SparkLine>{weeks !== null && <span className="text-[11.5px] text-ink-2">{weeks} weeks since a real chat</span>}</div>
      <p className="mt-1 text-[15px] leading-snug">{d.nudge.line}</p>
      <div className="mt-2"><EvidenceChips evidence={d.nudge.evidence} onOpen={() => setSheet(true)} /></div>
      <div className="mt-2.5 flex gap-2">
        <Link href={`/reconnect/${d.friend.id}`} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-fb py-2 text-[14px] font-semibold text-white">Plan something <ChevronRight size={15} /></Link>
        <SayHi personId={d.friend.id} className="flex flex-1 items-center justify-center rounded-lg bg-[#e4e6eb] py-2 text-[14px] font-semibold" />
      </div>
      <EvidenceSheet open={sheet} onClose={() => setSheet(false)} used={d.nudge.evidence} index={d.nudge.evidence} friendName={d.friend.name} />
    </div>
  );
}

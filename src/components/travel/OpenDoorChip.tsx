"use client";
// Messenger entry point: how many Open Door requests are waiting on me (as host or traveler).
import Link from "next/link";
import { ChevronRight, DoorOpen } from "lucide-react";
import { useApi } from "@/lib/api";
import type { RequestView } from "./Negotiation";

export function OpenDoorChip() {
  const { data } = useApi<{ requests: RequestView[] }>("/api/opendoor/requests", { poll: 4000 });
  const reqs = data?.requests ?? [];
  const waiting = reqs.filter((r) => (r.role === "host" && !r.conversationId && r.status !== "declined" && (!r.hostAccepted || r.revealedAt)) || (r.role === "traveler" && r.status === "proposed"));
  const matched = reqs.filter((r) => r.conversationId).length;
  if (!reqs.length) return null;
  return (
    <Link href="/travel/opendoor" className="mx-4 mb-2 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white"><DoorOpen size={18} /></span>
      <span className="min-w-0 flex-1 text-[14px] leading-snug">
        <b className="font-semibold">Open Door</b>
        <div className="text-[12.5px] text-ink-2">{waiting.length ? `${waiting.length} waiting on you` : matched ? `${matched} matched` : `${reqs.length} request${reqs.length === 1 ? "" : "s"}`} · identities hidden until you both say yes</div>
      </span>
      <ChevronRight size={16} className="text-ink-2" />
    </Link>
  );
}

"use client";
import Link from "next/link";
import { useState } from "react";
import { CalendarDays, Check, MapPin, Send } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Avatar, Photo, Pill, SectionTitle } from "@/components/ui";
import { api, refresh, useApi } from "@/lib/api";
import { eventDate } from "@/lib/format";
import type { FBEvent } from "@/types";

type ShareTarget = { conversationId: string; name: string; label: string };
type E = FBEvent & { host?: { name: string }; hostGroup?: string; myStatus: "going" | "interested" | "none"; friendsGoing: { id: string; name: string; avatar: string }[]; fit?: number; fitLabel?: string; shareTarget?: ShareTarget };
const byFit = <T extends { fit?: number }>(list: T[]) => [...list].sort((a, b) => (b.fit ?? 0) - (a.fit ?? 0));

function EventRow({ e, showFit }: { e: E; showFit?: boolean }) {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  async function share(ev: React.MouseEvent) {
    ev.preventDefault();
    if (!e.shareTarget || busy || sent) return;
    setBusy(true);
    try {
      await api(`/api/conversations/${e.shareTarget.conversationId}/messages`, {
        method: "POST",
        json: { text: `Wait should we go to ${e.title}?`, attachment: { type: "event", ref: e.id } },
      });
      refresh("/api/conversations");
      setSent(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="px-4 py-2.5">
      <div className="flex gap-3">
        <Link href={`/events/${e.id}`} className="shrink-0">
          <Photo src={e.cover} className="h-24 w-24 rounded-lg object-cover" />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/events/${e.id}`} className="block">
            <div className="text-[13px] font-semibold text-red-600 uppercase">{eventDate(e.startsAt)}</div>
            <div className="mt-0.5 line-clamp-2 text-[16px] font-semibold leading-tight">{e.title}</div>
            <div className="mt-0.5 flex items-center gap-1 truncate text-[13px] text-ink-2"><MapPin size={12} /> {e.location}</div>
            <div className="mt-1 flex items-center gap-2 text-[13px] text-ink-2">
              {e.friendsGoing.length > 0 && (
                <span className="flex -space-x-1.5">{e.friendsGoing.slice(0, 3).map((f) => <span key={f.id} className="rounded-full border border-white"><Avatar src={f.avatar} name={f.name} size={18} /></span>)}</span>
              )}
              <span>{e.going.length} going{e.friendsGoing.length > 0 && ` · ${e.friendsGoing.length} friends`}</span>
              {e.myStatus !== "none" && <span className="ml-auto rounded bg-[#e7f3ff] px-1.5 py-0.5 text-[11px] font-bold text-fb uppercase">{e.myStatus}</span>}
            </div>
          </Link>
          {showFit && (e.fit ?? 0) > 0.15 && (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="truncate text-[12px] font-medium text-fb">{e.fitLabel ?? "From your games"}</span>
              {e.shareTarget && (
                sent ? (
                  <Link href={`/messages/${e.shareTarget.conversationId}`} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11.5px] font-semibold text-emerald-700">
                    <Check size={11} /> Sent · Open chat
                  </Link>
                ) : (
                  <button onClick={share} disabled={busy} className="inline-flex items-center gap-1 rounded-full bg-[#e7f3ff] px-2 py-0.5 text-[11.5px] font-semibold text-fb">
                    <Send size={10} /> {e.shareTarget.label}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EventsPage() {
  const { data } = useApi<E[]>("/api/events");
  const [tab, setTab] = useState<"foryou" | "going" | "past">("foryou");
  const now = Date.now();
  const upcoming = data?.filter((e) => new Date(e.startsAt).getTime() > now - 3600e3 * 4) ?? [];
  const past = data?.filter((e) => !upcoming.includes(e)) ?? [];
  const list = tab === "foryou" ? upcoming : tab === "going" ? upcoming.filter((e) => e.myStatus !== "none") : past;
  const rank = (l: E[]) => (tab === "foryou" ? byFit(l) : l);
  const thisWeek = rank(list.filter((e) => new Date(e.startsAt).getTime() < now + 7 * 864e5));
  const later = rank(list.filter((e) => !thisWeek.includes(e)));
  return (
    <Shell back title="Events" right={<Link href="/compose" className="rounded-full bg-[#e4e6eb] p-2"><CalendarDays size={18} /></Link>}>
      <div className="bg-white pb-3">
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3">
          <Pill active={tab === "foryou"} onClick={() => setTab("foryou")}>For you</Pill>
          <Pill active={tab === "going"} onClick={() => setTab("going")}>Your events</Pill>
          <Pill active={tab === "past"} onClick={() => setTab("past")}>Past</Pill>
        </div>
        {tab !== "past" && thisWeek.length > 0 && <SectionTitle>This week</SectionTitle>}
        {(tab === "past" ? list : thisWeek).map((e) => <EventRow key={e.id} e={e} showFit={tab === "foryou"} />)}
        {tab !== "past" && later.length > 0 && <SectionTitle>Later</SectionTitle>}
        {tab !== "past" && later.map((e) => <EventRow key={e.id} e={e} showFit={tab === "foryou"} />)}
        {list.length === 0 && <div className="py-12 text-center text-ink-2">Nothing here yet</div>}
      </div>
    </Shell>
  );
}

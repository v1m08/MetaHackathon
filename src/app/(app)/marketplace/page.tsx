"use client";
import Link from "next/link";
import { useState } from "react";
import { Check, MapPin, Search, Send, SlidersHorizontal, Tag, User } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Photo, Pill, Skeleton, cx } from "@/components/ui";
import { api, refresh, useApi } from "@/lib/api";
import { money } from "@/lib/format";
import type { Listing } from "@/types";

type ShareTarget = { conversationId: string; name: string; label: string };
type L = Listing & { seller: { id: string; name: string; avatar: string }; saved: boolean; fit?: number; fitLabel?: string; shareTarget?: ShareTarget };
const CATS = ["All", "Furniture", "Electronics", "Bikes", "Sporting Goods", "Clothing", "Plants", "Books", "Tickets", "Musical Instruments"];

function ListingTile({ l }: { l: L }) {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  async function share() {
    if (!l.shareTarget || busy || sent) return;
    setBusy(true);
    try {
      await api(`/api/conversations/${l.shareTarget.conversationId}/messages`, {
        method: "POST",
        json: { text: `Saw this on Marketplace and thought of our chat`, attachment: { type: "listing", ref: l.id } },
      });
      refresh("/api/conversations");
      setSent(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <Link href={`/marketplace/${l.id}`} className="block">
        <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-200">
          <Photo src={l.images[0]} className="h-full w-full object-cover" />
          {l.status !== "available" && <span className="absolute top-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-bold text-white uppercase">{l.status}</span>}
        </div>
        <div className="mt-1 text-[16px] font-semibold">{money(l.price)}</div>
        <div className="truncate text-[14px] leading-tight">{l.title}</div>
        <div className="truncate text-[12px] text-ink-2">{l.location}</div>
      </Link>
      {(l.fit ?? 0) > 0.15 && (
        <div className="mt-1 space-y-1">
          <div className="truncate text-[11.5px] font-medium text-fb">{l.fitLabel ?? "From your games"}</div>
          {l.shareTarget && (
            sent ? (
              <Link href={`/messages/${l.shareTarget.conversationId}`} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                <Check size={10} /> Sent · Open chat
              </Link>
            ) : (
              <button onClick={share} disabled={busy} className="inline-flex items-center gap-1 rounded-full bg-[#e7f3ff] px-2 py-0.5 text-[11px] font-semibold text-fb">
                <Send size={10} /> {l.shareTarget.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

export default function MarketplacePage() {
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const { data } = useApi<L[]>(`/api/marketplace?${new URLSearchParams({ ...(cat !== "All" ? { category: cat } : {}), ...(q ? { q } : {}) })}`);
  return (
    <Shell title={undefined} right={<Link href="/marketplace/new" className="rounded-full bg-[#e4e6eb] px-3 py-1.5 text-[14px] font-semibold">+ Sell</Link>}>
      <div className="bg-white">
        <div className="flex items-center justify-between px-4 pt-3">
          <h1 className="text-[24px] font-bold">Marketplace</h1>
          <div className="flex gap-2">
            <Link href="/saved" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e4e6eb]"><User size={18} /></Link>
            <button className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e4e6eb]"><SlidersHorizontal size={18} /></button>
          </div>
        </div>
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 rounded-full bg-[#f0f2f5] px-3 py-2">
            <Search size={18} className="text-ink-2" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Marketplace" className="flex-1 bg-transparent text-[15px] outline-none" />
          </div>
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
          {CATS.map((c) => (
            <Pill key={c} active={cat === c} onClick={() => setCat(c)}>{c}</Pill>
          ))}
        </div>
      </div>
      <div className="mt-2 bg-white px-4 py-3">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[17px] font-bold">{cat === "All" ? "Today's picks" : cat}</span>
          <span className="flex items-center gap-1 text-[14px] font-semibold text-fb"><MapPin size={14} /> Austin · 10 mi</span>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-4">
          {!data && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="aspect-square" />)}
          {data?.map((l) => (
            <ListingTile key={l.id} l={l} />
          ))}
        </div>
        {data?.length === 0 && <div className={cx("py-12 text-center text-ink-2")}><Tag className="mx-auto mb-2" />No listings match</div>}
      </div>
    </Shell>
  );
}

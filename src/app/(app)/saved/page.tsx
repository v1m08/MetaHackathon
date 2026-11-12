"use client";
import Link from "next/link";
import { Shell } from "@/components/Shell";
import { Photo, SectionTitle } from "@/components/ui";
import { useApi } from "@/lib/api";
import { compact, money } from "@/lib/format";
import type { Listing, Reel } from "@/types";

type L = Listing & { saved: boolean };
type R = Reel & { author: { name: string }; saved: boolean };

export default function SavedPage() {
  const { data: listings } = useApi<L[]>("/api/marketplace");
  const { data: reels } = useApi<R[]>("/api/reels?saved=1");
  const savedListings = listings?.filter((l) => l.saved) ?? [];
  return (
    <Shell back title="Saved">
      <div className="bg-white pb-3">
        <SectionTitle>Saved Reels</SectionTitle>
        <div className="grid grid-cols-3 gap-0.5 px-0.5">
          {reels?.map((r) => (
            <Link key={r.id} href="/reels" className="relative aspect-[9/16]">
              <Photo src={r.image} className="h-full w-full object-cover" />
              <span className="absolute bottom-1 left-1 text-[12px] font-semibold text-white drop-shadow">▶ {compact(r.views)}</span>
            </Link>
          ))}
        </div>
        {reels?.length === 0 && <div className="px-4 py-6 text-ink-2">No saved reels yet</div>}
      </div>
      <div className="mt-2 bg-white pb-4">
        <SectionTitle>Saved Marketplace items</SectionTitle>
        <div className="grid grid-cols-2 gap-3 px-4">
          {savedListings.map((l) => (
            <Link key={l.id} href={`/marketplace/${l.id}`}>
              <Photo src={l.images[0]} className="aspect-square w-full rounded-lg object-cover" />
              <div className="mt-1 text-[15px] font-semibold">{money(l.price)}</div>
              <div className="truncate text-[13px]">{l.title}</div>
            </Link>
          ))}
        </div>
        {savedListings.length === 0 && <div className="px-4 py-6 text-ink-2">No saved listings yet</div>}
      </div>
    </Shell>
  );
}

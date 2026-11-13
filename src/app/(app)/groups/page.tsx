"use client";
import Link from "next/link";
import { Lock, Globe, Search } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Photo, Pill, SectionTitle } from "@/components/ui";
import { useApi } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import type { Group } from "@/types";

type G = Group & { memberCount: number; isMember: boolean; lastPostAt?: string; newPosts: number; fit?: number; fitLabel?: string };

export default function GroupsPage() {
  const { data } = useApi<G[]>("/api/groups");
  const mine = data?.filter((g) => g.isMember) ?? [];
  const discover = [...(data?.filter((g) => !g.isMember) ?? [])].sort((a, b) => (b.fit ?? 0) - (a.fit ?? 0));
  return (
    <Shell back title="Groups" right={<Link href="/search" className="rounded-full bg-[#e4e6eb] p-2"><Search size={18} /></Link>}>
      <div className="bg-white pb-3">
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3">
          <Pill active>Your groups</Pill>
          <Pill>Discover</Pill>
          <Pill>Your posts</Pill>
        </div>
        <SectionTitle action="See all">Groups you&apos;ve joined</SectionTitle>
        <div className="divide-y divide-line/40">
          {mine.map((g) => (
            <Link key={g.id} href={`/groups/${g.id}`} className="flex items-center gap-3 px-4 py-2.5">
              <Photo src={g.cover} className="h-14 w-14 shrink-0 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-semibold">{g.name}</div>
                <div className="text-[13px] text-ink-2">
                  {g.newPosts > 0 ? <b className="font-semibold text-fb">{g.newPosts} new posts</b> : "No new posts"} · last active {g.lastPostAt ? timeAgo(g.lastPostAt) : "—"}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
      {discover.length > 0 && (
        <div className="mt-2 bg-white pb-4">
          <SectionTitle>Suggested for you</SectionTitle>
          <div className="space-y-3 px-4">
            {discover.map((g) => (
              <Link key={g.id} href={`/groups/${g.id}`} className="block overflow-hidden rounded-xl border border-line/60">
                <Photo src={g.cover} className="h-28 w-full object-cover" />
                <div className="p-3">
                  <div className="text-[16px] font-semibold leading-tight">{g.name}</div>
                  <div className="mt-1 flex items-center gap-1 text-[13px] text-ink-2">
                    {g.privacy === "private" ? <Lock size={12} /> : <Globe size={12} />} {g.privacy === "private" ? "Private" : "Public"} · {g.memberCount} members · {g.postsPerDay} posts a day
                  </div>
                  {(g.fit ?? 0) > 0.15 && <div className="mt-1 text-[12px] font-medium text-fb">From your games{g.fitLabel ? ` · ${g.fitLabel}` : ""}</div>}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </Shell>
  );
}

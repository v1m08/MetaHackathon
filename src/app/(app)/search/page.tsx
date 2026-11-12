"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Search as SearchIcon, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { PostCard } from "@/components/Post";
import { Avatar, Photo, SectionTitle } from "@/components/ui";
import { useApi } from "@/lib/api";
import { money } from "@/lib/format";
import type { HydratedPost } from "@/server/db";
import type { FBEvent, Group, Listing } from "@/types";

type R = { people: { id: string; name: string; avatar: string }[]; groups: Group[]; events: FBEvent[]; listings: Listing[]; posts: HydratedPost[] };
const RECENT = ["taco pop-up", "apartment", "run club", "Porch Lights", "monstera"];

export default function SearchPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 200);
    return () => clearTimeout(t);
  }, [q]);
  const { data } = useApi<R>(debounced ? `/api/search?q=${encodeURIComponent(debounced)}` : null);
  const empty = data && !data.people.length && !data.groups.length && !data.events.length && !data.listings.length && !data.posts.length;
  return (
    <div className="min-h-full bg-bg">
      <header className="safe-top sticky top-0 z-10 bg-white">
        <div className="flex h-14 items-center gap-2 px-2">
          <button onClick={() => router.back()} className="rounded-full p-2"><ArrowLeft size={22} /></button>
          <div className="flex flex-1 items-center gap-2 rounded-full bg-[#f0f2f5] px-3 py-2">
            <SearchIcon size={18} className="text-ink-2" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Facebook" className="flex-1 bg-transparent text-[16px] outline-none" />
            {q && <button onClick={() => setQ("")}><X size={16} className="text-ink-2" /></button>}
          </div>
        </div>
      </header>
      {!debounced && (
        <div className="bg-white">
          <SectionTitle action="Edit">Recent searches</SectionTitle>
          {RECENT.map((r) => (
            <button key={r} onClick={() => setQ(r)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[15px]"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e4e6eb]"><SearchIcon size={16} /></span>{r}</button>
          ))}
        </div>
      )}
      {data && (
        <>
          {data.people.length > 0 && (
            <div className="bg-white pb-2">
              <SectionTitle>People</SectionTitle>
              {data.people.map((p) => (
                <Link key={p.id} href={`/profile/${p.id}`} className="flex items-center gap-3 px-4 py-2"><Avatar src={p.avatar} name={p.name} size={48} /><span className="text-[15px] font-semibold">{p.name}</span></Link>
              ))}
            </div>
          )}
          {data.groups.length > 0 && (
            <div className="mt-2 bg-white pb-2">
              <SectionTitle>Groups</SectionTitle>
              {data.groups.map((g) => (
                <Link key={g.id} href={`/groups/${g.id}`} className="flex items-center gap-3 px-4 py-2"><Photo src={g.cover} className="h-12 w-12 rounded-lg object-cover" /><div><div className="text-[15px] font-semibold">{g.name}</div><div className="text-[13px] text-ink-2">{g.memberIds.length} members</div></div></Link>
              ))}
            </div>
          )}
          {data.events.length > 0 && (
            <div className="mt-2 bg-white pb-2">
              <SectionTitle>Events</SectionTitle>
              {data.events.map((e) => (
                <Link key={e.id} href={`/events/${e.id}`} className="flex items-center gap-3 px-4 py-2"><Photo src={e.cover} className="h-12 w-12 rounded-lg object-cover" /><div><div className="text-[15px] font-semibold">{e.title}</div><div className="text-[13px] text-ink-2">{e.location}</div></div></Link>
              ))}
            </div>
          )}
          {data.listings.length > 0 && (
            <div className="mt-2 bg-white pb-2">
              <SectionTitle>Marketplace</SectionTitle>
              <div className="grid grid-cols-3 gap-2 px-4">
                {data.listings.map((l) => (
                  <Link key={l.id} href={`/marketplace/${l.id}`}><Photo src={l.images[0]} className="aspect-square w-full rounded-lg object-cover" /><div className="text-[13px] font-semibold">{money(l.price)}</div><div className="truncate text-[12px]">{l.title}</div></Link>
                ))}
              </div>
            </div>
          )}
          {data.posts.length > 0 && (
            <div className="mt-2">
              <SectionTitle>Posts</SectionTitle>
              {data.posts.map((p) => <PostCard key={p.id} post={p} />)}
            </div>
          )}
          {empty && <div className="py-16 text-center text-ink-2">No results for &quot;{debounced}&quot;</div>}
        </>
      )}
    </div>
  );
}

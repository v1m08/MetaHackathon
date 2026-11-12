"use client";
import Link from "next/link";
import { useState } from "react";
import { Bookmark, Camera, Heart, MessageCircle, MoreHorizontal, Music2, Search, Send } from "lucide-react";
import { TabBar } from "@/components/Shell";
import { Avatar, Photo, cx } from "@/components/ui";
import { api, useApi } from "@/lib/api";
import { compact } from "@/lib/format";
import type { Reel } from "@/types";

type R = Reel & { author: { id: string; name: string; avatar: string }; liked: boolean; saved: boolean; likeCount: number };

function ReelItem({ r }: { r: R }) {
  const [liked, setLiked] = useState(r.liked);
  const [saved, setSaved] = useState(r.saved);
  const [burst, setBurst] = useState(false);
  const [more, setMore] = useState(false);
  const count = r.likeCount + (liked && !r.liked ? 1 : !liked && r.liked ? -1 : 0);
  const like = () => {
    setLiked(!liked);
    api(`/api/reels/${r.id}/like`, { method: "POST" });
  };
  return (
    <section className="relative h-full w-full snap-start overflow-hidden bg-black" onDoubleClick={() => { if (!liked) like(); setBurst(true); setTimeout(() => setBurst(false), 700); }}>
      {r.videoUrl ? (
        <video src={r.videoUrl} className="h-full w-full object-cover" autoPlay muted loop playsInline />
      ) : (
        <Photo src={r.image} className="kenburns h-full w-full object-cover" />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />
      {burst && <Heart size={110} className="pop absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 fill-white text-white drop-shadow-lg" />}

      <div className="absolute right-2 bottom-20 flex flex-col items-center gap-5 text-white">
        <button onClick={like} className="flex flex-col items-center gap-1">
          <Heart size={30} className={cx(liked && "fill-[#f33e58] text-[#f33e58]")} />
          <span className="text-[12px] font-semibold">{compact(count)}</span>
        </button>
        <button className="flex flex-col items-center gap-1">
          <MessageCircle size={30} />
          <span className="text-[12px] font-semibold">{r.commentCount}</span>
        </button>
        <button className="flex flex-col items-center gap-1">
          <Send size={28} />
          <span className="text-[12px] font-semibold">{compact(r.shares)}</span>
        </button>
        <button onClick={() => { setSaved(!saved); api(`/api/reels/${r.id}/save`, { method: "POST" }); }} className="flex flex-col items-center gap-1">
          <Bookmark size={28} className={cx(saved && "fill-white")} />
          <span className="text-[12px] font-semibold">{saved ? "Saved" : "Save"}</span>
        </button>
        <button><MoreHorizontal size={26} /></button>
      </div>

      <div className="absolute right-16 bottom-20 left-3 text-white">
        <div className="flex items-center gap-2">
          <Link href={`/profile/${r.author.id}`}>
            <Avatar src={r.author.avatar} name={r.author.name} size={36} />
          </Link>
          <Link href={`/profile/${r.author.id}`} className="text-[15px] font-semibold drop-shadow">{r.author.name}</Link>
          <button className="rounded-md border border-white/70 px-2 py-0.5 text-[12px] font-semibold">Follow</button>
        </div>
        <p className={cx("mt-2 text-[14px] leading-snug drop-shadow", !more && "line-clamp-2")} onClick={() => setMore(!more)}>
          {r.caption}
        </p>
        <div className="mt-2 flex items-center gap-1.5 text-[12px]">
          <Music2 size={13} />
          <span className="truncate">{r.audio}</span>
          <span className="opacity-70">· {compact(r.views)} views</span>
        </div>
      </div>
    </section>
  );
}

export default function ReelsPage() {
  const { data: reels } = useApi<R[]>("/api/reels");
  return (
    <div className="flex h-full flex-col bg-black">
      <div className="relative min-h-0 flex-1">
        <div className="safe-top pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 pt-2 text-white">
          <span className="text-[22px] font-bold drop-shadow">Reels</span>
          <span className="pointer-events-auto flex gap-4">
            <Camera size={24} />
            <Link href="/search"><Search size={24} /></Link>
          </span>
        </div>
        <div className="no-scrollbar h-full snap-y snap-mandatory overflow-y-auto">
          {(reels ?? []).map((r) => (
            <div key={r.id} className="h-full">
              <ReelItem r={r} />
            </div>
          ))}
          {!reels && <div className="flex h-full items-center justify-center text-white/60">Loading reels…</div>}
        </div>
      </div>
      <TabBar dark />
    </div>
  );
}

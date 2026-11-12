"use client";
import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
import { ComposerCard } from "@/components/Composer";
import { PostCard } from "@/components/Post";
import { Shell, useMe } from "@/components/Shell";
import { Avatar, Photo, PostSkeleton, Sheet } from "@/components/ui";
import { useApi } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import type { HydratedPost } from "@/server/db";
import type { Story } from "@/types";

type StoryWithUser = Story & { user: { id: string; name: string; avatar: string } };

function Stories() {
  const { data: me } = useMe();
  const { data: stories } = useApi<StoryWithUser[]>("/api/stories");
  const [open, setOpen] = useState<StoryWithUser | null>(null);
  return (
    <div className="mb-2 bg-white py-3">
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-3">
        <Link href="/compose?photo=1" className="relative h-[180px] w-[105px] shrink-0 overflow-hidden rounded-xl bg-[#e4e6eb]">
          {me && <Photo src={me.avatar} className="h-[70%] w-full object-cover" />}
          <div className="absolute inset-x-0 bottom-0 flex h-[30%] flex-col items-center justify-end bg-white pb-2 text-[12px] font-semibold">Create story</div>
          <span className="absolute top-[62%] left-1/2 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border-4 border-white bg-fb text-white">
            <Plus size={18} />
          </span>
        </Link>
        {(stories ?? []).map((s) => (
          <button key={s.id} onClick={() => setOpen(s)} className="relative h-[180px] w-[105px] shrink-0 overflow-hidden rounded-xl bg-gray-300 text-left">
            <Photo src={s.image} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/60" />
            <span className="absolute top-2 left-2">
              <Avatar src={s.user.avatar} name={s.user.name} size={34} ring />
            </span>
            <span className="absolute bottom-2 left-2 line-clamp-2 text-[12px] font-semibold text-white drop-shadow">{s.user.name.split(" ")[0]}</span>
          </button>
        ))}
      </div>
      <Sheet open={!!open} onClose={() => setOpen(null)} full title={open ? `${open.user.name} · ${timeAgo(open.createdAt)}` : ""}>
        {open && (
          <div className="relative h-full bg-black">
            <Photo src={open.image} className="h-full w-full object-contain" />
            {open.caption && <div className="absolute inset-x-0 bottom-10 text-center text-[20px] font-bold text-white drop-shadow">{open.caption}</div>}
          </div>
        )}
      </Sheet>
    </div>
  );
}

export default function FeedPage() {
  const { data: posts, mutate } = useApi<HydratedPost[]>("/api/feed", { poll: 8000 });
  return (
    <Shell>
      <ComposerCard />
      <Stories />
      {!posts && (
        <>
          <PostSkeleton />
          <PostSkeleton />
        </>
      )}
      {posts?.map((p) => (
        <PostCard key={p.id} post={p} onChange={(np) => mutate(posts.map((x) => (x.id === np.id ? np : x)), { revalidate: false })} />
      ))}
      {posts && <div className="py-8 text-center text-[13px] text-ink-2">You&apos;re all caught up</div>}
    </Shell>
  );
}

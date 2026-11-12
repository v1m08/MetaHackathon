"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Globe, Lock, Share2, Sparkles, UserPlus, Users } from "lucide-react";
import { ComposerCard } from "@/components/Composer";
import { PostCard } from "@/components/Post";
import { Shell } from "@/components/Shell";
import { Avatar, Button, Photo, Pill, PostSkeleton, Sheet, cx } from "@/components/ui";
import { api, refresh, useApi } from "@/lib/api";
import type { HydratedPost } from "@/server/db";
import type { Group } from "@/types";

type Card = { id: string; name: string; avatar: string };
type G = Group & { memberCount: number; isMember: boolean; isAdmin: boolean; members: Card[]; admins: Card[]; posts: HydratedPost[] };
type Digest = { summary: string; highlights: { title: string; detail: string }[]; actionItems: string[]; vibe: string };

export default function GroupPage() {
  const { id } = useParams<{ id: string }>();
  const { data: g, mutate } = useApi<G>(`/api/groups/${id}`, { poll: 8000 });
  const [tab, setTab] = useState<"discussion" | "featured" | "people" | "about">("discussion");
  const [digest, setDigest] = useState<Digest | null>(null);
  const [digestOpen, setDigestOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!g) return <Shell back title=""><div className="skeleton h-44" /><PostSkeleton /></Shell>;

  async function catchUp() {
    setDigestOpen(true);
    if (digest) return;
    setBusy(true);
    try {
      setDigest(await api<Digest>("/api/ai/digest", { method: "POST", json: { groupId: g!.id } }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell back title="" right={<button className="rounded-full p-2"><Share2 size={20} /></button>}>
      <div className="bg-white pb-3">
        <Photo src={g.cover} className="h-44 w-full object-cover" />
        <div className="px-4 pt-3">
          <h1 className="text-[22px] font-bold leading-tight">{g.name}</h1>
          <div className="mt-1 flex items-center gap-1 text-[14px] text-ink-2">
            {g.privacy === "private" ? <Lock size={13} /> : <Globe size={13} />} {g.privacy === "private" ? "Private group" : "Public group"} · <b className="font-semibold text-ink">{g.memberCount} members</b>
          </div>
          <div className="mt-2 flex -space-x-2">
            {g.members.slice(0, 8).map((m) => (
              <span key={m.id} className="rounded-full border-2 border-white"><Avatar src={m.avatar} name={m.name} size={28} /></span>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            {g.isMember ? (
              <>
                <Button className="flex-1" onClick={catchUp}><Sparkles size={16} /> Catch me up</Button>
                <Button variant="secondary" className="flex-1"><UserPlus size={16} /> Invite</Button>
              </>
            ) : (
              <Button className="flex-1" onClick={async () => { await api(`/api/groups/${g.id}/join`, { method: "POST" }); mutate(); refresh("/api/me"); }}>
                <Users size={16} /> Join group
              </Button>
            )}
          </div>
        </div>
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto border-t border-line/60 px-4 pt-3">
          {(["discussion", "featured", "people", "about"] as const).map((t) => (
            <Pill key={t} active={tab === t} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</Pill>
          ))}
        </div>
      </div>

      {tab === "discussion" && (
        <div className="mt-2">
          {g.isMember && <ComposerCard groupId={g.id} placeholder="Write something…" />}
          {g.posts.map((p) => (
            <PostCard key={p.id} post={p} compact onChange={(np) => mutate({ ...g, posts: g.posts.map((x) => (x.id === np.id ? np : x)) }, { revalidate: false })} />
          ))}
        </div>
      )}
      {tab === "featured" && (
        <div className="mt-2">
          {[...g.posts].sort((a, b) => b.reactionCount - a.reactionCount).slice(0, 5).map((p) => <PostCard key={p.id} post={p} compact />)}
        </div>
      )}
      {tab === "people" && (
        <div className="mt-2 bg-white px-4 py-3">
          <h3 className="text-[17px] font-bold">Admins &amp; moderators</h3>
          {g.admins.map((m) => (
            <Link key={m.id} href={`/profile/${m.id}`} className="flex items-center gap-3 py-2">
              <Avatar src={m.avatar} name={m.name} size={44} /><span className="text-[15px] font-semibold">{m.name}</span><span className="ml-auto rounded bg-[#e4e6eb] px-1.5 py-0.5 text-[11px] font-bold">ADMIN</span>
            </Link>
          ))}
          <h3 className="mt-4 text-[17px] font-bold">Members · {g.memberCount}</h3>
          {g.members.map((m) => (
            <Link key={m.id} href={`/profile/${m.id}`} className="flex items-center gap-3 py-2">
              <Avatar src={m.avatar} name={m.name} size={44} /><span className="text-[15px] font-semibold">{m.name}</span>
            </Link>
          ))}
        </div>
      )}
      {tab === "about" && (
        <div className="mt-2 bg-white px-4 py-4 text-[15px]">
          <h3 className="text-[17px] font-bold">About this group</h3>
          <p className="mt-2 leading-snug">{g.description}</p>
          <div className="mt-3 text-ink-2">Created {new Date(g.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })} · {g.tags.join(" · ")}</div>
          {g.rules && (
            <>
              <h3 className="mt-5 text-[17px] font-bold">Group rules</h3>
              <ol className="mt-2 list-decimal space-y-1.5 pl-5">{g.rules.map((r) => <li key={r}>{r}</li>)}</ol>
            </>
          )}
        </div>
      )}

      <Sheet open={digestOpen} onClose={() => setDigestOpen(false)} title="Catch me up">
        <div className="px-4 py-4 text-[15px]">
          {busy && (
            <div className="space-y-3">
              <div className="skeleton h-4 w-3/4" /><div className="skeleton h-4 w-full" /><div className="skeleton h-4 w-5/6" />
              <div className="mt-2 text-[13px] text-ink-2">Reading {g.posts.length} posts and their comments…</div>
            </div>
          )}
          {digest && (
            <>
              <div className="flex items-center gap-2 text-[13px] font-semibold text-fb"><Sparkles size={14} /> AI summary · vibe: {digest.vibe}</div>
              <p className="mt-2 leading-snug">{digest.summary}</p>
              <h4 className="mt-4 text-[15px] font-bold">Highlights</h4>
              <ul className="mt-1 space-y-2">
                {digest.highlights.map((h, i) => (
                  <li key={i} className="rounded-lg bg-[#f0f2f5] px-3 py-2"><div className="font-semibold">{h.title}</div><div className="text-[14px] text-ink-2">{h.detail}</div></li>
                ))}
              </ul>
              {digest.actionItems.length > 0 && (
                <>
                  <h4 className="mt-4 text-[15px] font-bold">For you</h4>
                  <ul className={cx("mt-1 list-disc space-y-1 pl-5")}>{digest.actionItems.map((a, i) => <li key={i}>{a}</li>)}</ul>
                </>
              )}
              <Link href="/dev/ai" className="mt-4 block text-center text-[13px] text-ink-2 underline">See how this was generated</Link>
            </>
          )}
        </div>
      </Sheet>
    </Shell>
  );
}

"use client";
import { useState } from "react";
import { Heart, MapPin, MessageCircle, Settings2, Sparkles, X } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Avatar, Button, Photo, cx } from "@/components/ui";
import { api, useApi } from "@/lib/api";
import type { DatingProfile } from "@/types";

type P = DatingProfile & { name: string; age: number; pronouns: string; location: string; interests: string[]; mutuals: number; likedYou: boolean };
type Matches = { matches: { id: string; name: string; avatar: string; photo?: string; age: number }[]; likedYou: { id: string; name: string; avatar: string; photo?: string }[] };

function CardView({ p, onSwipe }: { p: P; onSwipe: (a: "like" | "pass") => void }) {
  const [photo, setPhoto] = useState(0);
  const [leaving, setLeaving] = useState<"like" | "pass" | null>(null);
  const go = (a: "like" | "pass") => {
    setLeaving(a);
    setTimeout(() => onSwipe(a), 260);
  };
  return (
    <div className={cx("transition-all duration-300", leaving === "like" && "translate-x-[120%] rotate-12 opacity-0", leaving === "pass" && "-translate-x-[120%] -rotate-12 opacity-0")}>
      <div className="relative overflow-hidden rounded-2xl bg-white shadow-md">
        <div className="relative aspect-[4/5]" onClick={() => setPhoto((photo + 1) % p.photos.length)}>
          <Photo src={p.photos[photo]} className="h-full w-full object-cover" />
          <div className="absolute top-2 inset-x-2 flex gap-1">{p.photos.map((_, i) => <span key={i} className={cx("h-1 flex-1 rounded-full", i === photo ? "bg-white" : "bg-white/40")} />)}</div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-white">
            {p.likedYou && <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-pink-500 px-2 py-0.5 text-[11px] font-bold"><Heart size={10} className="fill-white" /> Liked you</span>}
            <div className="text-[26px] font-bold leading-tight">{p.name}, {p.age}</div>
            <div className="text-[14px] opacity-90">{p.pronouns} · {p.job ?? p.education}</div>
            <div className="mt-1 flex items-center gap-1 text-[13px] opacity-90"><MapPin size={12} /> {p.distanceMiles} miles away{p.mutuals > 0 && ` · ${p.mutuals} mutual friends`}</div>
          </div>
        </div>
        <div className="space-y-3 p-4">
          {p.prompts.map((pr) => (
            <div key={pr.question}>
              <div className="text-[12px] font-semibold text-ink-2 uppercase">{pr.question}</div>
              <div className="text-[17px] leading-snug">{pr.answer}</div>
            </div>
          ))}
          <div className="flex flex-wrap gap-1.5 pt-1">{p.interests.slice(0, 5).map((i) => <span key={i} className="rounded-full bg-[#f0f2f5] px-2.5 py-1 text-[13px]">{i}</span>)}</div>
          <div className="text-[13px] text-ink-2">Looking for: {p.lookingFor}{p.height && ` · ${p.height}`}</div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-center gap-6">
        <button onClick={() => go("pass")} className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-md active:scale-95"><X size={30} className="text-ink-2" /></button>
        <button onClick={() => go("like")} className="flex h-16 w-16 items-center justify-center rounded-full bg-pink-500 shadow-md active:scale-95"><Heart size={30} className="fill-white text-white" /></button>
      </div>
    </div>
  );
}

export default function DatingPage() {
  const { data, mutate } = useApi<{ hasProfile: boolean; deck: P[] }>("/api/dating");
  const { data: m, mutate: mutateMatches } = useApi<Matches>("/api/dating/matches");
  const [matchWith, setMatchWith] = useState<P | null>(null);
  const [tab, setTab] = useState<"deck" | "matches">("deck");
  const deck = data?.deck ?? [];
  const top = deck[0];

  async function swipe(a: "like" | "pass") {
    if (!top) return;
    const rest = deck.slice(1);
    mutate({ hasProfile: data!.hasProfile, deck: rest }, { revalidate: false });
    const r = await api<{ matched: boolean }>("/api/dating/swipe", { method: "POST", json: { targetId: top.userId, action: a } });
    if (r.matched) {
      setMatchWith(top);
      mutateMatches();
    }
  }

  return (
    <Shell back title="Dating" right={<button className="rounded-full bg-[#e4e6eb] p-2"><Settings2 size={18} /></button>}>
      <div className="flex gap-2 px-4 pt-3">
        <button onClick={() => setTab("deck")} className={cx("flex-1 rounded-full py-2 text-[15px] font-semibold", tab === "deck" ? "bg-pink-500 text-white" : "bg-white")}>Discover</button>
        <button onClick={() => setTab("matches")} className={cx("flex-1 rounded-full py-2 text-[15px] font-semibold", tab === "matches" ? "bg-pink-500 text-white" : "bg-white")}>Matches {m?.matches.length ? `(${m.matches.length})` : ""}</button>
      </div>
      {tab === "deck" && (
        <div className="px-4 py-4">
          {!data?.hasProfile && <div className="mb-3 rounded-xl bg-white p-3 text-[14px]"><Sparkles size={16} className="mb-1 text-pink-500" /> You don&apos;t have a Dating profile yet. You can still browse. Likes won&apos;t match until you create one.</div>}
          {top ? <CardView key={top.userId} p={top} onSwipe={swipe} /> : <div className="rounded-2xl bg-white py-20 text-center text-ink-2">You&apos;ve seen everyone nearby. Check back tomorrow.</div>}
        </div>
      )}
      {tab === "matches" && (
        <div className="mt-3 bg-white px-4 py-3">
          {m?.likedYou && m.likedYou.length > 0 && (
            <>
              <h3 className="text-[17px] font-bold">Liked you</h3>
              <div className="no-scrollbar mt-2 flex gap-3 overflow-x-auto pb-2">
                {m.likedYou.map((u) => (
                  <div key={u.id} className="w-24 shrink-0 text-center">
                    <div className="aspect-[3/4] overflow-hidden rounded-xl"><Photo src={u.photo ?? u.avatar} className="h-full w-full object-cover" /></div>
                    <div className="mt-1 truncate text-[13px] font-semibold">{u.name.split(" ")[0]}</div>
                  </div>
                ))}
              </div>
            </>
          )}
          <h3 className="mt-3 text-[17px] font-bold">Matches</h3>
          {m?.matches.length === 0 && <div className="py-8 text-center text-ink-2">No matches yet. Keep swiping.</div>}
          {m?.matches.map((u) => (
            <div key={u.id} className="flex items-center gap-3 py-2">
              <Avatar src={u.avatar} name={u.name} size={56} />
              <div className="flex-1"><div className="text-[15px] font-semibold">{u.name}, {u.age}</div><div className="text-[13px] text-ink-2">You matched</div></div>
              <Button variant="secondary" onClick={async () => { const { id } = await api<{ id: string }>(`/api/conversations/with/${u.id}`, { method: "POST" }); location.href = `/messages/${id}`; }}><MessageCircle size={16} /> Chat</Button>
            </div>
          ))}
        </div>
      )}
      {matchWith && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-pink-600 to-purple-700 p-8 text-center text-white">
          <div className="pop text-[34px] font-extrabold">It&apos;s a match!</div>
          <div className="mt-6 flex -space-x-6">
            <span className="rounded-full border-4 border-white"><Photo src={matchWith.photos[0]} className="h-32 w-32 rounded-full object-cover" /></span>
          </div>
          <div className="mt-4 text-[17px]">You and {matchWith.name} liked each other.</div>
          <Button className="mt-8 w-full bg-white text-pink-600 hover:bg-white" onClick={async () => { const { id } = await api<{ id: string }>(`/api/conversations/with/${matchWith.userId}`, { method: "POST" }); location.href = `/messages/${id}`; }}>Say hi</Button>
          <button onClick={() => setMatchWith(null)} className="mt-4 text-[15px] font-semibold opacity-90">Keep swiping</button>
        </div>
      )}
    </Shell>
  );
}

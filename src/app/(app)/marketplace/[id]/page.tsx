"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Bookmark, MessageCircle, Share2 } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Avatar, Button, Photo, cx } from "@/components/ui";
import { api, useApi } from "@/lib/api";
import { money, timeAgo } from "@/lib/format";
import { useSession } from "@/lib/session";
import type { Listing } from "@/types";

type L = Listing & { seller: { id: string; name: string; avatar: string; joined: string; location: string }; saved: boolean; similar: (Listing & { seller: { name: string } })[] };

export default function ListingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useSession();
  const { data: l, mutate } = useApi<L>(`/api/marketplace/${id}`);
  const [img, setImg] = useState(0);
  const [msg, setMsg] = useState("Hi, is this still available?");
  const [sent, setSent] = useState(false);
  if (!l) return <Shell back title="Listing"><div className="skeleton h-96" /></Shell>;
  const mine = l.seller.id === userId;

  async function message() {
    const { id: cid } = await api<{ id: string }>(`/api/conversations/with/${l!.seller.id}`, { method: "POST" });
    await api(`/api/conversations/${cid}/messages`, { method: "POST", json: { text: msg, attachment: { type: "listing", ref: l!.id } } });
    setSent(true);
    setTimeout(() => router.push(`/messages/${cid}`), 600);
  }

  return (
    <Shell back title="" right={<button className="rounded-full p-2"><Share2 size={20} /></button>}>
      <div className="bg-white">
        <div className="relative aspect-square bg-black">
          <Photo src={l.images[img]} className="h-full w-full object-contain" />
          {l.images.length > 1 && (
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
              {l.images.map((_, i) => (
                <button key={i} onClick={() => setImg(i)} className={cx("h-2 w-2 rounded-full", i === img ? "bg-white" : "bg-white/40")} />
              ))}
            </div>
          )}
        </div>
        <div className="px-4 pt-3">
          <h1 className="text-[20px] font-bold leading-tight">{l.title}</h1>
          <div className="mt-1 text-[18px] font-semibold">{money(l.price)}</div>
          <div className="text-[13px] text-ink-2">Listed {timeAgo(l.createdAt, false)} in {l.location}</div>
          {l.status !== "available" && <div className="mt-1 inline-block rounded bg-[#e4e6eb] px-2 py-0.5 text-[12px] font-bold uppercase">{l.status}</div>}
        </div>
        {!mine && (
          <div className="px-4 pt-3">
            <div className="flex items-center gap-2 rounded-full border border-line/80 px-3 py-1.5">
              <input value={msg} onChange={(e) => setMsg(e.target.value)} className="flex-1 text-[15px] outline-none" />
              <Button onClick={message} className="rounded-full px-4 py-1.5" disabled={sent}>
                {sent ? "Sent ✓" : "Send"}
              </Button>
            </div>
          </div>
        )}
        <div className="flex gap-2 px-4 py-3">
          {!mine && (
            <Button className="flex-1" onClick={message}>
              <MessageCircle size={18} /> Message
            </Button>
          )}
          <Button variant="secondary" className={cx("flex-1", l.saved && "text-fb")} onClick={async () => { await api(`/api/marketplace/${l.id}/save`, { method: "POST" }); mutate(); }}>
            <Bookmark size={18} className={cx(l.saved && "fill-fb")} /> {l.saved ? "Saved" : "Save"}
          </Button>
        </div>
      </div>

      <div className="mt-2 bg-white px-4 py-3">
        <h2 className="text-[17px] font-bold">Details</h2>
        <div className="mt-2 grid grid-cols-[110px_1fr] gap-y-1 text-[15px]">
          <span className="text-ink-2">Condition</span><span>{l.condition}</span>
          <span className="text-ink-2">Category</span><span>{l.category}</span>
        </div>
        <p className="mt-3 text-[15px] leading-snug whitespace-pre-wrap">{l.description}</p>
      </div>

      <div className="mt-2 bg-white px-4 py-3">
        <h2 className="text-[17px] font-bold">Seller information</h2>
        <Link href={`/profile/${l.seller.id}`} className="mt-2 flex items-center gap-3">
          <Avatar src={l.seller.avatar} name={l.seller.name} size={48} />
          <div>
            <div className="text-[15px] font-semibold">{l.seller.name}</div>
            <div className="text-[13px] text-ink-2">Joined Facebook in {new Date(l.seller.joined).getFullYear()} · {l.seller.location}</div>
          </div>
        </Link>
      </div>

      {l.similar.length > 0 && (
        <div className="mt-2 bg-white px-4 py-3">
          <h2 className="mb-2 text-[17px] font-bold">Similar listings</h2>
          <div className="grid grid-cols-2 gap-3">
            {l.similar.map((s) => (
              <Link key={s.id} href={`/marketplace/${s.id}`}>
                <Photo src={s.images[0]} className="aspect-square w-full rounded-lg object-cover" />
                <div className="mt-1 text-[15px] font-semibold">{money(s.price)}</div>
                <div className="truncate text-[13px]">{s.title}</div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </Shell>
  );
}

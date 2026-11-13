"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { GameCard, GamePlayer, GameTray, type Finished } from "@/components/DeepCuts";
import { useMe } from "@/components/Shell";
import { ArrowLeft, Image as ImageIcon, Info, Phone, Plus, Send, Smile, ThumbsUp, Video } from "lucide-react";
import { Avatar, Photo, cx } from "@/components/ui";
import { api, refresh, useApi } from "@/lib/api";
import { messageTime } from "@/lib/format";
import { useSession } from "@/lib/session";
import type { Conversation, Listing, Message } from "@/types";

type Card = { id: string; name: string; avatar: string };
type Conv = Conversation & { name: string; participants: Card[]; others: Card[] };

function ListingChip({ id }: { id: string }) {
  const { data } = useApi<Listing>(`/api/marketplace/${id}`);
  if (!data) return null;
  return (
    <Link href={`/marketplace/${id}`} className="mb-1 flex w-60 items-center gap-2 overflow-hidden rounded-xl border border-line/60 bg-white">
      <Photo src={data.images[0]} className="h-16 w-16 object-cover" />
      <div className="min-w-0 pr-2"><div className="truncate text-[13px] font-semibold text-ink">{data.title}</div><div className="text-[13px] text-ink-2">${data.price}</div></div>
    </Link>
  );
}

export default function ThreadPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useSession();
  const { data: c, mutate } = useApi<Conv>(`/api/conversations/${id}`, { poll: 1500 });
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const count = c?.messages.length ?? 0;
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [count]);
  useEffect(() => {
    refresh("/api/me");
  }, [count]);

  async function send(body = text, attachment?: Message["attachment"]) {
    if ((!body.trim() && !attachment) || !c) return;
    setSending(true);
    if (!attachment) setText("");
    const optimistic = { id: `tmp_${Date.now()}`, senderId: userId, text: body, createdAt: new Date().toISOString(), readBy: [userId], attachment };
    mutate({ ...c, messages: [...c.messages, optimistic] }, { revalidate: false });
    await api(`/api/conversations/${c.id}/messages`, { method: "POST", json: { text: body, attachment } });
    await mutate();
    refresh("/api/conversations");
    setSending(false);
  }

  // ---------- Deep Cuts ----------
  const { data: me } = useMe();
  const [tray, setTray] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const closeGame = useCallback(() => setPlaying(null), []);
  const sendRef = useRef(send);
  sendRef.current = send;
  const finished = useCallback((f: Finished) => {
    // GamePigeon style: a quiet "Maya played … · score" line, not a new card
    if (f.text && f.ref) return void sendRef.current(f.text, { type: "gamelog", ref: f.ref });
    const players = f.players ?? 1;
    const place = players > 1 ? (f.rank === 1 ? " and took the lead" : ` (#${f.rank} of ${players})`) : "";
    void sendRef.current(`${f.icon} I reached ${f.reached} in ${f.title}${place}`, { type: "game", ref: f.room ?? "" });
  }, []);

  const byId = Object.fromEntries((c?.participants ?? []).map((p) => [p.id, p]));
  const other = c?.others[0];

  return (
    <div className="relative flex h-full flex-col bg-white">
      <header className="safe-top sticky top-0 z-10 border-b border-line/60 bg-white">
        <div className="flex h-14 items-center gap-2 px-2">
          <button onClick={() => router.back()} className="rounded-full p-2 text-messenger"><ArrowLeft size={22} /></button>
          {c && (
            <Link href={c.isGroup ? "#" : `/profile/${other?.id}`} className="flex min-w-0 flex-1 items-center gap-2">
              <Avatar src={c.isGroup ? c.others[0]?.avatar : other?.avatar} name={c.name} size={36} online={!c.isGroup} />
              <div className="min-w-0">
                <div className="truncate text-[16px] font-semibold leading-tight">{c.name}</div>
                <div className="text-[12px] text-ink-2">{c.isGroup ? `${c.participantIds.length} people` : "Active now"}</div>
              </div>
            </Link>
          )}
          <button className="p-2 text-messenger"><Phone size={22} /></button>
          <button className="p-2 text-messenger"><Video size={24} /></button>
          <button className="p-2 text-messenger"><Info size={22} /></button>
        </div>
      </header>

      <div className="flex-1 px-3 py-3">
        {c?.messages.map((m, i) => {
          const mine = m.senderId === userId;
          const prev = c.messages[i - 1];
          const next = c.messages[i + 1];
          const gap = !prev || new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() > 30 * 60e3;
          const firstOfRun = !prev || prev.senderId !== m.senderId || gap;
          const lastOfRun = !next || next.senderId !== m.senderId;
          const sender = byId[m.senderId];
          if (m.attachment?.type === "gamelog")
            return (
              <div key={m.id} className="my-2 flex justify-center">
                <button onClick={() => setPlaying(m.attachment!.ref)} className="max-w-[85%] rounded-full bg-[#f0f2f5] px-3 py-1 text-center text-[12px] text-ink-2">
                  🎮 <b className="font-semibold text-ink">{mine ? "You" : (sender?.name.split(" ")[0] ?? "Someone")}</b> {m.text}
                </button>
              </div>
            );
          return (
            <div key={m.id}>
              {gap && <div className="my-3 text-center text-[11px] font-semibold text-ink-2 uppercase">{messageTime(m.createdAt)}</div>}
              {c.isGroup && !mine && firstOfRun && <div className="mb-0.5 ml-10 text-[11px] text-ink-2">{sender?.name.split(" ")[0]}</div>}
              <div className={cx("flex items-end gap-2", mine ? "justify-end" : "justify-start", lastOfRun ? "mb-2" : "mb-0.5")}>
                {!mine && <span className="w-7 shrink-0">{lastOfRun && sender && <Avatar src={sender.avatar} name={sender.name} size={28} />}</span>}
                <div className={cx("flex max-w-[75%] flex-col", mine ? "items-end" : "items-start")}>
                  {m.attachment?.type === "listing" && <ListingChip id={m.attachment.ref} />}
                  {m.attachment?.type === "image" && <Photo src={m.attachment.ref} className="mb-1 max-h-60 rounded-2xl object-cover" />}
                  {m.attachment?.type === "game" && <GameCard roomId={m.attachment.ref} userId={userId} onOpen={setPlaying} />}
                  {m.text && !(m.attachment?.type === "game" && m.text.startsWith("🎮")) && (
                    <div
                      className={cx(
                        "px-3 py-2 text-[15px] leading-snug break-words whitespace-pre-wrap",
                        mine ? "bg-messenger text-white" : "bg-[#f0f0f0] text-ink",
                        "rounded-[18px]",
                        mine ? (firstOfRun ? "" : "rounded-tr-md") + (lastOfRun ? "" : " rounded-br-md") : (firstOfRun ? "" : "rounded-tl-md") + (lastOfRun ? "" : " rounded-bl-md"),
                      )}
                    >
                      {m.text}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {c && c.messages.length > 0 && c.messages.at(-1)!.senderId === userId && (
          <div className="mr-1 text-right text-[11px] text-ink-2">{(c.messages.at(-1)!.readBy?.length ?? 1) > 1 ? "Seen" : "Delivered"}</div>
        )}
        <div ref={bottom} />
      </div>

      <div className="safe-bottom sticky bottom-0 flex items-center gap-1 border-t border-line/60 bg-white px-2 py-2">
        <button onClick={() => setTray(true)} className="p-1.5 text-messenger" aria-label="Games"><Plus size={24} /></button>
        <button className="p-1.5 text-messenger"><ImageIcon size={22} /></button>
        <div className="flex flex-1 items-center rounded-full bg-[#f0f2f5] pr-2">
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Aa" className="flex-1 bg-transparent px-3 py-2 text-[15px] outline-none" />
          <Smile size={20} className="text-messenger" />
        </div>
        {text.trim() ? (
          <button onClick={() => send()} disabled={sending} className="p-1.5 text-messenger"><Send size={24} /></button>
        ) : (
          <button onClick={() => send("👍")} className="p-1.5 text-messenger"><ThumbsUp size={24} className="fill-messenger" /></button>
        )}
      </div>

      {tray && (
        <GameTray
          onClose={() => setTray(false)}
          onCreate={(ref, interest, game) => {
            setTray(false);
            void send(`🎮 ${game === "orderup" ? "Order Up!" : "Deep Cuts"}: ${interest}`, { type: "game", ref });
          }}
        />
      )}
      {playing && <GamePlayer roomId={playing} userId={userId} name={me?.name.split(" ")[0] ?? userId} onClose={closeGame} onFinished={finished} />}
    </div>
  );
}

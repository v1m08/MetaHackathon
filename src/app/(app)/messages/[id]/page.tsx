"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Compass, Image as ImageIcon, Info, Pencil, Phone, Plus, Send, Smile, ThumbsUp, Trash2, Video } from "lucide-react";
import { Avatar, Photo, cx } from "@/components/ui";
import { api, refresh, useApi } from "@/lib/api";
import { messageTime } from "@/lib/format";
import { useSession } from "@/lib/session";
import { useMe } from "@/components/Shell";
import type { Conversation, Listing } from "@/types";

type Card = { id: string; name: string; avatar: string; city?: string; openToHosting?: boolean };
type Conv = Conversation & { name: string; participants: Card[]; others: Card[] };

function DraftBubble({ m, onDone }: { m: Conversation["messages"][number]; onDone: () => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(m.text);
  const [busy, setBusy] = useState(false);
  const act = async (action: "approve" | "edit" | "discard") => {
    setBusy(true);
    try {
      await api(`/api/travel/drafts/${m.id}`, { method: "POST", json: { action, text } });
      setEditing(false);
      onDone();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="my-2 ml-auto w-[88%] rounded-2xl border border-amber-300 bg-amber-50 p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800"><Compass size={12} /> Drafted by your trip agent · awaiting your approval</div>
      {m.draftReason && <div className="mt-0.5 text-[12px] text-amber-900/80">{m.draftReason}</div>}
      {editing ? (
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-amber-300 bg-white p-2 text-[15px] outline-none" />
      ) : (
        <div className="mt-2 rounded-[18px] bg-messenger px-3 py-2 text-[15px] leading-snug whitespace-pre-wrap text-white">{text}</div>
      )}
      <div className="mt-2 flex gap-2">
        {editing ? (
          <button disabled={busy} onClick={() => act("edit")} className="flex-1 rounded-full bg-amber-600 py-1.5 text-[13px] font-semibold text-white">Save</button>
        ) : (
          <button disabled={busy} onClick={() => act("approve")} className="flex flex-1 items-center justify-center gap-1 rounded-full bg-messenger py-1.5 text-[13px] font-semibold text-white"><Check size={14} /> Approve &amp; send</button>
        )}
        <button disabled={busy} onClick={() => setEditing((v) => !v)} className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold text-ink"><Pencil size={14} /> {editing ? "Cancel" : "Edit"}</button>
        <button disabled={busy} onClick={() => act("discard")} className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold text-red-600"><Trash2 size={14} /></button>
      </div>
      <div className="mt-1.5 text-[11px] text-amber-900/70">Nothing is sent until you approve. Sending stays inside this app.</div>
    </div>
  );
}

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
  const { data: me } = useMe();
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

  async function send(body = text) {
    if (!body.trim() || !c) return;
    setSending(true);
    setText("");
    const optimistic = { id: `tmp_${Date.now()}`, senderId: userId, text: body, createdAt: new Date().toISOString(), readBy: [userId] };
    mutate({ ...c, messages: [...c.messages, optimistic] }, { revalidate: false });
    await api(`/api/conversations/${c.id}/messages`, { method: "POST", json: { text: body } });
    await mutate();
    refresh("/api/conversations");
    setSending(false);
  }

  const byId = Object.fromEntries((c?.participants ?? []).map((p) => [p.id, p]));
  const other = c?.others[0];

  return (
    <div className="flex h-full flex-col bg-white">
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
        {c && !c.isGroup && other?.city && me?.city && other.city !== me.city && (
          <Link href={`/travel?hint=${encodeURIComponent(`I want to visit ${other.name.split(" ")[0]}`)}`} className="mx-auto mb-3 flex w-fit items-center gap-2 rounded-full border border-line bg-[#f0f2f5] px-3 py-1.5 text-[13px]">
            <Compass size={14} className="text-fb" /> <span><b className="font-semibold">{other.name.split(" ")[0]}</b> lives in another city{other.openToHosting ? " and is open to hosting" : ""} · <span className="font-semibold text-fb">plan a trip</span></span>
          </Link>
        )}
        {c?.messages.map((m, i) => {
          const mine = m.senderId === userId;
          const prev = c.messages[i - 1];
          const next = c.messages[i + 1];
          const gap = !prev || new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() > 30 * 60e3;
          const firstOfRun = !prev || prev.senderId !== m.senderId || gap;
          const lastOfRun = !next || next.senderId !== m.senderId;
          const sender = byId[m.senderId];
          if (m.status === "draft") return <DraftBubble key={m.id} m={m} onDone={() => { mutate(); refresh("/api/conversations"); }} />;
          return (
            <div key={m.id}>
              {gap && <div className="my-3 text-center text-[11px] font-semibold text-ink-2 uppercase">{messageTime(m.createdAt)}</div>}
              {c.isGroup && !mine && firstOfRun && <div className="mb-0.5 ml-10 text-[11px] text-ink-2">{sender?.name.split(" ")[0]}</div>}
              <div className={cx("flex items-end gap-2", mine ? "justify-end" : "justify-start", lastOfRun ? "mb-2" : "mb-0.5")}>
                {!mine && <span className="w-7 shrink-0">{lastOfRun && sender && <Avatar src={sender.avatar} name={sender.name} size={28} />}</span>}
                <div className={cx("flex max-w-[75%] flex-col", mine ? "items-end" : "items-start")}>
                  {m.attachment?.type === "listing" && <ListingChip id={m.attachment.ref} />}
                  {m.attachment?.type === "image" && <Photo src={m.attachment.ref} className="mb-1 max-h-60 rounded-2xl object-cover" />}
                  {m.text && (
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

      <div className="sticky bottom-0 flex items-center gap-1 border-t border-line/60 bg-white px-2 py-2">
        <button className="p-1.5 text-messenger"><Plus size={24} /></button>
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
    </div>
  );
}

"use client";
// Multi-surface post-game popup in Messenger: after you finish a Sidequest game and close it, Muse slides up in the
// Hangout card style with the best matching picks across Facebook Groups (40+), Events (60+), and Marketplace (75+).
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bookmark, Calendar, Check, Send, ShoppingBag, Star, Users, X } from "lucide-react";
import { MuseHost } from "@/components/hangout/MuseHost";
import { Photo, cx } from "@/components/ui";
import { api, refresh } from "@/lib/api";
import type { ChatPickItem, ChatPicks, ChatPicksResult, EventChatPick, GroupChatPick, ListingChatPick } from "@/lib/events/chatPicks";
import type { RsvpStatus } from "@/lib/events/forChat";
import { eventDate, money } from "@/lib/format";
import "./event-picks.css";

const HOST_IMAGE = "/seed/muse/host-plush.webp";

export function EventPicksSheet({
  conversationId,
  gameRef,
  onClose,
  onSend,
}: {
  conversationId: string;
  gameRef: string;
  onClose: () => void;
  onSend: (item: ChatPickItem) => Promise<void> | void;
}) {
  const [data, setData] = useState<ChatPicks | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => setHost(document.querySelector<HTMLElement>(".phone") ?? document.body), []);

  // GET has no side effects (React dev double-run safe); POST records it as shown once displayed.
  useEffect(() => {
    let live = true;
    api<ChatPicksResult>(`/api/conversations/${conversationId}/chat-picks?ref=${encodeURIComponent(gameRef)}`)
      .then((r) => {
        if (!live) return;
        if (r.show) setData(r);
        else closeRef.current();
      })
      .catch(() => live && closeRef.current());
    return () => {
      live = false;
    };
  }, [conversationId, gameRef]);

  useEffect(() => {
    if (data) void api(`/api/conversations/${conversationId}/chat-picks`, { method: "POST", json: { ref: gameRef } }).catch(() => {});
  }, [data, conversationId, gameRef]);

  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    addEventListener("keydown", on);
    return () => removeEventListener("keydown", on);
  }, []);

  if (!host || !data) return null;
  const close = () => closeRef.current();
  const inFrame = host !== document.body;
  const unlockedLabel =
    data.unlockedTier === "listing"
      ? "Marketplace unlocked"
      : data.unlockedTier === "event"
        ? "Events unlocked"
        : data.unlockedTier === "group"
          ? "Groups unlocked"
          : data.isGroup
            ? "Picked for the chat"
            : "Picked for you two";

  return createPortal(
    <div className={cx(inFrame ? "absolute" : "fixed", "ep-sheet inset-0 z-[70] flex flex-col justify-end")} role="dialog" aria-modal="true" aria-label="Picked from your games">
      <div className="fadein absolute inset-0 bg-black/50" onClick={close} />
      <div className="slideup relative max-h-[88%] overflow-y-auto rounded-t-3xl bg-gradient-to-b from-[#FFF3E2] to-[#FFF9F1] px-3.5 pt-3.5 pb-[max(14px,env(safe-area-inset-bottom))]">
        <button onClick={close} aria-label="Close" className="absolute top-3 right-3 grid h-8 w-8 place-items-center rounded-full bg-white/80 text-ink-2">
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 pr-9">
          <MuseHost size={42} image={HOST_IMAGE} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold tracking-wide text-messenger uppercase">{unlockedLabel}</span>
              {data.streak.days > 0 && (
                <span className="rounded-full bg-orange-100 px-2 py-[1px] text-[10.5px] font-bold text-orange-700">
                  🔥 {data.streak.days}d
                </span>
              )}
            </div>
            <div className="mt-0.5 text-[13.5px] font-medium leading-snug text-ink">{data.muse}</div>
          </div>
        </div>

        <div className="mt-2.5 space-y-2">
          {data.items.map((item) =>
            item.kind === "event" ? (
              <EventCard key={`ev_${item.id}`} p={item} onSend={onSend} onGoing={close} />
            ) : item.kind === "group" ? (
              <GroupCard key={`grp_${item.id}`} p={item} onSend={onSend} />
            ) : (
              <ListingCard key={`lst_${item.id}`} p={item} onSend={onSend} />
            ),
          )}
        </div>

        <button onClick={close} className="mt-2 w-full py-2 text-[14px] font-semibold text-ink-2">
          Not now
        </button>
      </div>
    </div>,
    host,
  );
}

const btnCls = "flex items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold";

function EventCard({ p, onSend, onGoing }: { p: EventChatPick; onSend: (i: ChatPickItem) => Promise<void> | void; onGoing: () => void }) {
  const [status, setStatus] = useState<RsvpStatus>(p.myStatus);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const rsvp = async (s: Exclude<RsvpStatus, "none">) => {
    const was = status;
    const next = status === s ? "none" : s;
    setStatus(next);
    try {
      await api(`/api/events/${p.id}/rsvp`, { method: "POST", json: { status: next } });
      refresh("/api/events");
      if (next === "going") onGoing();
    } catch {
      setStatus(was);
    }
  };
  const send = async () => {
    if (sent || busy) return;
    setBusy(true);
    try {
      await onSend(p);
      setSent(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white p-2.5 shadow-sm">
      <Link href={`/events/${p.id}`} className="flex gap-2.5">
        <Photo src={p.cover} className="h-14 w-14 shrink-0 rounded-xl bg-[#f0f2f5] object-cover" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-0.5 rounded bg-red-50 px-1.5 py-[1px] text-[10px] font-bold text-red-600 uppercase">
              <Calendar size={10} /> Event
            </span>
            <span className="truncate text-[11px] font-semibold text-red-600 uppercase">{eventDate(p.startsAt)}</span>
          </div>
          <div className="mt-0.5 truncate text-[14.5px] leading-tight font-semibold text-ink">{p.title}</div>
          <div className="truncate text-[11.5px] text-ink-2">{p.why || p.location}</div>
        </div>
      </Link>
      <div className="mt-2 flex gap-1.5">
        {p.canSend && (
          <button onClick={send} disabled={busy || sent} className={cx(btnCls, "flex-1", sent ? "bg-[#e7f3ff] text-messenger" : "bg-messenger text-white")}>
            {sent ? <><Check size={14} /> Sent</> : <><Send size={13} /> Send to chat</>}
          </button>
        )}
        <button onClick={() => rsvp("going")} aria-pressed={status === "going"} className={cx(btnCls, !p.canSend && "flex-1", status === "going" ? "bg-[#e7f3ff] text-messenger" : "bg-[#e4e6eb] text-ink")}>
          <Check size={14} /> Going
        </button>
        <button onClick={() => rsvp("interested")} aria-pressed={status === "interested"} className={cx(btnCls, status === "interested" ? "bg-[#e7f3ff] text-messenger" : "bg-[#e4e6eb] text-ink")}>
          <Star size={13} className={status === "interested" ? "fill-messenger" : ""} /> Interested
        </button>
      </div>
    </div>
  );
}

function GroupCard({ p, onSend }: { p: GroupChatPick; onSend: (i: ChatPickItem) => Promise<void> | void }) {
  const [joined, setJoined] = useState(p.joined);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const toggleJoin = async () => {
    const was = joined;
    setJoined(!was);
    try {
      await api(`/api/groups/${p.id}/join`, { method: "POST" });
      refresh("/api/groups");
    } catch {
      setJoined(was);
    }
  };
  const send = async () => {
    if (sent || busy) return;
    setBusy(true);
    try {
      await onSend(p);
      setSent(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white p-2.5 shadow-sm">
      <Link href={`/groups/${p.id}`} className="flex gap-2.5">
        <Photo src={p.cover} className="h-14 w-14 shrink-0 rounded-xl bg-[#f0f2f5] object-cover" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-0.5 rounded bg-indigo-50 px-1.5 py-[1px] text-[10px] font-bold text-indigo-600 uppercase">
              <Users size={10} /> Group
            </span>
            <span className="truncate text-[11px] font-medium text-ink-2">{p.memberCount} members</span>
          </div>
          <div className="mt-0.5 truncate text-[14.5px] leading-tight font-semibold text-ink">{p.name}</div>
          <div className="truncate text-[11.5px] text-ink-2">{p.why}</div>
        </div>
      </Link>
      <div className="mt-2 flex gap-1.5">
        {p.canSend && (
          <button onClick={send} disabled={busy || sent} className={cx(btnCls, "flex-1", sent ? "bg-[#e7f3ff] text-messenger" : "bg-messenger text-white")}>
            {sent ? <><Check size={14} /> Sent</> : <><Send size={13} /> Send to chat</>}
          </button>
        )}
        <button onClick={toggleJoin} aria-pressed={joined} className={cx(btnCls, !p.canSend && "flex-1", joined ? "bg-[#e7f3ff] text-messenger" : "bg-[#e4e6eb] text-ink")}>
          {joined ? <><Check size={14} /> Joined</> : <><Users size={13} /> Join group</>}
        </button>
      </div>
    </div>
  );
}

function ListingCard({ p, onSend }: { p: ListingChatPick; onSend: (i: ChatPickItem) => Promise<void> | void }) {
  const [saved, setSaved] = useState(p.saved);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const toggleSave = async () => {
    const was = saved;
    setSaved(!was);
    try {
      await api(`/api/marketplace/${p.id}/save`, { method: "POST" });
      refresh("/api/marketplace");
    } catch {
      setSaved(was);
    }
  };
  const send = async () => {
    if (sent || busy) return;
    setBusy(true);
    try {
      await onSend(p);
      setSent(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white p-2.5 shadow-sm">
      <Link href={`/marketplace/${p.id}`} className="flex gap-2.5">
        <Photo src={p.image} className="h-14 w-14 shrink-0 rounded-xl bg-[#f0f2f5] object-cover" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-0.5 rounded bg-emerald-50 px-1.5 py-[1px] text-[10px] font-bold text-emerald-700 uppercase">
              <ShoppingBag size={10} /> Marketplace
            </span>
            <span className="text-[12px] font-bold text-ink">{money(p.price)}</span>
          </div>
          <div className="mt-0.5 truncate text-[14.5px] leading-tight font-semibold text-ink">{p.title}</div>
          <div className="truncate text-[11.5px] text-ink-2">{p.why || p.location}</div>
        </div>
      </Link>
      <div className="mt-2 flex gap-1.5">
        {p.canSend && (
          <button onClick={send} disabled={busy || sent} className={cx(btnCls, "flex-1", sent ? "bg-[#e7f3ff] text-messenger" : "bg-messenger text-white")}>
            {sent ? <><Check size={14} /> Sent</> : <><Send size={13} /> Send to chat</>}
          </button>
        )}
        <button onClick={toggleSave} aria-pressed={saved} className={cx(btnCls, !p.canSend && "flex-1", saved ? "bg-[#e7f3ff] text-messenger" : "bg-[#e4e6eb] text-ink")}>
          <Bookmark size={13} className={saved ? "fill-messenger" : ""} /> {saved ? "Saved" : "Save"}
        </button>
      </div>
    </div>
  );
}

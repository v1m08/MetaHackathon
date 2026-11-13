"use client";
// Event unlock popup, in the Hangout card look: after you finish a game and close it, Muse suggests upcoming events for
// the chat. Whether it shows (closeness, fit, once a day) is decided on the server in src/lib/events/forChat.ts.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Send, Star, X } from "lucide-react";
import { MuseHost } from "@/components/hangout/MuseHost";
import { Photo, cx } from "@/components/ui";
import { api, refresh } from "@/lib/api";
import type { EventPick, EventPicks, EventPicksResult, RsvpStatus } from "@/lib/events/forChat";
import { eventDate } from "@/lib/format";
import "./event-picks.css";

const HOST_IMAGE = "/seed/muse/host-plush.webp";

export function EventPicksSheet({ conversationId, gameRef, onClose, onSend }: { conversationId: string; gameRef: string; onClose: () => void; onSend: (e: EventPick) => Promise<void> | void }) {
  const [data, setData] = useState<EventPicks | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => setHost(document.querySelector<HTMLElement>(".phone") ?? document.body), []);

  // GET has no side effects, so a double-run effect in dev is harmless; the POST below records it as shown.
  useEffect(() => {
    let live = true;
    api<EventPicksResult>(`/api/conversations/${conversationId}/event-picks?ref=${encodeURIComponent(gameRef)}`)
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
    if (data) void api(`/api/conversations/${conversationId}/event-picks`, { method: "POST", json: { ref: gameRef } }).catch(() => {});
  }, [data, conversationId, gameRef]);
  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    addEventListener("keydown", on);
    return () => removeEventListener("keydown", on);
  }, []);

  if (!host || !data) return null;
  const close = () => closeRef.current();
  const inFrame = host !== document.body;
  return createPortal(
    <div className={cx(inFrame ? "absolute" : "fixed", "ep-sheet inset-0 z-[70] flex flex-col justify-end")} role="dialog" aria-modal="true" aria-label="Events for this chat">
      <div className="fadein absolute inset-0 bg-black/50" onClick={close} />
      <div className="slideup relative max-h-[85%] overflow-y-auto rounded-t-3xl bg-gradient-to-b from-[#FFF3E2] to-[#FFF9F1] px-4 pt-4 pb-[max(16px,env(safe-area-inset-bottom))]">
        <button onClick={close} aria-label="Close" className="absolute top-3 right-3 grid h-8 w-8 place-items-center rounded-full bg-white/80 text-ink-2">
          <X size={18} />
        </button>
        <div className="text-[12px] font-bold tracking-wide text-messenger uppercase">{data.unlocked ? "Events unlocked" : data.isGroup ? "Picked for the chat" : "Picked for you two"}</div>
        <div className="mt-2 flex items-start gap-2 pr-8">
          <div className="shrink-0">
            <MuseHost size={56} image={HOST_IMAGE} />
          </div>
          <div className="mt-1 rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-[14px] leading-snug shadow-sm">{data.muse}</div>
        </div>
        <div className="mt-2 inline-flex max-w-full items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-[12px] text-ink-2">
          <span className="truncate">{data.game.title}</span>
          {data.streak.days > 0 && (
            <>
              <span>·</span>
              <span className="shrink-0">{data.streak.days}-day streak</span>
            </>
          )}
        </div>
        <div className="mt-3 space-y-2">
          {data.picks.map((p) => (
            <PickCard key={p.id} p={p} onSend={onSend} onGoing={close} />
          ))}
        </div>
        <button onClick={close} className="mt-2 w-full py-2.5 text-[15px] font-semibold text-ink-2">
          Not now
        </button>
      </div>
    </div>,
    host,
  );
}

function PickCard({ p, onSend, onGoing }: { p: EventPick; onSend: (e: EventPick) => Promise<void> | void; onGoing: () => void }) {
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
      // Going is the answer to the popup, so it closes once the RSVP is saved.
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
  const toggle = "flex items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold";
  return (
    <div className="rounded-2xl bg-white p-2.5 shadow-sm">
      <Link href={`/events/${p.id}`} className="flex gap-2.5">
        <Photo src={p.cover} className="h-16 w-16 shrink-0 rounded-xl object-cover" />
        <div className="min-w-0">
          <div className="truncate text-[11px] font-semibold text-red-600 uppercase">{eventDate(p.startsAt)}</div>
          <div className="truncate text-[15px] leading-tight font-semibold text-ink">{p.title}</div>
          <div className="truncate text-[12px] text-ink-2">{p.location}</div>
          {p.why && <div className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-ink-2">{p.why}</div>}
        </div>
      </Link>
      <div className="mt-2 flex gap-1.5">
        {p.canSend && (
          <button onClick={send} disabled={busy || sent} className={cx(toggle, "flex-1", sent ? "bg-[#e7f3ff] text-messenger" : "bg-messenger text-white")}>
            {sent ? <><Check size={15} /> Sent</> : <><Send size={14} /> Send to chat</>}
          </button>
        )}
        <button onClick={() => rsvp("going")} aria-pressed={status === "going"} className={cx(toggle, !p.canSend && "flex-1", status === "going" ? "bg-[#e7f3ff] text-messenger" : "bg-[#e4e6eb] text-ink")}>
          <Check size={15} /> Going
        </button>
        <button onClick={() => rsvp("interested")} aria-pressed={status === "interested"} className={cx(toggle, status === "interested" ? "bg-[#e7f3ff] text-messenger" : "bg-[#e4e6eb] text-ink")}>
          <Star size={14} className={status === "interested" ? "fill-messenger" : ""} /> Interested
        </button>
      </div>
    </div>
  );
}

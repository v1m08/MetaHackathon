"use client";
// A recommendation the chat earned, as a card in the thread: one real Event, Group or Marketplace listing, the
// code-checked line of why, and who is in. "I'm in" / "Join" / "Save" go through the server, which does the real
// RSVP / join / save; the card only shows the viewer's own response and the members who said yes.
import Link from "next/link";
import { useState } from "react";
import { Check, LockOpen } from "lucide-react";
import { Photo } from "@/components/ui";
import { api, refresh, useApi } from "@/lib/api";
import type { UnlockView } from "@/lib/play/views";
import { Faces, ModeTag } from "./shared";

const TIER: Record<string, { label: string; yes: string; done: string }> = {
  event: { label: "Event for this chat", yes: "I'm in", done: "you're in" },
  group: { label: "Group to join together", yes: "Join", done: "you joined" },
  listing: { label: "Marketplace pick", yes: "Save", done: "saved" },
};

export function UnlockChip({ id, onChanged }: { id: string; onChanged?: () => void }) {
  const path = `/api/play/unlocks/${id}`;
  const { data: u, error, mutate } = useApi<UnlockView>(path, { poll: 3000 });
  const [busy, setBusy] = useState(false);
  if (!u) return error ? null : <div className="my-3 flex justify-center"><div className="h-52 w-[290px] animate-pulse rounded-2xl bg-[#f0f2f5]" /></div>;
  const T = TIER[u.tier] ?? TIER.event;
  const act = async (action: "in" | "dismiss" | "undo") => {
    setBusy(true);
    try {
      mutate(await api<UnlockView>(path, { method: "POST", json: { action } }), { revalidate: false });
      for (const p of ["/api/events", "/api/groups", "/api/marketplace", "/api/notifications", "/api/play/chat"]) refresh(p);
      onChanged?.();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="my-3 flex justify-center">
      <div className="w-[290px] overflow-hidden rounded-2xl border border-line/60 bg-white text-left text-ink">
        <div className="flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 text-[11.5px] font-semibold text-emerald-800">
          <LockOpen size={13} /> <span className="truncate">Unlocked · {T.label} · {u.topicLabel}</span>
          <ModeTag mode={u.mode} className="ml-auto shrink-0" />
        </div>
        <Link href={u.href} className="block">
          {u.image && <Photo src={u.image} className="h-28 w-full object-cover" />}
          <div className="px-3 pt-2 text-[15px] font-bold leading-tight">{u.title}</div>
          {u.sub && <div className="px-3 pt-0.5 text-[12.5px] leading-snug text-ink-2">{u.sub}</div>}
        </Link>
        {u.why && <div className="mx-3 mt-2 rounded-lg bg-[#f0f2f5] px-2.5 py-1.5 text-[12.5px] leading-snug break-words">{u.why}</div>}
        {u.inMembers.length > 0 && (
          <div className="flex items-center gap-2 px-3 pt-2 text-[12.5px] text-ink-2">
            <Faces people={u.inMembers} size={20} max={5} /> <span className="truncate">{u.inMembers.map((m) => m.first).slice(0, 3).join(", ")}{u.inMembers.length > 3 ? ` +${u.inMembers.length - 3}` : ""} {u.inMembers.length === 1 ? "is" : "are"} in</span>
          </div>
        )}
        <div className="flex items-center gap-2 px-3 py-2">
          {u.my === "in" ? (
            <><span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-emerald-700"><Check size={14} /> {T.done}</span><button disabled={busy} onClick={() => act("undo")} className="ml-auto text-[12px] text-ink-2">undo</button></>
          ) : u.my === "dismiss" ? (
            <><span className="text-[12.5px] text-ink-2">You passed on this one</span><button disabled={busy} onClick={() => act("undo")} className="ml-auto text-[12px] text-ink-2">undo</button></>
          ) : (
            <><button disabled={busy} onClick={() => act("in")} className="flex-1 rounded-lg bg-emerald-600 py-1.5 text-[13px] font-semibold text-white disabled:opacity-50">{T.yes}</button><button disabled={busy} onClick={() => act("dismiss")} className="rounded-lg bg-[#e4e6eb] px-3 py-1.5 text-[13px] font-semibold disabled:opacity-50">Not for us</button></>
          )}
        </div>
      </div>
    </div>
  );
}

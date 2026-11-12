"use client";
// Agent-to-agent negotiation, as the traveler sees it: a live transcript of the asks and answers (anonymous on the
// host side until the reveal), then anonymous fit cards to accept or pass. Also the request cards both roles see.
import Link from "next/link";
import { useState } from "react";
import { Bot, Check, DoorOpen, Eye, MessageCircle, ShieldCheck, X } from "lucide-react";
import { Avatar, Button, cx } from "@/components/ui";
import { api } from "@/lib/api";
import type { NegotiationTurn } from "@/lib/travel/store";

const fmt = (iso: string) => new Date(iso + "T12:00:00").toLocaleString("en-US", { month: "short", day: "numeric" });
export const fmtRange = (s: string, e: string) => `${fmt(s)}–${fmt(e).replace(/^[A-Za-z]+ /, "")}`;

export function TurnList({ turns, live, anonymous }: { turns: NegotiationTurn[]; live?: boolean; anonymous?: boolean }) {
  return (
    <ol className="space-y-1.5">
      {turns.map((t) => {
        const text = anonymous ? t.text.replace(/^To [A-Z][a-z]+'s agent/, "To a host's agent").replace(/^[A-Z][a-z]+'s agent/, "Host's agent").replace(/Disclosure check on [A-Z][a-z]+'s/, "Disclosure check on the host's") : t.text;
        return (
          <li key={t.i} className={cx("flex gap-2 text-[13px] leading-snug", t.from === "host" && "ml-6")}>
            <span className={cx("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full", t.from === "traveler" ? "bg-fb/10 text-fb" : t.from === "host" ? "bg-emerald-50 text-emerald-700" : "bg-[#f0f2f5] text-ink-2")}>
              {t.kind === "scrub" ? <ShieldCheck size={12} /> : t.from === "code" ? <span className="text-[9px] font-bold">{"{}"}</span> : <Bot size={12} />}
            </span>
            <div className="min-w-0">
              <div className={cx(t.kind === "answer" && "font-semibold", t.kind === "scrub" && "text-amber-800")}>{text}</div>
              {t.detail && <div className="text-[11.5px] text-ink-2">{t.detail}</div>}
            </div>
          </li>
        );
      })}
      {live && <li className="flex items-center gap-2 text-[12px] text-ink-2"><span className="h-2 w-2 rounded-full bg-fb pulse" /> agents talking…</li>}
    </ol>
  );
}

export interface RequestView {
  id: string; role: "traveler" | "host"; status: string; tripId?: string; ask: { start: string; end: string; guests: number; offer: string }; decision: string; conditions: string[]; alternativeDates?: { start: string; end: string };
  anon: string; city?: string; fit: { text: string; side: "host" | "traveler"; evidence: string }[]; other: { id: string; name: string; avatar: string; city: string; connection: string } | null; connectionFacts: string[];
  hostAccepted: boolean; travelerAccepted: boolean; revealedAt?: string; conversationId?: string; turns: NegotiationTurn[]; mode: string; costUsd: number; createdAt: string;
}

export function RequestCard({ r, onChange }: { r: RequestView; onChange: (r: RequestView) => void }) {
  const [busy, setBusy] = useState(false);
  const [showTurns, setShowTurns] = useState(false);
  const act = async (action: "accept" | "decline" | "confirm") => {
    setBusy(true);
    try { onChange(await api<RequestView>(`/api/opendoor/requests/${r.id}`, { method: "POST", json: { action } })); } finally { setBusy(false); }
  };
  const revealed = !!r.revealedAt && r.other;
  const matched = !!r.conversationId;
  const declined = r.status === "declined" || r.status === "declined_by_agent";
  return (
    <div className={cx("rounded-2xl border p-3", matched ? "border-emerald-300 bg-emerald-50/60" : declined ? "border-line bg-[#f7f8fa]" : "border-fb/30 bg-white")}>
      <div className="flex items-start gap-3">
        {revealed ? <Avatar src={r.other!.avatar} name={r.other!.name} size={40} /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e4e6eb] text-ink-2"><Eye size={18} /></span>}
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] leading-snug">
            {revealed ? <><b className="font-semibold">{r.other!.name}</b> <span className="text-ink-2">· {r.other!.city} · {r.other!.connection}</span></> : <span>{r.anon}</span>}
          </div>
          {revealed && <div className="mt-0.5 text-[12.5px] text-ink-2">{r.role === "host" ? `wants to stay ${fmtRange(r.ask.start, r.ask.end)}, ${r.ask.guests} guest${r.ask.guests === 1 ? "" : "s"}` : `said ${r.decision === "yes" ? "yes" : "yes with conditions"} for ${fmtRange(r.ask.start, r.ask.end)}`}{r.conditions.length ? ` · ${r.conditions.join("; ")}` : ""}</div>}
          {revealed && r.connectionFacts.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{r.connectionFacts.map((f) => <span key={f} className="rounded-full bg-fb/10 px-2 py-0.5 text-[11px] font-semibold text-fb">{f}</span>)}</div>}
        </div>
        <span className={cx("shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase", matched ? "bg-emerald-200 text-emerald-800" : declined ? "bg-[#e4e6eb] text-ink-2" : revealed ? "bg-fb/10 text-fb" : "bg-amber-100 text-amber-800")}>
          {matched ? "matched" : declined ? "declined" : revealed ? "revealed" : r.status === "traveler_accepted" ? (r.role === "host" ? "waiting on you" : "waiting on host") : "anonymous"}
        </span>
      </div>
      {r.fit.length > 0 && !declined && (
        <ul className="mt-2 space-y-0.5 text-[12.5px]">
          {r.fit.slice(0, 4).map((f, i) => <li key={i} className="flex gap-1.5"><span className={cx("mt-0.5 shrink-0 rounded px-1 text-[10px] font-semibold uppercase", f.side === "host" ? "bg-emerald-50 text-emerald-700" : "bg-fb/10 text-fb")}>{f.side === "host" ? (r.role === "host" ? "your policy" : "their agent") : r.role === "host" ? "their style" : "your style"}</span><span>{f.text} <span className="text-ink-2">· &ldquo;{f.evidence}&rdquo;</span></span></li>)}
        </ul>
      )}
      {!declined && !matched && (
        <div className="mt-3 flex gap-2">
          {r.role === "traveler" && !r.travelerAccepted && <><Button className="flex-1 py-1.5" disabled={busy} onClick={() => act("accept")}><Check size={15} /> Yes, ask them</Button><Button variant="secondary" className="py-1.5" disabled={busy} onClick={() => act("decline")}><X size={15} /> Pass</Button></>}
          {r.role === "traveler" && r.travelerAccepted && !revealed && <div className="text-[12.5px] text-ink-2">Sent to the host, anonymously: they see how you&apos;re connected and the dates, not your name, and decide whether to see who you are.</div>}
          {r.role === "host" && !r.hostAccepted && <><Button className="flex-1 py-1.5" disabled={busy} onClick={() => act("accept")}><Eye size={15} /> See who</Button><Button variant="secondary" className="py-1.5" disabled={busy} onClick={() => act("decline")}>Not this time</Button></>}
          {r.role === "host" && revealed && <><Button className="flex-1 py-1.5" disabled={busy} onClick={() => act("confirm")}><DoorOpen size={15} /> Yes, open the chat</Button><Button variant="secondary" className="py-1.5" disabled={busy} onClick={() => act("decline")}>No</Button></>}
          {r.role === "traveler" && revealed && <div className="text-[12.5px] text-ink-2">You&apos;re both revealed. {r.other!.name.split(" ")[0]} has the final say with full information.</div>}
        </div>
      )}
      {matched && <Link href={`/messages/${r.conversationId}`} className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-fb"><MessageCircle size={14} /> Open the chat. Agents are out of it from here.</Link>}
      {r.turns.length > 0 && (
        <div className="mt-2">
          <button onClick={() => setShowTurns((v) => !v)} className="text-[12px] font-semibold text-ink-2">{showTurns ? "Hide" : "Show"} what the agents said · {r.turns.length} turns · {r.mode}</button>
          {showTurns && <div className="mt-1 rounded-xl bg-[#f7f8fa] p-2"><TurnList turns={r.turns} anonymous={!revealed} /></div>}
        </div>
      )}
    </div>
  );
}

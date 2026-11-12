"use client";
// Small pieces shared by the Reconnect surfaces: drift state pill, the private "I miss them" toggle, evidence chips
// with the "what was used / not used" sheet, plan cards and the Messenger plan chip.
import Link from "next/link";
import { useState } from "react";
import { CalendarDays, Car, Check, Heart, Image as ImageIcon, MapPin, MessageCircle, Phone, Sparkles, Ticket, Users } from "lucide-react";
import { Avatar, Photo, Sheet, cx } from "@/components/ui";
import { api, refresh } from "@/lib/api";
import type { Evidence, Plan, PlanShape } from "@/lib/reconnect/store";

export type DriftState = "awake" | "sleepy" | "napping";
export function StatePill({ state, label, className }: { state: DriftState; label?: string; className?: string }) {
  const c = state === "awake" ? "bg-emerald-50 text-emerald-700" : state === "sleepy" ? "bg-amber-50 text-amber-800" : "bg-[#f0f2f5] text-ink-2";
  const dot = state === "awake" ? "bg-emerald-500" : state === "sleepy" ? "bg-amber-400" : "bg-slate-400";
  return <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-semibold", c, className)}><span className={cx("h-1.5 w-1.5 rounded-full", dot)} />{label ?? state}</span>;
}

/** Private. Nobody but you sees your pick; the other person learns about it only if they picked you too. */
export function MissButton({ personId, missed, mutual, onChange, size = "md" }: { personId: string; missed: boolean; mutual: boolean; onChange?: (r: { on: boolean; mutual: boolean }) => void; size?: "sm" | "md" }) {
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState({ missed, mutual });
  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      const r = await api<{ on: boolean; mutual: boolean }>("/api/reconnect/miss", { method: "POST", json: { personId, on: !state.missed } });
      setState({ missed: r.on, mutual: r.mutual });
      onChange?.(r);
      refresh("/api/reconnect");
      refresh("/api/me");
    } finally {
      setBusy(false);
    }
  };
  if (state.mutual) return <span className={cx("inline-flex items-center gap-1 rounded-full bg-rose-50 font-semibold text-rose-700", size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-[12.5px]")}><Heart size={size === "sm" ? 11 : 13} className="fill-rose-500 text-rose-500" /> mutual</span>;
  return (
    <button onClick={toggle} disabled={busy} title="Private: only you can see this. If they tap it too, you both find out." className={cx("inline-flex items-center gap-1 rounded-full font-semibold", size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-[12.5px]", state.missed ? "bg-rose-50 text-rose-700" : "bg-[#f0f2f5] text-ink-2")}>
      <Heart size={size === "sm" ? 11 : 13} className={state.missed ? "fill-rose-500 text-rose-500" : ""} /> {state.missed ? "I miss them · private" : "I miss them"}
    </button>
  );
}

const KIND_ICON: Record<Evidence["kind"], typeof ImageIcon> = { photo: ImageIcon, post: MessageCircle, chat: MessageCircle, event: CalendarDays, fact: Users };
const kindLabel = (k: Evidence["kind"]) => (k === "photo" ? "Photo" : k === "post" ? "Post" : k === "chat" ? "Your chat" : k === "event" ? "Event" : "Fact");
const fmt = (d: string) => new Date(d + "T12:00:00").toLocaleString("en-US", { month: "short", year: "numeric" });

export function EvidenceChips({ evidence, onOpen }: { evidence: Evidence[]; onOpen?: () => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {evidence.map((e) => {
        const I = KIND_ICON[e.kind];
        return <button key={e.id} onClick={onOpen} className="inline-flex max-w-full items-center gap-1 rounded-full bg-[#e7f0fd] px-2.5 py-1 text-[12px] font-semibold text-[#0b5ed7]"><I size={12} /> <span className="truncate">{kindLabel(e.kind)} · {e.kind === "fact" ? e.text.replace(/^you('re| know each other from:| both)?\s*/i, "") : fmt(e.date)}</span></button>;
      })}
    </div>
  );
}

/** "What Facebook used for this, and what it didn't": the trust screen. */
export function EvidenceSheet({ open, onClose, used, index, friendName }: { open: boolean; onClose: () => void; used: Evidence[]; index: Evidence[]; friendName: string }) {
  const usedIds = new Set(used.map((e) => e.id));
  const rest = index.filter((e) => !usedIds.has(e.id));
  const Row = ({ e, dim }: { e: Evidence; dim?: boolean }) => {
    const I = KIND_ICON[e.kind];
    const inner = (
      <div className={cx("flex gap-3 rounded-xl bg-white p-3", dim && "opacity-70")}>
        {e.image ? <Photo src={e.image} className="h-16 w-16 shrink-0 rounded-lg object-cover" /> : <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-[#f0f2f5] text-ink-2"><I size={22} /></span>}
        <div className="min-w-0 flex-1">
          <div className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-2">{kindLabel(e.kind)} · {e.kind === "fact" ? "profile" : fmt(e.date)}</div>
          <div className="mt-0.5 line-clamp-3 text-[14px] leading-snug">{e.text}</div>
        </div>
      </div>
    );
    return e.href ? <Link href={e.href}>{inner}</Link> : inner;
  };
  return (
    <Sheet open={open} onClose={onClose} title="What was used">
      <div className="space-y-3 bg-[#f0f2f5] p-3">
        <p className="text-[13px] text-ink-2">Everything the nudge about {friendName.split(" ")[0]} is allowed to rest on is below. Only things you can already see, and only things with both of you in them. Likes and reactions, anything about mood or health, and anyone else&apos;s chats are never read.</p>
        <div className="text-[12px] font-semibold uppercase tracking-wide text-[#0b5ed7]">Cited · checked by code</div>
        {used.length ? used.map((e) => <Row key={e.id} e={e} />) : <div className="rounded-xl bg-white p-3 text-[13px] text-ink-2">Nothing cited.</div>}
        {rest.length > 0 && <>
          <div className="text-[12px] font-semibold uppercase tracking-wide text-ink-2">Also shared, not used this time</div>
          {rest.map((e) => <Row key={e.id} e={e} dim />)}
        </>}
      </div>
    </Sheet>
  );
}

export const SHAPE: Record<PlanShape, { label: string; icon: typeof Car; hint: string }> = {
  visit: { label: "Visit", icon: MapPin, hint: "go to them" },
  hangout: { label: "Hang", icon: Users, hint: "in town" },
  event: { label: "Event", icon: Ticket, hint: "already happening" },
  call: { label: "Call", icon: Phone, hint: "low effort" },
};
export const fmtRange = (start: string, end: string) => {
  const s = new Date(start + "T12:00:00");
  const e = new Date(end + "T12:00:00");
  const mo = (d: Date) => d.toLocaleString("en-US", { month: "short" });
  if (start === end) return `${s.toLocaleString("en-US", { weekday: "short" })} ${mo(s)} ${s.getDate()}`;
  return mo(s) === mo(e) ? `${mo(s)} ${s.getDate()}–${e.getDate()}` : `${mo(s)} ${s.getDate()} – ${mo(e)} ${e.getDate()}`;
};
const AVAIL: Record<Plan["people"][number]["availability"], { label: string; cls: string }> = { confirmed: { label: "confirmed", cls: "text-emerald-700" }, likely_free: { label: "likely free", cls: "text-emerald-700" }, busy: { label: "busy", cls: "text-amber-800" }, unknown: { label: "we'll ask", cls: "text-ink-2" } };

export type PlanView = Plan & { owner: { id: string; name: string; avatar: string }; role: "owner" | "invited"; me?: Plan["people"][number] };

export function PlanCard({ p, href, selected, onPick }: { p: PlanView | Plan; href?: string; selected?: boolean; onPick?: () => void }) {
  const S = SHAPE[p.shape];
  const body = (
    <div className={cx("rounded-2xl bg-white p-4 shadow-sm", selected && "ring-2 ring-fb")}>
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-[#e7f0fd] px-2 py-0.5 text-[11.5px] font-semibold text-[#0b5ed7]"><S.icon size={12} /> {S.label} · {fmtRange(p.start, p.end)}</span>
        <span className="ml-auto text-[13px] font-semibold">{p.cost.each ? `~$${p.cost.each} each` : "free"}</span>
      </div>
      <div className="mt-2 text-[17px] font-bold leading-tight">{p.title}</div>
      <div className="mt-1 text-[13.5px] leading-snug text-ink-2">{p.pitch}</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {p.people.map((x) => <span key={x.id} className="inline-flex items-center gap-1.5 rounded-full bg-[#f0f2f5] py-0.5 pr-2.5 pl-0.5 text-[12px]"><Avatar src={x.avatar} name={x.name} size={20} /> {x.name.split(" ")[0]} · <span className={cx("font-semibold", AVAIL[x.availability].cls)}>{x.joinedAt ? "in" : AVAIL[x.availability].label}</span></span>)}
        {p.ride && <span className="inline-flex items-center gap-1 rounded-full bg-[#f0f2f5] px-2 py-0.5 text-[12px]"><Car size={12} /> {p.ride.driverName.split(" ")[0]} drives · {p.ride.seatsOpen} seat{p.ride.seatsOpen === 1 ? "" : "s"}</span>}
        {p.event && <span className="inline-flex items-center gap-1 rounded-full bg-[#f0f2f5] px-2 py-0.5 text-[12px]"><Ticket size={12} /> {p.event.title.slice(0, 32)}</span>}
      </div>
      {p.reasons.length > 0 && <ul className="mt-2 space-y-0.5 text-[13px] text-ink-2">{p.reasons.slice(0, 3).map((r, i) => <li key={i} className="flex gap-1.5"><span className="text-fb">·</span><span>{r}</span></li>)}</ul>}
      {onPick && <button onClick={onPick} className="mt-3 w-full rounded-lg bg-fb py-2 text-[14px] font-semibold text-white">Use this one</button>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

/** The plan inside a Messenger thread: a friend's invite with one tap to say yes. No agent anywhere on it. */
export function PlanChip({ id, mine }: { id: string; mine: boolean }) {
  const [p, setP] = useState<PlanView | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  if (p === undefined) { api<PlanView>(`/api/reconnect/plans/${id}`).then(setP).catch(() => setP(null)); return <div className="mb-1 h-24 w-64 animate-pulse rounded-xl bg-[#f0f2f5]" />; }
  if (!p) return null;
  const S = SHAPE[p.shape];
  const act = async (action: "join" | "leave") => { setBusy(true); try { setP(await api<PlanView>(`/api/reconnect/plans/${id}`, { method: "POST", json: { action } })); refresh("/api/notifications"); } finally { setBusy(false); } };
  const inCount = p.people.filter((x) => x.joinedAt).length;
  return (
    <div className="mb-1 w-[270px] overflow-hidden rounded-2xl border border-line/60 bg-white text-left text-ink">
      <Link href={p.fbEventId ? `/events/${p.fbEventId}` : `/reconnect/plan/${p.id}`} className="block">
        <div className="flex items-center gap-1.5 bg-[#e7f0fd] px-3 py-1.5 text-[11.5px] font-semibold text-[#0b5ed7]"><S.icon size={12} /> {S.label} · {fmtRange(p.start, p.end)} · {p.cityName}</div>
        <div className="px-3 pt-2 text-[15px] font-bold leading-tight">{p.title}</div>
        <div className="px-3 pt-0.5 text-[12.5px] text-ink-2">{[p.owner.name.split(" ")[0], ...p.people.filter((x) => x.id !== p.owner.id).map((x) => x.name.split(" ")[0])].join(", ")}{p.event ? ` · ${p.event.title.slice(0, 30)}` : ""}{p.cost.each ? ` · ~$${p.cost.each} each` : ""}</div>
      </Link>
      <div className="flex items-center gap-2 px-3 py-2">
        {mine || p.role === "owner" ? (
          <span className="text-[12.5px] text-ink-2">{inCount ? `${inCount} in` : "waiting"}{p.confirmedAt ? " · confirmed" : ""}</span>
        ) : p.me?.joinedAt ? (
          <><span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-emerald-700"><Check size={14} /> you&apos;re in</span><button disabled={busy} onClick={() => act("leave")} className="ml-auto text-[12px] text-ink-2">undo</button></>
        ) : (
          <><button disabled={busy} onClick={() => act("join")} className="flex-1 rounded-lg bg-emerald-600 py-1.5 text-[13px] font-semibold text-white">I&apos;m in</button><Link href={`/reconnect/plan/${p.id}`} className="rounded-lg bg-[#e4e6eb] px-3 py-1.5 text-[13px] font-semibold">Details</Link></>
        )}
      </div>
    </div>
  );
}

/** "Just say hi": opens (or creates) the DM. No draft, no agent. */
export function SayHi({ personId, className, children }: { personId: string; className?: string; children?: React.ReactNode }) {
  const [busy, setBusy] = useState(false);
  return (
    <button disabled={busy} className={className} onClick={async (e) => { e.preventDefault(); setBusy(true); try { const { id } = await api<{ id: string }>(`/api/conversations/with/${personId}`, { method: "POST" }); window.location.href = `/messages/${id}`; } finally { setBusy(false); } }}>
      {children ?? "Just say hi"}
    </button>
  );
}

export function SparkLine({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-fb"><Sparkles size={13} /> {children}</div>;
}

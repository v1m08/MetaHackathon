"use client";
// One plan: who, when (with each person's own words about the dates), cost line by line, and every claim's source.
// The owner drafts the message here and sends it from Messenger; invitees say "I'm in"; the owner confirms last.
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Car, ClipboardCheck, MessageCircle, Send, Ticket } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Avatar, Button, cx } from "@/components/ui";
import { api, refresh, useApi } from "@/lib/api";
import { ModeBadge } from "@/components/travel/Reasoning";
import { fmtRange, SHAPE, type PlanView } from "@/components/reconnect/ui";

const AV: Record<string, { label: string; cls: string }> = { confirmed: { label: "Confirmed", cls: "bg-emerald-100 text-emerald-800" }, likely_free: { label: "Likely free", cls: "bg-emerald-50 text-emerald-700" }, busy: { label: "Busy", cls: "bg-amber-50 text-amber-800" }, unknown: { label: "Unknown · we'll ask", cls: "bg-[#f0f2f5] text-ink-2" } };

export default function PlanPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: p, mutate } = useApi<PlanView>(`/api/reconnect/plans/${id}`, { poll: 3000 });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!p) return <Shell back title="Plan"><div className="p-4 text-[13px] text-ink-2">Loading…</div></Shell>;
  const S = SHAPE[p.shape];
  const owner = p.role === "owner";
  const joined = p.people.filter((x) => x.joinedAt);
  const act = async (action: string, text?: string) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ plan?: PlanView; conversationId?: string } & Partial<PlanView>>(`/api/reconnect/plans/${p.id}`, { method: "POST", json: { action, text } });
      const next = (r.plan ?? r) as PlanView;
      mutate(next, { revalidate: false });
      refresh("/api/conversations");
      refresh("/api/notifications");
      if (action === "draft" && r.conversationId) router.push(`/messages/${r.conversationId}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Shell back title="Plan">
      <div className="space-y-2 pb-8">
        <section className="bg-white px-4 py-3">
          <div className="flex items-center gap-2"><span className="inline-flex items-center gap-1 rounded-full bg-[#e7f0fd] px-2 py-0.5 text-[11.5px] font-semibold text-[#0b5ed7]"><S.icon size={12} /> {S.label} · {S.hint}</span><ModeBadge mode={p.mode} /><span className={cx("ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase", p.status === "confirmed" ? "bg-emerald-200 text-emerald-900" : p.status === "sent" ? "bg-[#e7f0fd] text-[#0b5ed7]" : "bg-[#f0f2f5] text-ink-2")}>{p.status === "proposed" ? "not sent" : p.status}</span></div>
          <h1 className="mt-2 text-[20px] font-bold leading-tight">{p.title}</h1>
          <div className="text-[14px] text-ink-2">{fmtRange(p.start, p.end)} · {p.cityName}{p.event ? ` · ${p.event.location}` : ""}</div>
          <p className="mt-2 text-[14.5px] leading-snug">{p.pitch}</p>
          {p.reasons.length > 0 && <ul className="mt-2 space-y-0.5 text-[13.5px] text-ink-2">{p.reasons.map((r, i) => <li key={i} className="flex gap-1.5"><span className="text-fb">·</span><span>{r}</span></li>)}</ul>}
          {!owner && <div className="mt-2 text-[12.5px] text-ink-2">From <b className="font-semibold text-ink">{p.owner.name}</b>. Planned in Reconnect; nothing is final until everyone&apos;s in.</div>}
        </section>

        <section className="bg-white px-4 py-3">
          <h2 className="text-[12px] font-semibold uppercase tracking-wide text-ink-2">Who</h2>
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-3"><Avatar src={p.owner.avatar} name={p.owner.name} size={36} /><span className="flex-1 text-[14px]"><b className="font-semibold">{p.owner.name.split(" ")[0]}</b> <span className="text-ink-2">· host</span></span></div>
            {p.people.map((x) => (
              <div key={x.id} className="flex items-start gap-3">
                <Avatar src={x.avatar} name={x.name} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[14px]"><b className="font-semibold">{x.name.split(" ")[0]}</b><span className="text-ink-2">· {x.connection}</span>{x.joinedAt ? <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">in</span> : owner || x.id === p.me?.id ? <span className={cx("ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold", AV[x.availability].cls)}>{AV[x.availability].label}</span> : null}</div>
                  {(owner || x.id === p.me?.id) && x.days.filter((d) => d.quote).slice(0, 2).map((d) => <div key={d.date} className="mt-0.5 text-[12.5px] text-ink-2">{new Date(d.date + "T12:00:00").toLocaleString("en-US", { weekday: "short" })}: “{d.quote}” <span className="text-[11px]">({d.source?.kind === "rsvp" ? "RSVP" : d.source?.kind === "chat" || d.source?.kind === "reply" ? "your chat" : "their post"})</span></div>)}
                </div>
              </div>
            ))}
            {p.ride && <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f0f2f5]"><Car size={16} /></span><span className="text-[14px]"><b className="font-semibold">{p.ride.driverName.split(" ")[0]}</b> <span className="text-ink-2">is driving · {p.ride.seatsOpen} seat{p.ride.seatsOpen === 1 ? "" : "s"} · {new Date(p.ride.departAt).toLocaleString("en-US", { weekday: "short", hour: "numeric" })}</span></span></div>}
            {p.event && <Link href={`/events/${p.event.id}`} className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f0f2f5]"><Ticket size={16} /></span><span className="text-[14px]"><b className="font-semibold">{p.event.title}</b> <span className="text-ink-2">· {new Date(p.event.startsAt).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric" })}{p.event.price ? ` · ${p.event.price}` : ""}</span></span></Link>}
          </div>
        </section>

        <section className="bg-white px-4 py-3">
          <h2 className="text-[12px] font-semibold uppercase tracking-wide text-ink-2">Cost · computed, not guessed</h2>
          <div className="mt-1.5 space-y-1">
            {p.cost.lines.map((l, i) => <div key={i} className="flex justify-between text-[13.5px]"><span className="text-ink-2">{l.label}</span><span className="font-semibold">${l.usd}</span></div>)}
            <div className="flex justify-between border-t border-line/60 pt-1 text-[14.5px]"><span className="font-semibold">each</span><span className="font-bold">${p.cost.each}</span></div>
            <div className="text-[12px] text-ink-2">{p.cost.note}{owner && p.cost.ifNo ? ` · if nobody can host: about $${p.cost.ifNo.total}` : ""}</div>
          </div>
        </section>

        <section className="bg-white px-4 py-3">
          <h2 className="text-[12px] font-semibold uppercase tracking-wide text-ink-2">How this was planned</h2>
          <div className="mt-1.5 space-y-1.5">
            {p.sources.map((s, i) => <div key={i} className="text-[13px] leading-snug"><b className="font-semibold">{s.claim}</b> <span className="text-ink-2">← {s.source}</span></div>)}
          </div>
          {owner && p.repairs.length > 0 && <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900"><b className="font-semibold">Code fixed:</b> {p.repairs.join(" · ")}</div>}
        </section>

        <section className={cx("mx-3 rounded-2xl p-4 shadow-sm", p.confirmedAt ? "bg-emerald-50" : "bg-white")}>
          <div className="flex items-center gap-2"><ClipboardCheck size={16} className="text-emerald-700" /><h2 className="text-[16px] font-bold">{owner ? "Your plan" : "Your answer"}</h2></div>
          {owner && p.status === "proposed" && <><p className="mt-1 text-[13px] text-ink-2">Muse drafts the message in your words; you edit and send it from Messenger. Sending creates an invite-only Event for everyone in it.</p><Button className="mt-3 w-full" disabled={busy} onClick={() => act("draft")}><MessageCircle size={16} /> Write to {p.people.length === 1 ? p.people[0].name.split(" ")[0] : p.target.crewName ?? "them"}</Button></>}
          {owner && p.status === "drafted" && <><p className="mt-1 text-[13px] text-ink-2">Your draft is waiting in Messenger. Nothing has been sent.</p><Link href={`/messages/${p.conversationId}`} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-messenger py-2 text-[14px] font-semibold text-white"><Send size={16} /> Open the draft</Link></>}
          {owner && (p.status === "sent" || p.status === "confirmed") && <>
            <p className="mt-1 text-[13px] text-ink-2">{joined.length ? `${joined.map((x) => x.name.split(" ")[0]).join(", ")} ${joined.length === 1 ? "is" : "are"} in.` : "Sent. Waiting for a yes."}{p.fbEventId && <> The plan lives on <Link href={`/events/${p.fbEventId}`} className="font-semibold text-fb">its Event</Link>.</>}</p>
            {p.confirmedAt ? <Button variant="secondary" className="mt-3 w-full" disabled={busy} onClick={() => act("unconfirm")}>Confirmed by you · undo</Button> : <Button className="mt-3 w-full bg-emerald-600" disabled={busy || !joined.length} onClick={() => act("confirm")}>Confirm this plan</Button>}
          </>}
          {!owner && <>
            {p.me?.joinedAt ? <p className="mt-1 text-[13px] text-emerald-800">You&apos;re in. {p.owner.name.split(" ")[0]} will confirm.</p> : <p className="mt-1 text-[13px] text-ink-2">One tap. You can change your mind.</p>}
            <div className="mt-3 flex gap-2">{p.me?.joinedAt ? <Button variant="secondary" className="flex-1" disabled={busy} onClick={() => act("leave")}>Undo</Button> : <Button className="flex-1 bg-emerald-600" disabled={busy} onClick={() => act("join")}>I&apos;m in</Button>}{p.conversationId && <Link href={`/messages/${p.conversationId}`} className="flex flex-1 items-center justify-center rounded-lg bg-[#e4e6eb] text-[14px] font-semibold">Reply in chat</Link>}</div>
          </>}
          {err && <div className="mt-2 text-[12.5px] text-red-700">{err}</div>}
          <div className="mt-2 text-[11px] text-ink-2">Nothing is a plan until the people in it say so. The agent never messages anyone.</div>
        </section>
      </div>
    </Shell>
  );
}

"use client";
// One trip: the Guide (friends' posts → taste-matched picks, credited) and Coordinate (dates + approved messages).
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Activity, CalendarCheck, Check, ChevronDown, ChevronUp, Eye, MessageCircle, Pencil, Sparkles, Trash2, X } from "lucide-react";
import { Shell } from "@/components/Shell";
import { ModeBadge, ReasoningStream } from "@/components/travel/Reasoning";
import { PersonRow, PriceLine } from "@/components/travel/TripCard";
import { Avatar, Button, Photo, cx } from "@/components/ui";
import { api, refresh, useApi } from "@/lib/api";
import { streamPost } from "@/lib/sse";
import type { DatesResult, Draft } from "@/lib/travel/coordinate";
import type { Guide } from "@/lib/travel/guide";
import type { StreamStep } from "@/lib/travel/store";
import type { Trip } from "@/lib/travel/validate";

const fmt = (iso: string) => new Date(iso + (iso.length === 10 ? "T12:00:00" : "")).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric" });
const first = (n: string) => n.split(" ")[0];

function DraftCard({ d, onChange }: { d: Draft; onChange: () => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(d.text);
  const [busy, setBusy] = useState(false);
  const act = async (action: "approve" | "edit" | "discard") => {
    setBusy(true);
    try {
      await api(`/api/travel/drafts/${d.id}`, { method: "POST", json: { action, text } });
      setEditing(false);
      onChange();
      refresh("/api/conversations");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={cx("rounded-2xl border p-3", d.status === "sent" ? "border-emerald-200 bg-emerald-50/50" : "border-amber-300 bg-amber-50")}>
      <div className="flex items-center gap-2">
        <Avatar src={d.to.avatar} name={d.to.name} size={32} />
        <div className="min-w-0 flex-1">
          <div className="text-[14px]"><b className="font-semibold">To {d.to.name}</b> <span className="text-ink-2">· {d.to.connection}</span></div>
          <div className="truncate text-[12px] text-ink-2">{d.about ? `intro to ${first(d.about.name)} through ${first(d.to.name)}` : d.reason.replace(/^Trip: .*? · /, "")}</div>
        </div>
        <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase", d.status === "sent" ? "bg-emerald-100 text-emerald-700" : "bg-amber-200 text-amber-900")}>{d.status === "sent" ? "sent" : "awaiting approval"}</span>
      </div>
      {editing ? (
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-amber-300 bg-white p-2 text-[14.5px] outline-none" />
      ) : (
        <p className="mt-2 whitespace-pre-wrap text-[14.5px] leading-snug">{text}</p>
      )}
      {d.status === "draft" ? (
        <div className="mt-2 flex gap-2">
          {editing ? (
            <Button className="flex-1 py-1.5" onClick={() => act("edit")} disabled={busy}>Save</Button>
          ) : (
            <Button className="flex-1 py-1.5" onClick={() => act("approve")} disabled={busy}><Check size={15} /> Approve &amp; send</Button>
          )}
          <Button variant="secondary" className="py-1.5" onClick={() => setEditing((v) => !v)} disabled={busy}>{editing ? <X size={15} /> : <Pencil size={15} />}</Button>
          <Button variant="secondary" className="py-1.5 text-red-600" onClick={() => act("discard")} disabled={busy}><Trash2 size={15} /></Button>
        </div>
      ) : (
        <Link href={`/messages/${d.conversationId}`} className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-fb"><MessageCircle size={14} /> Open in Messenger</Link>
      )}
    </div>
  );
}

export default function TripPage() {
  const { id } = useParams<{ id: string }>();
  const { data: trip, error } = useApi<Trip>(`/api/travel/trips/${id}`);
  const [steps, setSteps] = useState<StreamStep[]>([]);
  const [guide, setGuide] = useState<Guide | null>(null);
  const [running, setRunning] = useState(false);
  const [showSteps, setShowSteps] = useState(true);
  const [gErr, setGErr] = useState<string | null>(null);
  const started = useRef(false);
  const [coord, setCoord] = useState<{ dates: DatesResult; drafts: Draft[]; mode?: string } | null>(null);
  const [drafting, setDrafting] = useState(false);

  useEffect(() => {
    if (!trip || started.current) return;
    started.current = true;
    setRunning(true);
    streamPost<StreamStep, Guide>("/api/travel/guide", { tripId: trip.id }, (s) => setSteps((p) => [...p, s]))
      .then((g) => {
        setGuide(g);
        setShowSteps(false);
      })
      .catch((e) => setGErr((e as Error).message))
      .finally(() => setRunning(false));
    api<{ dates: DatesResult; drafts: Draft[] }>(`/api/travel/coordinate?tripId=${trip.id}`).then(setCoord).catch(() => {});
  }, [trip]);

  const reloadCoord = () => api<{ dates: DatesResult; drafts: Draft[] }>(`/api/travel/coordinate?tripId=${trip!.id}`).then(setCoord);
  async function draft() {
    setDrafting(true);
    try {
      setCoord(await api(`/api/travel/coordinate`, { method: "POST", json: { tripId: trip!.id } }));
    } finally {
      setDrafting(false);
    }
  }

  if (error) return <Shell back title="Trip"><div className="p-6 text-center text-ink-2">This trip isn&apos;t yours or has expired. <Link href="/travel" className="font-semibold text-fb">Find trips</Link></div></Shell>;
  if (!trip) return <Shell back title="Trip"><div className="p-3"><div className="skeleton h-80 rounded-2xl" /></div></Shell>;
  const cover = trip.evidence[0]?.image;

  return (
    <Shell back title={trip.cityName} right={<Link href="/dev/ai" className="rounded-full p-2 text-ink-2"><Activity size={20} /></Link>}>
      <div className="space-y-3 p-3">
        <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
          {cover && <Photo src={cover} className="h-36 w-full object-cover" />}
          <div className="p-4">
            <div className="text-[12px] font-semibold uppercase tracking-wide text-fb">{fmt(trip.start)} – {fmt(trip.end)} · {trip.nights} nights</div>
            <h1 className="mt-0.5 text-[22px] font-bold leading-tight">{trip.title}</h1>
            <div className="mt-3"><PriceLine trip={trip} big /></div>
            <div className="mt-2 divide-y divide-line/60">
              {trip.host && <PersonRow p={trip.host} role="host" note={trip.host.hostingNote} />}
              {trip.ride && <PersonRow p={trip.ride.driver} role={`driving · ${trip.ride.seatsOpen} seats open`} />}
              {trip.people.slice(0, 3).map((p) => <PersonRow key={p.id} p={p} role="there" />)}
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2"><Sparkles size={16} className="text-fb" /><h2 className="text-[16px] font-bold">Your guide, from your people</h2>{guide && <ModeBadge mode={guide.mode} className="ml-auto" />}</div>
          {(running || steps.length > 0) && (
            <div className="mt-2">
              <button className="flex w-full items-center gap-2 text-[13px] text-ink-2" onClick={() => setShowSteps((v) => !v)}>
                <span className={cx("h-2 w-2 rounded-full", running ? "bg-fb pulse" : "bg-emerald-500")} />
                {running ? "Reading what your friends posted…" : `How it read ${trip.cityName} · ${steps.length} steps`}
                <span className="ml-auto">{showSteps ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
              </button>
              {showSteps && <div className="mt-2"><ReasoningStream steps={steps} live={running} compact={!!guide} /></div>}
            </div>
          )}
          {gErr && <div className="mt-2 rounded-xl bg-red-50 p-3 text-[13px] text-red-700">{gErr}</div>}
          {guide && (
            <div className="mt-3 space-y-3">
              {guide.intro && <p className="text-[14.5px] leading-snug text-ink">{guide.intro}</p>}
              {guide.looked.length > 0 && (
                <div className="rounded-xl border border-fb/20 bg-fb/5 p-3">
                  <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-fb"><Eye size={13} /> Muse looked at {guide.looked.length === 1 ? "a photo" : `${guide.looked.length} photos`} just now</div>
                  {guide.looked.map((l, i) => (
                    <div key={i} className="mt-2 flex gap-3">
                      <Photo src={l.image} className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                      <div className="min-w-0 text-[13px] leading-snug"><b className="font-semibold">{first(l.author)}&apos;s photo:</b> {l.saw} <span className="text-ink-2">· {l.mode === "live" ? "live image understanding" : l.mode}</span></div>
                    </div>
                  ))}
                </div>
              )}
              {guide.items.map((it, i) => (
                <div key={i} className="flex gap-3">
                  <Link href={it.evidence.kind === "post" ? `/post/${it.evidence.id}` : "/reels"} className="shrink-0">{it.evidence.image ? <Photo src={it.evidence.image} className="h-20 w-20 rounded-xl object-cover" /> : <div className="h-20 w-20 rounded-xl bg-[#f0f2f5]" />}</Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2"><h3 className="text-[15.5px] font-bold leading-tight">{it.title}</h3>{it.priceHint && <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">{it.priceHint}</span>}</div>
                    <p className="mt-0.5 text-[13.5px] leading-snug text-ink">{it.what}</p>
                    <p className="mt-0.5 text-[13px] leading-snug text-ink-2"><span className="font-semibold text-fb">for you:</span> {it.whyYou}</p>
                    <Link href={`/profile/${it.credit.id}`} className="mt-1.5 flex items-center gap-1.5 text-[12px] text-ink-2">
                      <Avatar src={it.credit.avatar} name={it.credit.name} size={18} /><span className="min-w-0 truncate">from <b className="font-semibold text-ink">{it.credit.name.split(" ")[0]}</b>&apos;s {it.evidence.kind} · {it.credit.connection}{it.when ? ` · ${it.when}` : ""}</span>
                    </Link>
                  </div>
                </div>
              ))}
              {guide.items.length === 0 && <p className="text-[14px] text-ink-2">Your friends haven&apos;t posted from {trip.cityName} yet, so there&apos;s nothing to build a guide from. Ask {trip.host ? first(trip.host.name) : "them"} directly.</p>}
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2"><CalendarCheck size={16} className="text-fb" /><h2 className="text-[16px] font-bold">Make it happen</h2></div>
          {coord && (
            <div className="mt-2">
              <div className="grid gap-1 text-[13px]" style={{ gridTemplateColumns: `minmax(0,1fr) repeat(${coord.dates.dates.length}, 2.6rem)` }}>
                <div />
                {coord.dates.dates.map((d) => <div key={d} className="text-center text-[11px] font-semibold uppercase text-ink-2">{new Date(d + "T12:00:00").toLocaleString("en-US", { weekday: "short" })}</div>)}
                {coord.dates.people.map((p) => (
                  <div key={p.id} className="contents">
                    <div className="flex items-center gap-2 truncate py-1"><Avatar src={p.avatar} name={p.name} size={22} /><span className="truncate">{p.role === "you" ? "You" : first(p.name)} <span className="text-ink-2">· {p.role}</span></span></div>
                    {coord.dates.dates.map((d) => <div key={d} className={cx("my-1 rounded-md text-center text-[11px] font-semibold leading-6", p.busyOn.includes(d) ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700")}>{p.busyOn.includes(d) ? "busy" : "free"}</div>)}
                  </div>
                ))}
              </div>
              <div className="mt-2 text-[13px] text-ink-2">
                {coord.dates.allFree ? <>Everyone&apos;s free {fmt(trip.start)}–{fmt(trip.end)}.</> : <>Someone&apos;s busy. {coord.dates.alternatives.length ? <>Everyone is free <b className="font-semibold text-ink">{coord.dates.alternatives.map((a) => a.label).join(" or ")}</b>.</> : null}</>}
                {!coord.dates.allFree && coord.dates.alternatives.length > 0 && (
                  <span className="ml-1">{coord.dates.alternatives.map((a) => <Link key={a.start} href={`/travel?start=${a.start}&end=${a.end}&budget=${trip.budget}&run=1`} className="ml-1 font-semibold text-fb">Try {a.label} →</Link>)}</span>
                )}
              </div>
              {coord.drafts.length === 0 ? (
                <Button className="mt-3 w-full" onClick={draft} disabled={drafting}><MessageCircle size={16} /> {drafting ? "Drafting…" : `Draft the messages${trip.host?.degree === 2 || trip.ride?.driver.degree === 2 ? " (intros via your mutuals)" : ""}`}</Button>
              ) : (
                <div className="mt-3 space-y-2">
                  <div className="text-[12px] text-ink-2">Drafted by the agent, sent only when you approve. They also sit in Messenger.</div>
                  {coord.drafts.map((d) => <DraftCard key={d.id} d={d} onChange={reloadCoord} />)}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
}

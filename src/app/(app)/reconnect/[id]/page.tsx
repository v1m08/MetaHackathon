"use client";
// One reconnection: a person (why now, evidence, plan), a crew ("crew:<chat id>" or "label:<name>"), a city
// ("city:<id>") or an event ("event:<id>"). The plan agent runs here and you pick a shape; nothing is sent.
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Activity, ChevronRight, Compass, MessageCircle, Sparkles } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Avatar, Button, Photo, cx } from "@/components/ui";
import { api, useApi } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { streamPost } from "@/lib/sse";
import { ModeBadge, ReasoningStream } from "@/components/travel/Reasoning";
import type { StreamStep } from "@/lib/travel/store";
import { EvidenceChips, EvidenceSheet, MissButton, PlanCard, SayHi, SparkLine, StatePill } from "@/components/reconnect/ui";
import type { Crew, Drift, Place, RecentPost } from "@/lib/reconnect/drift";
import type { Evidence, Nudge, Plan } from "@/lib/reconnect/store";

type WhyNow = { friend: { id: string; name: string; avatar: string; city?: string; connection: string }; drift: Drift; post?: RecentPost; nudge: Nudge | null; reason?: string; index: Evidence[]; missed: boolean; mutual: boolean };
type DriftData = { people: { friendId: string; name: string; avatar: string; state: string }[]; crews: Crew[]; places: Place[]; culture: { event: { id: string; title: string; startsAt: string; location: string }; groupName: string; friendsGoing: { id: string; name: string; avatar: string }[] }[] };
type PlanResult = { runId: string; plans: Plan[]; declineReason?: string; mode: string; costUsd: number; latencyMs: number };

export default function ReconnectOnePage() {
  const { id: raw } = useParams<{ id: string }>();
  const id = decodeURIComponent(raw);
  const isPerson = !id.includes(":");
  const router = useRouter();
  const { data: drift } = useApi<DriftData>(isPerson ? null : "/api/reconnect/drift");
  const [wn, setWn] = useState<WhyNow | null>(null);
  const [sheet, setSheet] = useState(false);
  const [steps, setSteps] = useState<StreamStep[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<PlanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!isPerson) return;
    api<WhyNow>("/api/reconnect/whynow", { method: "POST", json: { personId: id } }).then(setWn).catch((e) => setError(e.message));
  }, [id, isPerson]);

  // who the plan is for
  const crew = !isPerson && (id.startsWith("c_") || id.startsWith("label:")) ? drift?.crews.find((c) => c.id === id) : undefined;
  const place = id.startsWith("city:") ? drift?.places.find((p) => p.city === id.slice(5)) : undefined;
  const culture = id.startsWith("event:") ? drift?.culture.find((c) => c.event.id === id.slice(6)) : undefined;
  const personIds = isPerson ? [id] : crew ? crew.memberIds : place ? place.friends.map((f) => f.id) : culture ? culture.friendsGoing.map((f) => f.id) : [];
  const title = isPerson ? wn?.friend.name ?? "…" : crew?.name ?? place?.cityName ?? culture?.event.title ?? "…";

  async function plan() {
    if (inFlight.current || !personIds.length) return;
    inFlight.current = true;
    setRunning(true);
    setResult(null);
    setError(null);
    setSteps([]);
    try {
      const r = await streamPost<StreamStep, PlanResult>("/api/reconnect/plan", { personIds, crewId: crew?.id }, (s) => setSteps((prev) => [...prev, s]));
      setResult(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      inFlight.current = false;
      setRunning(false);
    }
  }

  return (
    <Shell back title={title} right={<Link href="/dev/ai" className="rounded-full p-2 text-ink-2" title="AI Inspector"><Activity size={20} /></Link>}>
      <div className="space-y-2 pb-8">
        {isPerson && wn && (
          <>
            <section className="bg-white px-4 py-3">
              <div className="flex items-center gap-3">
                <Link href={`/profile/${wn.friend.id}`}><Avatar src={wn.friend.avatar} name={wn.friend.name} size={56} /></Link>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><b className="truncate text-[17px] font-bold">{wn.friend.name}</b><StatePill state={wn.drift.state} /></div>
                  <div className="text-[13px] text-ink-2">{wn.friend.connection} · {wn.drift.daysSince === null ? "no real exchange we can see" : `last real exchange ${wn.drift.daysSince < 14 ? `${wn.drift.daysSince} days` : `${Math.round(wn.drift.daysSince / 7)} weeks`} ago`} · rhythm {wn.drift.rhythmDays}d</div>
                  <div className="mt-1.5"><MissButton personId={wn.friend.id} missed={wn.missed} mutual={wn.mutual} onChange={(r) => setWn({ ...wn, missed: r.on, mutual: r.mutual })} /></div>
                </div>
              </div>
              {wn.mutual && <div className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-[13.5px] leading-snug text-rose-900"><b className="font-semibold">You both tapped it.</b> {wn.friend.name.split(" ")[0]} wants this as much as you do. That part is settled; the rest is logistics.</div>}
            </section>

            {wn.post && (
              <section className="bg-white">
                <div className="px-4 pt-3 text-[12px] font-semibold uppercase tracking-wide text-ink-2">{wn.friend.name.split(" ")[0]} posted {timeAgo(wn.post.createdAt)}</div>
                <Link href={`/post/${wn.post.id}`} className="block px-4 pt-1 text-[15px] leading-snug">{wn.post.text}</Link>
                {wn.post.image && <Photo src={wn.post.image} className="mt-2 max-h-72 w-full object-cover" />}
              </section>
            )}

            <section className="bg-white px-4 py-3">
              <SparkLine>Why now</SparkLine>
              {wn.nudge ? (
                <>
                  <p className="mt-1.5 text-[16px] leading-snug">{wn.nudge.line}</p>
                  <div className="mt-2"><EvidenceChips evidence={wn.nudge.evidence} onOpen={() => setSheet(true)} /></div>
                  <button onClick={() => setSheet(true)} className="mt-2 text-[12.5px] font-semibold text-fb">What was used, and what wasn&apos;t →</button>
                  <div className="mt-1 text-[11px] text-ink-2">Muse wrote the line and cited {wn.nudge.evidenceIds.length} thing{wn.nudge.evidenceIds.length === 1 ? "" : "s"}; code checked every citation is real and includes you both.<ModeBadge mode={wn.nudge.mode} className="ml-1.5" /></div>
                </>
              ) : (
                <p className="mt-1.5 text-[14px] text-ink-2">{wn.reason === "no shared history we can see" ? "You two don't have shared history Facebook can see yet (tagged photos, events, chats). You can still plan something." : wn.reason?.startsWith("banned") || wn.reason?.includes("evidence") ? `Muse wrote something code wouldn't show (${wn.reason}). Nothing is better than a made-up reason.` : "Nothing to add right now."}</p>
              )}
            </section>
            <EvidenceSheet open={sheet} onClose={() => setSheet(false)} used={wn.nudge?.evidence ?? []} index={wn.index} friendName={wn.friend.name} />
          </>
        )}

        {!isPerson && (crew || place || culture) && (
          <section className="bg-white px-4 py-3">
            <div className="flex -space-x-2">{(crew?.members ?? place?.friends ?? culture?.friendsGoing ?? []).slice(0, 6).map((m) => <span key={m.id} className="rounded-full border-2 border-white"><Avatar src={m.avatar} name={m.name} size={40} /></span>)}</div>
            <div className="mt-2 text-[15px] leading-snug">
              {crew && (crew.hook ? <><b className="font-semibold">{crew.members.find((m) => m.id === crew.hook!.authorId)?.name.split(" ")[0]}</b> asked “{crew.hook.text.slice(0, 120)}{crew.hook.text.length > 120 ? "…" : ""}” and nobody made it a plan. {crew.quiet} of {crew.memberIds.length} of you have gone quiet.</> : <>{crew.quiet} of {crew.memberIds.length} of you have gone quiet.</>)}
              {place && <>{place.friends.length} friends in {place.cityName}, {place.quiet} of them quiet.{place.ride ? ` ${place.ride.driverName.split(" ")[0]} is driving up with ${place.ride.seatsOpen} seats.` : ""}</>}
              {culture && <>{culture.friendsGoing.map((f) => f.name.split(" ")[0]).join(", ")} {culture.friendsGoing.length === 1 ? "is" : "are"} going to {culture.event.title} ({culture.groupName}).</>}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">{(crew?.members ?? place?.friends ?? []).map((m) => <span key={m.id} className="inline-flex items-center gap-1 rounded-full bg-[#f0f2f5] px-2 py-0.5 text-[12px]">{m.name.split(" ")[0]} <StatePill state={m.state} /></span>)}</div>
          </section>
        )}

        <section className="bg-white px-4 py-3">
          <div className="flex items-center gap-2"><Compass size={16} className="text-fb" /><h2 className="text-[16px] font-bold">Plan something</h2>{result && <ModeBadge mode={result.mode} className="ml-auto" />}</div>
          <p className="mt-1 text-[13px] text-ink-2">Who else, when they&apos;re actually free (from what they posted and said to you), where, and what it costs. Pick a shape; nothing is sent until you say so.</p>
          {!running && !result && <Button className="mt-3 w-full" onClick={plan} disabled={!personIds.length}><Sparkles size={16} /> Find a way to see {isPerson ? wn?.friend.name.split(" ")[0] ?? "them" : "them"}</Button>}
          {(running || steps.length > 0) && !result && <div className="mt-3"><ReasoningStream steps={steps} live={running} /></div>}
          {error && <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{error} <button onClick={plan} className="font-semibold underline">try again</button></div>}
        </section>

        {result && (
          <section className="space-y-2 px-3">
            {result.plans.map((p) => <PlanCard key={p.id} p={p} onPick={() => router.push(`/reconnect/plan/${p.id}`)} />)}
            {!result.plans.length && <div className="rounded-2xl bg-white p-4 text-[14px] text-ink-2">No honest plan this time: {result.declineReason}</div>}
            <div className="flex items-center justify-between px-1 text-[12px] text-ink-2"><span>{(result.latencyMs / 1000).toFixed(1)}s · {result.mode}{result.costUsd ? ` · $${result.costUsd.toFixed(3)}` : ""}</span><button onClick={plan} className="font-semibold text-fb">Run again</button></div>
            {steps.length > 0 && <details className="rounded-2xl bg-white p-3"><summary className="cursor-pointer text-[13px] font-semibold text-ink-2">How it got here ({steps.length} steps)</summary><div className="mt-2"><ReasoningStream steps={steps} live={false} compact /></div></details>}
          </section>
        )}

        {isPerson && wn && (
          <SayHi personId={wn.friend.id} className={cx("mx-3 flex w-[calc(100%-1.5rem)] items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left shadow-sm")}>
            <MessageCircle size={18} className="text-messenger" /><span className="flex-1 text-[14px]"><b className="font-semibold">Just say hi</b> <span className="text-ink-2">· open the thread, no plan</span></span><ChevronRight size={16} className="text-ink-2" />
          </SayHi>
        )}
      </div>
    </Shell>
  );
}

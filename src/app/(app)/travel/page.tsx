"use client";
// Discover: weekend + budget in, a watchable agent run, trips out.
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Activity, Car, ChevronDown, ChevronUp, Compass, Sparkles } from "lucide-react";
import { Shell } from "@/components/Shell";
import { ModeBadge, ReasoningStream } from "@/components/travel/Reasoning";
import { TripCard } from "@/components/travel/TripCard";
import { Avatar, Button, Empty, cx } from "@/components/ui";
import { useApi } from "@/lib/api";
import { readUserId } from "@/lib/session";
import type { StreamStep } from "@/lib/travel/store";
import type { Trip } from "@/lib/travel/validate";

type Options = {
  homeCity: string; homeCityName: string; hasCar: boolean; taste: string[]; tasteSummary: string;
  weekends: { n: number; start: string; end: string; label: string; busy: boolean }[];
  nudges: { rideId: string; driver: { id: string; name: string; avatar: string; connection?: string }; toCityName: string; departAt: string; seatsOpen: number; event?: { id: string; title: string }; weekend?: { start: string; end: string; label: string } }[];
  budgets: number[];
};
type Result = { runId: string; trips: Trip[]; declineReason?: string; mode: string; costUsd: number; latencyMs: number; model: string };

/** POST + parse Server-Sent Events by hand (EventSource can't POST). */
export async function streamDiscover(body: { start: string; end: string; budget: number; hint?: string }, onStep: (s: StreamStep) => void): Promise<Result> {
  const res = await fetch("/api/travel/discover", { method: "POST", headers: { "content-type": "application/json", "x-user-id": readUserId() }, body: JSON.stringify(body) });
  if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({})))?.error ?? `HTTP ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let result: Result | undefined;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const ev = chunk.match(/^event: (.+)$/m)?.[1];
      const data = chunk.match(/^data: (.+)$/m)?.[1];
      if (!ev || !data) continue;
      const d = JSON.parse(data);
      if (ev === "step") onStep(d);
      else if (ev === "result") result = d;
      else if (ev === "error") throw new Error(d.message);
    }
  }
  if (!result) throw new Error("The agent stopped without a result");
  return result;
}

function DiscoverInner() {
  const params = useSearchParams();
  const { data: opt } = useApi<Options>("/api/travel/options");
  const [weekend, setWeekend] = useState<string>("");
  const [budget, setBudget] = useState<string>("150");
  const [hint, setHint] = useState("");
  const [steps, setSteps] = useState<StreamStep[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSteps, setShowSteps] = useState(true);
  const autoRan = useRef(false);

  useEffect(() => {
    if (!opt) return;
    const qs = params.get("start");
    if (qs) setWeekend(`${qs}|${params.get("end") ?? qs}`);
    else if (!weekend) setWeekend(`${opt.weekends[0].start}|${opt.weekends[0].end}`);
    if (params.get("budget")) setBudget(params.get("budget")!);
    if (params.get("hint")) setHint(params.get("hint")!);
  }, [opt, params]); // eslint-disable-line react-hooks/exhaustive-deps

  async function run(over?: { start: string; end: string; budget?: number; hint?: string }) {
    const [start, end] = over ? [over.start, over.end] : weekend.split("|");
    const b = over?.budget ?? (Number(budget) || 150);
    if (!start) return;
    setRunning(true);
    setResult(null);
    setError(null);
    setSteps([]);
    setShowSteps(true);
    try {
      const r = await streamDiscover({ start, end, budget: b, hint: over?.hint ?? (hint || undefined) }, (s) => setSteps((prev) => [...prev, s]));
      setResult(r);
      setShowSteps(false);
      window.history.replaceState(null, "", `/travel?start=${start}&end=${end}&budget=${b}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }
  useEffect(() => {
    if (params.get("run") === "1" && opt && weekend && !autoRan.current) {
      autoRan.current = true;
      run();
    }
  }, [opt, weekend]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Shell back title="Trips" right={<Link href="/dev/ai" className="rounded-full p-2 text-ink-2" title="AI Inspector"><Activity size={20} /></Link>}>
      <div className="space-y-3 p-3">
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-fb"><Compass size={18} /><span className="text-[12px] font-semibold uppercase tracking-wide">where can my people take me?</span></div>
          <h1 className="mt-1 text-[22px] font-bold leading-tight">Pick a weekend and a budget. Not a place.</h1>
          <p className="mt-1 text-[14px] text-ink-2">Muse looks at who you know in other cities, who&apos;s open to hosting, who&apos;s driving where, and what your friends posted from there.</p>
          {opt && (
            <div className="mt-2 flex flex-wrap gap-1.5 text-[12px]">
              <span className="rounded-full bg-[#f0f2f5] px-2 py-0.5">from {opt.homeCityName}</span>
              <span className="rounded-full bg-[#f0f2f5] px-2 py-0.5">{opt.hasCar ? "has a car" : "no car"}</span>
              {opt.taste.slice(0, 3).map((t) => <span key={t} className="rounded-full bg-fb/10 px-2 py-0.5 text-fb">{t}</span>)}
            </div>
          )}
          <div className="mt-4 text-[13px] font-semibold text-ink-2">Weekend</div>
          <div className="-mx-1 mt-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {opt?.weekends.map((w) => {
              const key = `${w.start}|${w.end}`;
              return (
                <button key={w.n} disabled={w.busy} onClick={() => setWeekend(key)} className={cx("shrink-0 rounded-full border px-3 py-1.5 text-[14px] font-semibold", weekend === key ? "border-fb bg-fb text-white" : "border-line bg-white text-ink", w.busy && "opacity-40 line-through")}>
                  {w.label}
                </button>
              );
            })}
          </div>
          <div className="mt-3 text-[13px] font-semibold text-ink-2">Budget, all in</div>
          <div className="mt-1 flex items-center gap-2">
            <div className="flex flex-1 items-center rounded-xl border border-line bg-white px-3">
              <span className="text-[18px] font-bold text-ink-2">$</span>
              <input inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^0-9]/g, ""))} className="w-full bg-transparent py-2.5 text-[18px] font-bold outline-none" />
            </div>
            {opt?.budgets.map((b) => <button key={b} onClick={() => setBudget(String(b))} className={cx("rounded-full px-3 py-1.5 text-[13px] font-semibold", budget === String(b) ? "bg-fb text-white" : "bg-[#f0f2f5]")}>${b}</button>)}
          </div>
          <input value={hint} onChange={(e) => setHint(e.target.value)} placeholder="Anything else? (e.g. somewhere I can run, no flights)" className="mt-2 w-full rounded-xl border border-line px-3 py-2 text-[14px] outline-none focus:border-fb" />
          <Button className="mt-3 w-full py-3 text-[16px]" disabled={running || !weekend} onClick={() => run()}>
            <Sparkles size={18} /> {running ? "Asking your network…" : "Find my trips"}
          </Button>
        </section>

        {!running && !result && opt && opt.nudges.length > 0 && (
          <section className="space-y-2">
            <div className="px-1 text-[13px] font-semibold text-ink-2">Happening in your network</div>
            {opt.nudges.slice(0, 3).map((n) => (
              <button key={n.rideId} onClick={() => n.weekend && run({ start: n.weekend.start, end: n.weekend.end, hint: `I could ride with ${n.driver.name.split(" ")[0]} to ${n.toCityName}` })} className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm">
                <Avatar src={n.driver.avatar} name={n.driver.name} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="text-[14px]"><b className="font-semibold">{n.driver.name.split(" ")[0]}</b> is driving to <b className="font-semibold">{n.toCityName}</b> {new Date(n.departAt).toLocaleString("en-US", { month: "short", day: "numeric" })}{n.event ? ` for ${n.event.title}` : ""}.</div>
                  <div className="text-[12px] text-ink-2">{n.seatsOpen} seat{n.seatsOpen === 1 ? "" : "s"} open · {n.driver.connection} · you&apos;re free {n.weekend?.label}</div>
                </div>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fb/10 text-fb"><Car size={18} /></span>
              </button>
            ))}
          </section>
        )}

        {(running || steps.length > 0) && (
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <button className="flex w-full items-center gap-2" onClick={() => setShowSteps((v) => !v)}>
              <span className={cx("h-2 w-2 rounded-full", running ? "bg-fb pulse" : "bg-emerald-500")} />
              <span className="text-[14px] font-semibold">{running ? "Muse is working through your network" : `How it got there · ${steps.length} steps`}</span>
              {result && <ModeBadge mode={result.mode} className="ml-1" />}
              <span className="ml-auto text-ink-2">{showSteps ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
            </button>
            {showSteps && <div className="mt-3"><ReasoningStream steps={steps} live={running} compact={!!result} /></div>}
          </section>
        )}

        {error && <div className="rounded-2xl bg-red-50 p-4 text-[14px] text-red-700">{error}</div>}

        {result && result.trips.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1 text-[13px] text-ink-2">
              <span className="font-semibold">{result.trips.length} trip{result.trips.length === 1 ? "" : "s"} your people make possible</span>
              <span>{(result.latencyMs / 1000).toFixed(1)}s · {result.model}</span>
            </div>
            {result.trips.map((t) => <TripCard key={t.id} trip={t} />)}
          </section>
        )}
        {result && result.trips.length === 0 && (
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <Empty icon={<Compass size={28} />} title="No trip this weekend" body={result.declineReason} />
            <div className="mt-2 text-center text-[13px] text-ink-2">Try another weekend or a bigger budget. Turning on <b className="font-semibold">Open to hosting</b> on your own profile helps your friends too.</div>
          </div>
        )}
      </div>
    </Shell>
  );
}

export default function DiscoverPage() {
  return (
    <Suspense fallback={<Shell back title="Trips"><div className="p-3"><div className="skeleton h-72 rounded-2xl" /></div></Shell>}>
      <DiscoverInner />
    </Suspense>
  );
}

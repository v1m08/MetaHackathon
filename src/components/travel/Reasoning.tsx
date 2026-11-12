"use client";
// The agent's reasoning stream, as a judge sees it in the product: one line per step, animating in as the
// model works. Small, purposeful motion; the same data drives the pitch animations.
import { useEffect, useRef } from "react";
import { Camera, CalendarCheck, Car, CheckCircle2, DollarSign, Loader2, MapPinned, ShieldCheck, Sparkles, Users, Wrench, XCircle, type LucideIcon } from "lucide-react";
import { cx } from "@/components/ui";
import type { StreamStep } from "@/lib/travel/store";

const ICON: Record<string, LucideIcon> = {
  scan_network: MapPinned,
  find_people_by_city: Users,
  get_travel_events_and_rides: Car,
  check_availability: CalendarCheck,
  estimate_trip_cost: DollarSign,
  get_city_media: Camera,
  propose_trips: Sparkles,
  get_my_travel_profile: Users,
};

export function stepIcon(s: StreamStep): LucideIcon {
  if (s.kind === "error") return XCircle;
  if (s.kind === "done") return CheckCircle2;
  if (s.kind === "info") return s.text.startsWith("Checking every") || s.text.startsWith("Fixed") ? ShieldCheck : Sparkles;
  if (s.kind === "model") return Loader2;
  return ICON[s.tool ?? ""] ?? Wrench;
}

export function ReasoningStream({ steps, live, compact }: { steps: StreamStep[]; live: boolean; compact?: boolean }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (live) endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [steps.length, live]);
  const shown = steps.filter((s) => s.kind !== "model" || live);
  return (
    <ol className={cx("space-y-1", compact && "max-h-64 overflow-y-auto")}>
      {shown.map((s, idx) => {
        const I = stepIcon(s);
        const isLast = idx === shown.length - 1;
        const spinning = live && isLast && s.kind !== "done" && s.kind !== "error";
        return (
          <li key={s.i} className="stepin flex items-start gap-2.5 py-1" style={{ animationDelay: "0ms" }}>
            <span className={cx("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full", s.kind === "result" ? "bg-emerald-50 text-emerald-600" : s.kind === "error" ? "bg-red-50 text-red-600" : s.kind === "done" ? "bg-fb text-white" : s.kind === "model" ? "bg-[#f0f2f5] text-ink-2" : "bg-fb/10 text-fb")}>
              <I size={13} className={cx(spinning && s.kind === "model" && "animate-spin")} />
            </span>
            <div className="min-w-0 flex-1">
              <div className={cx("text-[14px] leading-snug", s.kind === "result" ? "text-ink-2" : "text-ink", s.kind === "done" && "font-semibold", s.kind === "model" && "text-ink-2 italic")}>{s.text}{spinning && s.kind !== "model" ? <span className="dots" /> : null}</div>
              {s.detail && <div className="mt-0.5 truncate text-[12px] text-ink-2/80">{s.detail}</div>}
            </div>
            <span className="shrink-0 pt-0.5 text-[11px] tabular-nums text-ink-2/60">{(s.at / 1000).toFixed(1)}s</span>
          </li>
        );
      })}
      <div ref={endRef} />
    </ol>
  );
}

export function ModeBadge({ mode, className }: { mode?: string; className?: string }) {
  const m = mode ?? "live";
  const style = m === "live" ? "bg-emerald-100 text-emerald-700" : m === "replay" ? "bg-amber-100 text-amber-800" : m === "cached" ? "bg-sky-100 text-sky-700" : "bg-[#e4e6eb] text-ink-2";
  const label = m === "live" ? "Live · Muse" : m === "replay" ? "Replay of a recorded run" : m === "cached" ? "Cached Muse response" : "Mock · no model";
  return <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide", style, className)}>{label}</span>;
}

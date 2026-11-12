"use client";
// Hidden demo controls for Hang Again: time travel, reset, live/cached AI, scenario triggers, the friend's side
// of the conversation, and a debug drawer showing which model ran, how long it took and the raw JSON.
import Link from "next/link";
import { useRef, useState } from "react";
import { Bug, CheckCircle2, ChevronDown, CircleSlash, ExternalLink, FlaskConical, MessageCircle, RefreshCw, RotateCcw, Sparkles, XCircle } from "lucide-react";
import { cx } from "@/components/ui";
import { api, useApi } from "@/lib/api";
import type { PipelineRun } from "@/server/hangout/store";
import type { DemoView } from "@/server/hangout/views";

function Btn({ children, onClick, busy, tone = "default", className }: { children: React.ReactNode; onClick: () => void; busy?: boolean; tone?: "default" | "primary" | "danger"; className?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition active:scale-[.98] disabled:opacity-50",
        tone === "primary" ? "bg-fb text-white hover:bg-fb-dark" : tone === "danger" ? "bg-[#3a1d1d] text-[#ffb4b4] hover:bg-[#4a2424]" : "bg-white/10 text-white hover:bg-white/15",
        className,
      )}
    >
      {children}
    </button>
  );
}

function Section({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <section className="rounded-xl bg-white/[.04] p-3 ring-1 ring-white/10">
      <h2 className="text-[11px] font-bold tracking-wider text-white/50 uppercase">{title}</h2>
      {hint && <p className="mt-1 text-[12px] text-white/50">{hint}</p>}
      <div className="mt-2">{children}</div>
    </section>
  );
}

const STATUS_ICON = { ok: CheckCircle2, fail: XCircle, skip: CircleSlash, info: Sparkles } as const;
const STATUS_COLOR = { ok: "text-emerald-400", fail: "text-rose-400", skip: "text-white/40", info: "text-sky-300" } as const;

function Run({ run, open, onToggle }: { run: PipelineRun; open: boolean; onToggle: () => void }) {
  const muse = run.steps.filter((s) => s.muse).map((s) => s.muse!);
  return (
    <div className="rounded-lg bg-white/[.04] ring-1 ring-white/10">
      <button onClick={onToggle} className="flex w-full items-start gap-2 px-3 py-2 text-left">
        <span className={cx("mt-1 h-2 w-2 shrink-0 rounded-full", run.ok ? "bg-emerald-400" : "bg-rose-400")} />
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-white">{run.label}</span>
          <span className="block truncate text-[12px] text-white/60">{run.outcome}</span>
          {muse.length > 0 && (
            <span className="mt-0.5 block text-[11px] text-white/40">
              {muse.map((m) => `${m.modelId} · ${m.mode}${m.source ? ` (${m.source})` : ""} · ${m.latencyMs}ms`).join("  |  ")}
            </span>
          )}
        </span>
        <ChevronDown size={16} className={cx("mt-1 shrink-0 text-white/40 transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-2 border-t border-white/10 px-3 py-2">
          {run.steps.map((s, i) => {
            const Icon = STATUS_ICON[s.status];
            return (
              <div key={i}>
                <div className="flex items-start gap-2 text-[12px]">
                  <Icon size={14} className={cx("mt-0.5 shrink-0", STATUS_COLOR[s.status])} />
                  <span className="text-white/90"><b>{s.name}</b>{s.detail && <span className="text-white/60"> · {s.detail}</span>}</span>
                </div>
                {s.muse && (
                  <div className="mt-1 ml-5 space-y-1">
                    <div className="text-[11px] text-white/50">
                      model <b className="text-white/80">{s.muse.modelId}</b> ({s.muse.model}) · mode <b className="text-white/80">{s.muse.mode}</b>
                      {s.muse.source && <> · from {s.muse.source}</>} · {s.muse.latencyMs}ms · {s.muse.attempts.length} attempt{s.muse.attempts.length === 1 ? "" : "s"}
                    </div>
                    {s.muse.attempts.map((a, j) => (
                      <div key={j}>
                        {a.issues && <div className="text-[11px] text-rose-300">invalid: {a.issues.join("; ")}</div>}
                        <pre className="max-h-64 overflow-auto rounded-md bg-black/50 p-2 text-[11px] leading-relaxed whitespace-pre-wrap text-emerald-200">{JSON.stringify(a.raw, null, 2)}</pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <div className="text-[11px] text-white/40">{new Date(run.at).toLocaleTimeString()} · every model call is also in the <Link href="/dev/ai" className="underline">AI Inspector</Link></div>
        </div>
      )}
    </div>
  );
}

export default function DemoPage() {
  const { data: d, mutate } = useApi<DemoView>("/api/hangout/demo", { poll: 1500 });
  const [busy, setBusy] = useState<string | null>(null);
  const [last, setLast] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const phone = useRef<HTMLIFrameElement>(null);

  const act = async (key: string, json: Record<string, unknown>) => {
    setBusy(key);
    setErr(null);
    try {
      const r = await api<DemoView & { result?: { outcome: string; reason?: string } }>("/api/hangout/demo", { method: "POST", json });
      if (r.result) setLast((l) => ({ ...l, [key]: `${r.result!.outcome.replace("_", " ")}${r.result!.reason && r.result!.outcome !== "nudge" ? ` · ${r.result!.reason}` : ""}` }));
      if (r.runs[0]) setOpen(r.runs[0].id);
      mutate(r, { revalidate: false });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const reloadPhone = () => phone.current?.contentWindow?.location.reload();

  return (
    <div className="min-h-dvh bg-[#0b1220] text-white">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-5 p-4 lg:flex-row lg:items-start">
        {/* Controls */}
        <div className="w-full space-y-3 lg:w-[360px] lg:shrink-0">
          <div>
            <h1 className="flex items-center gap-2 text-[18px] font-bold"><FlaskConical size={18} /> Hang Again · demo</h1>
            <div className="mt-1 flex flex-wrap gap-3 text-[12px] text-white/60">
              <Link href="/dev/ai" className="flex items-center gap-1 hover:text-white"><Bug size={12} /> AI Inspector</Link>
              <Link href="/demo/parts" className="hover:text-white">Critter library</Link>
              <a href="/friends/hangout" target="_blank" className="flex items-center gap-1 hover:text-white">Open phone <ExternalLink size={11} /></a>
            </div>
          </div>
          {err && <div className="rounded-lg bg-rose-500/15 px-3 py-2 text-[12px] text-rose-200">{err}</div>}

          <Section title="AI mode" hint={d && !d.hasKey ? "No META_MODEL_API_KEY in .env.local, so live calls fall back to the cache." : undefined}>
            <div className="flex gap-2">
              {(["live", "cached"] as const).map((m) => (
                <Btn key={m} tone={d?.aiMode === m ? "primary" : "default"} onClick={() => act(`mode-${m}`, { action: "mode", mode: m })} className="flex-1 justify-center capitalize">{m}</Btn>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-white/50">
              Ember: <span className="text-white/80">{d?.models.ember}</span> · Wonder: <span className="text-white/80">{d?.models.wonder}</span>
              <br />Cached replays {d?.recorded.length ?? 0} recorded live response{d?.recorded.length === 1 ? "" : "s"}, then hand-written fixtures.
            </p>
          </Section>

          <Section title="Demo date">
            <div className="flex flex-wrap items-center gap-2">
              <input type="date" value={d?.demoDate ?? ""} onChange={(e) => e.target.value && act("date", { action: "setDate", date: e.target.value })} className="rounded-lg bg-white/10 px-2 py-1.5 text-[13px] text-white [color-scheme:dark]" />
              {[-1, 1, 3, 7].map((n) => <Btn key={n} onClick={() => act(`shift${n}`, { action: "shiftDate", days: n })}>{n > 0 ? `+${n}` : n}d</Btn>)}
            </div>
          </Section>

          <Section title="Data">
            <div className="flex flex-wrap gap-2">
              <Btn busy={busy === "reset"} onClick={() => act("reset", { action: "reset" })}><RotateCcw size={13} /> Reset demo</Btn>
              <Btn busy={busy === "rebuild"} onClick={() => act("rebuild", { action: "rebuildMemory" })}><RefreshCw size={13} className={busy === "rebuild" ? "animate-spin" : ""} /> Rebuild memory</Btn>
              <Btn busy={busy === "clear"} onClick={() => act("clear", { action: "clearNudges" })}>Clear today&apos;s nudges</Btn>
              <Btn onClick={reloadPhone}>Reload phone</Btn>
            </div>
            <div className="mt-2 flex gap-2">
              {(["critters", "plants"] as const).map((t) => (
                <Btn key={t} tone={d?.theme === t ? "primary" : "default"} onClick={() => act(`theme-${t}`, { action: "theme", theme: t })} className="flex-1 justify-center capitalize">{t}</Btn>
              ))}
            </div>
          </Section>

          <Section title="Friend moments" hint="Max one nudge per day. Use +1d or Clear today's nudges between moments.">
            <div className="space-y-1.5">
              {d?.scenarios.map((s) => (
                <div key={s.id} className="flex items-center gap-2">
                  <Btn tone={s.id === "maya_ramen" ? "primary" : "default"} busy={busy === s.id} onClick={() => act(s.id, { action: "scenario", id: s.id })} className="flex-1 justify-start text-left">
                    {busy === s.id ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} />} {s.label}
                  </Btn>
                  <span className="w-[112px] shrink-0 text-right text-[11px] leading-tight">
                    <span className="block text-white/40">expect {s.expect}</span>
                    {last[s.id] && <span className="block text-white/80">got {last[s.id]}</span>}
                  </span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="The friend's side">
            <div className="flex flex-wrap gap-2">
              {d?.repliers.map((r) => (
                <Btn key={r.id} busy={busy === `reply-${r.id}`} onClick={() => act(`reply-${r.id}`, { action: "reply", friendId: r.id })}>
                  <MessageCircle size={13} /> {r.first} replies
                </Btn>
              ))}
              <Btn tone={d?.seeAgain.theyPicked.includes("sam") ? "default" : "primary"} busy={busy === "pick"} onClick={() => act("pick", { action: "pick", personId: "sam" })}>Sam mutual pick</Btn>
            </div>
            <p className="mt-2 text-[11px] text-white/50">
              See again: you picked {d?.seeAgain.myPicks.join(", ") || "nobody yet"}{d?.seeAgain.matches.length ? ` · matches: ${d.seeAgain.matches.join(", ")}` : ""}. Plan &quot;Yes&quot; for the friend is on the plan card in the phone.
            </p>
          </Section>
        </div>

        {/* Phone */}
        <div className="flex shrink-0 justify-center">
          <iframe ref={phone} src="/friends/hangout" title="Phone" className="h-[864px] w-[410px] rounded-[44px] border-[10px] border-[#111827] bg-white shadow-[0_0_0_2px_#374151,0_30px_80px_rgba(0,0,0,.6)]" />
        </div>

        {/* Debug drawer */}
        <div className="min-w-0 flex-1 space-y-2">
          <h2 className="flex items-center gap-2 text-[13px] font-bold tracking-wider text-white/60 uppercase"><Bug size={14} /> Debug · pipeline runs</h2>
          {!d?.runs.length && <p className="text-[13px] text-white/40">Trigger a moment to see the model, latency and raw JSON for each step.</p>}
          {d?.runs.map((r) => <Run key={r.id} run={r} open={open === r.id} onToggle={() => setOpen(open === r.id ? null : r.id)} />)}
        </div>
      </div>
    </div>
  );
}

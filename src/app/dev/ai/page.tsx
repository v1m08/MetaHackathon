"use client";
// AI Inspector: a judge-facing view of every model call (prompt, output, tool steps, latency, tokens),
// plus a playground to fire each capability. Lives outside the phone frame.
import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity, ArrowLeft, Braces, Image as ImageIcon, MessageSquareText, Trash2, Wrench, Zap } from "lucide-react";
import { api, useApi } from "@/lib/api";
import { useSession } from "@/lib/session";
import { cx } from "@/components/ui";
import type { Trace } from "@/lib/ai/types";

type Status = { mode: string; hasKey: boolean; baseUrl: string; textModel: string; visionModel: string; imageModel: string; configuredMode: string; calls: number; errors: number; avgLatency: number; budget: { spentUsd: number; committedUsd: number; limitUsd: number; budgetUsd: number; calls: number } };
const KIND_ICON = { text: MessageSquareText, json: Braces, image: ImageIcon, tools: Wrench } as const;

function Json({ value, max = 4000 }: { value: unknown; max?: number }) {
  const s = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return <pre className="max-h-[420px] overflow-auto rounded-lg bg-[#0b1220] p-3 text-[12px] leading-relaxed text-emerald-100 whitespace-pre-wrap break-words">{s.length > max ? s.slice(0, max) + "\n…" : s}</pre>;
}

export default function InspectorPage() {
  const { userId } = useSession();
  const { data: status } = useApi<Status>("/api/ai/status", { poll: 2000 });
  const { data: traces, mutate } = useApi<Trace[]>("/api/ai/trace", { poll: 1500 });
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"prompt" | "output" | "steps">("output");
  const [prompt, setPrompt] = useState("What should I post about this week? Keep it to one idea.");
  const [busy, setBusy] = useState<string | null>(null);
  const [models, setModels] = useState<string[] | null>(null);
  const [result, setResult] = useState<unknown>(null);

  const t = traces?.find((x) => x.id === selected) ?? traces?.[0];
  useEffect(() => {
    if (!selected && traces?.[0]) setSelected(traces[0].id);
  }, [traces, selected]);

  async function run(kind: "text" | "json" | "image" | "tools") {
    setBusy(kind);
    setResult(null);
    try {
      const r = await api<{ result: unknown }>("/api/ai/playground", { method: "POST", json: { kind, prompt } });
      setResult(r.result);
      const list = await mutate();
      if (list?.[0]) {
        setSelected(list[0].id);
        setTab("output");
      }
    } catch (e) {
      setResult({ error: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-dvh bg-[#0f172a] text-slate-100">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#0f172a]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <Link href="/" className="flex items-center gap-1 text-sm text-slate-300 hover:text-white"><ArrowLeft size={16} /> App</Link>
          <Link href="/dev/play" className="text-sm text-slate-300 hover:text-white">Play inspector</Link>
          <h1 className="flex items-center gap-2 text-lg font-bold"><Activity size={18} className="text-fb" /> AI Inspector</h1>
          {status && (
            <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
              <span className={cx("rounded-full px-2.5 py-1 font-semibold", status.mode === "live" ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300")}>{status.mode === "live" ? "● LIVE · Meta Model API" : "● MOCK · no key"}</span>
              <span className="rounded-full bg-white/10 px-2.5 py-1">text: {status.textModel}</span>
              <span className={cx("rounded-full px-2.5 py-1 font-semibold", status.budget.committedUsd > status.budget.limitUsd * 0.9 ? "bg-red-500/20 text-red-300" : "bg-white/10")} title="Booked Muse spend (ledger, 1.5x margin) vs this process's limit">${status.budget.committedUsd.toFixed(2)} / ${status.budget.limitUsd} budget</span>
              <span className="rounded-full bg-white/10 px-2.5 py-1">{status.calls} calls · {status.avgLatency}ms avg{status.errors ? ` · ${status.errors} errors` : ""}</span>
              <span className="rounded-full bg-white/10 px-2.5 py-1">as @{userId}</span>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-4 px-4 py-4 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-3">
          <section className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="mb-2 flex items-center justify-between text-sm font-semibold"><span className="flex items-center gap-1.5"><Zap size={14} /> Playground</span></div>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} className="w-full rounded-lg border border-white/10 bg-black/30 p-2 text-sm outline-none focus:border-fb" />
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["text", "json", "image", "tools"] as const).map((k) => {
                const I = KIND_ICON[k];
                return (
                  <button key={k} disabled={!!busy} onClick={() => run(k)} className="flex items-center justify-center gap-1.5 rounded-lg bg-fb/90 px-2 py-2 text-sm font-semibold hover:bg-fb disabled:opacity-50">
                    <I size={14} /> {busy === k ? "…" : k}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-slate-400">tools = model can call get_feed, search, get_group_posts, get_upcoming_events, get_recent_messages, get_user_profile.</p>
            {result !== null && (
              <div className="mt-2">
                {typeof result === "string" && result.startsWith("http") ? <img src={result} alt="" className="w-full rounded-lg" /> : <Json value={result} max={1200} />}
              </div>
            )}
          </section>
          <section className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs">
            <div className="mb-1 text-sm font-semibold">Config</div>
            <div className="space-y-1 text-slate-300">
              <div>base: <code>{status?.baseUrl}</code></div>
              <div>AI_MODE: <code>{status?.configuredMode}</code> → {status?.mode}</div>
              <div>key: {status?.hasKey ? "present" : "missing"}</div>
            </div>
            <button
              onClick={async () => {
                try {
                  const r = await api<{ models: string[]; note?: string }>("/api/ai/models");
                  setModels(r.models.length ? r.models : [r.note ?? "none"]);
                } catch (e) {
                  setModels([(e as Error).message]);
                }
              }}
              className="mt-2 rounded-lg bg-white/10 px-2.5 py-1.5 font-semibold hover:bg-white/20"
            >
              List models (GET /v1/models)
            </button>
            {models && <ul className="mt-2 max-h-40 space-y-0.5 overflow-auto text-slate-300">{models.map((m) => <li key={m}><code>{m}</code></li>)}</ul>}
          </section>
          <section className="rounded-xl border border-white/10 bg-white/5">
            <div className="flex items-center justify-between px-3 py-2 text-sm font-semibold">
              <span>Calls ({traces?.length ?? 0})</span>
              <button onClick={async () => { await api("/api/ai/trace", { method: "DELETE" }); mutate([], { revalidate: true }); setSelected(null); }} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white"><Trash2 size={12} /> clear</button>
            </div>
            <ul className="max-h-[48vh] divide-y divide-white/5 overflow-auto">
              {traces?.map((x) => {
                const I = KIND_ICON[x.kind];
                return (
                  <li key={x.id}>
                    <button onClick={() => setSelected(x.id)} className={cx("flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/5", t?.id === x.id && "bg-fb/20")}>
                      <I size={14} className={x.error ? "text-red-400" : "text-slate-300"} />
                      <span className="flex-1 truncate font-medium">{x.task}</span>
                      <span className="text-xs text-slate-400">{x.latencyMs}ms</span>
                    </button>
                  </li>
                );
              })}
              {traces?.length === 0 && <li className="px-3 py-6 text-center text-xs text-slate-400">No calls yet. Use the composer&apos;s ✨ AI button, a group&apos;s &quot;Catch me up&quot;, or the playground.</li>}
            </ul>
          </section>
        </aside>

        <section className="rounded-xl border border-white/10 bg-white/5 p-4">
          {!t ? (
            <div className="py-24 text-center text-slate-400">Select a call to see its prompt, output and timing.</div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold">{t.task}</h2>
                <span className="rounded bg-white/10 px-2 py-0.5 text-xs">{t.kind}</span>
                <span className={cx("rounded px-2 py-0.5 text-xs", t.mode === "live" ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300")}>{t.mode}</span>
                <span className="rounded bg-white/10 px-2 py-0.5 text-xs">{t.model}</span>
                {t.userId && <span className="rounded bg-white/10 px-2 py-0.5 text-xs">as @{t.userId}</span>}
                <span className="ml-auto text-xs text-slate-400">{new Date(t.startedAt).toLocaleTimeString()}</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center sm:grid-cols-4">
                <Stat label="latency" value={`${t.latencyMs} ms`} />
                <Stat label="prompt tokens" value={t.usage?.prompt_tokens ?? "–"} />
                <Stat label="completion tokens" value={t.usage?.completion_tokens ?? "–"} />
                <Stat label="tool steps" value={t.steps?.filter((s) => s.type === "tool_call").length ?? 0} />
              </div>
              {t.error && <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{t.error}</div>}
              <div className="mt-4 flex gap-1 border-b border-white/10 text-sm">
                {(["prompt", "output", "steps"] as const).map((k) => (
                  <button key={k} onClick={() => setTab(k)} className={cx("px-3 py-2 font-semibold", tab === k ? "border-b-2 border-fb text-white" : "text-slate-400")}>{k}</button>
                ))}
              </div>
              <div className="mt-3">
                {tab === "prompt" && (
                  <div className="space-y-2">
                    {t.request.prompt && <Json value={t.request.prompt} />}
                    {t.request.messages?.map((m, i) => (
                      <div key={i}>
                        <div className="mb-1 text-[11px] font-bold tracking-wide text-slate-400 uppercase">{m.role}{m.name ? ` · ${m.name}` : ""}</div>
                        <Json value={m.content ?? m.tool_calls ?? ""} max={6000} />
                      </div>
                    ))}
                    {t.request.schema && (<><div className="text-[11px] font-bold tracking-wide text-slate-400 uppercase">schema</div><Json value={t.request.schema} /></>)}
                    {t.request.tools && <div className="text-xs text-slate-400">tools offered: {t.request.tools.join(", ")}</div>}
                  </div>
                )}
                {tab === "output" && (typeof t.response === "string" && t.response.startsWith("http") && t.kind === "image" ? <img src={t.response} alt="" className="max-h-96 rounded-lg" /> : <Json value={t.response ?? "(no output)"} max={8000} />)}
                {tab === "steps" && (
                  <div className="space-y-2">
                    {!t.steps?.length && <div className="text-sm text-slate-400">No tool steps for this call.</div>}
                    {t.steps?.map((s, i) => (
                      <div key={i} className="rounded-lg border border-white/10 p-2">
                        <div className="flex items-center gap-2 text-xs"><span className={cx("rounded px-1.5 py-0.5 font-bold uppercase", s.type === "tool_call" ? "bg-fb/30" : s.type === "tool_result" ? "bg-emerald-500/20" : "bg-white/10")}>{s.type}</span><span className="font-semibold">{s.name}</span>{s.latencyMs !== undefined && <span className="ml-auto text-slate-400">{s.latencyMs}ms</span>}</div>
                        {s.args !== undefined && <Json value={s.args} max={800} />}
                        {s.result !== undefined && <Json value={s.result} max={1500} />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-black/30 p-2">
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[11px] text-slate-400 uppercase">{label}</div>
    </div>
  );
}

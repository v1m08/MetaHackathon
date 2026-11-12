"use client";
// INTERNAL / DEMO ONLY. Not a user-facing screen: this is the Facebook-side view of what the travel agent can see
// for one viewer, drawn as a graph, with the latest Discover run overlaid. Lives under /dev next to the AI Inspector.
//
// Centre = viewer. Inner ring = friends (degree 1), grouped by city. Outer ring = friends-of-friends (degree 2), each
// placed next to the mutual that makes them visible. Nothing outside these rings is reachable by the agent's tools.
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Car, Home, Lock, RefreshCw } from "lucide-react";
import { useApi } from "@/lib/api";
import { useSession } from "@/lib/session";
import { cx } from "@/components/ui";

type Node = { id: string; degree: 0 | 1 | 2; name: string; avatar: string; city?: string; cityName: string; openToHosting: boolean; hasCar: boolean; restricted: boolean; connection: string; via?: string; mutuals: string[] };
type RunTrip = { id: string; title: string; cityName: string; price: number; otherwise: number; host?: string; driver?: string; people: string[]; going: string[] };
type Run = { id: string; input: { start: string; end: string; budget: number; hint?: string }; mode: string; latencyMs: number; costUsd: number; declineReason?: string; considered: string[]; trips: RunTrip[] };
type Graph = { me: string; nodes: Node[]; edges: { a: string; b: string; label: string }[]; hidden: number; cities: string[]; latestRun?: Run | null };

const W = 760, H = 760, CX = W / 2, CY = H / 2, R1 = 185, R2 = 340;
const TRIP_COLORS = ["#f59e0b", "#ec4899", "#8b5cf6"];
const first = (n: string) => n.split(" ")[0];

function layout(g: Graph) {
  const pos = new Map<string, { x: number; y: number }>();
  pos.set(g.me, { x: CX, y: CY });
  const friends = g.nodes.filter((n) => n.degree === 1);
  const byCity = new Map<string, Node[]>();
  for (const f of friends) byCity.set(f.cityName, [...(byCity.get(f.cityName) ?? []), f]);
  const ordered = [...byCity.entries()].sort((a, b) => b[1].length - a[1].length).flatMap(([, ns]) => ns);
  const angle = new Map<string, number>();
  ordered.forEach((f, i) => {
    const a = (i / ordered.length) * Math.PI * 2 - Math.PI / 2;
    angle.set(f.id, a);
    pos.set(f.id, { x: CX + Math.cos(a) * R1, y: CY + Math.sin(a) * R1 });
  });
  const fof = g.nodes.filter((n) => n.degree === 2);
  const byVia = new Map<string, Node[]>();
  for (const n of fof) {
    const via = n.mutuals.find((m) => angle.has(m)) ?? n.via ?? "";
    byVia.set(via, [...(byVia.get(via) ?? []), n]);
  }
  const used: number[] = [];
  for (const [via, ns] of byVia) {
    const base = angle.get(via) ?? 0;
    ns.forEach((n, i) => {
      let a = base + (i - (ns.length - 1) / 2) * 0.2;
      while (used.some((u) => Math.abs(((u - a + Math.PI) % (Math.PI * 2)) - Math.PI) < 0.17)) a += 0.17;
      used.push(a);
      pos.set(n.id, { x: CX + Math.cos(a) * R2, y: CY + Math.sin(a) * R2 });
    });
  }
  return pos;
}

export default function NetworkDevPage() {
  const { userId } = useSession();
  const { data: g, mutate } = useApi<Graph>("/api/admin/network", { poll: 3000 });
  const [sel, setSel] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "hosts" | "cars" | "run">("all");
  const pos = useMemo(() => (g ? layout(g) : new Map()), [g]);
  if (!g) return <div className="min-h-screen bg-[#0b1220] p-6 text-slate-300">Loading network…</div>;

  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const run = g.latestRun ?? undefined;
  const tripOf = new Map<string, number>(); // person id → index of the trip that uses them
  run?.trips.forEach((t, i) => [t.host, t.driver, ...t.people, ...t.going].forEach((id) => id && !tripOf.has(id) && tripOf.set(id, i)));
  const considered = new Set(run?.considered ?? []);
  const selected = sel ? byId.get(sel) : undefined;
  const neighbours = new Set(sel ? g.edges.filter((e) => e.a === sel || e.b === sel).flatMap((e) => [e.a, e.b]) : []);
  const dim = (n: Node) => n.degree !== 0 && ((filter === "hosts" && !n.openToHosting) || (filter === "cars" && !n.hasCar) || (filter === "run" && !tripOf.has(n.id)) || (!!sel && sel !== n.id && !neighbours.has(n.id)));
  const friends = g.nodes.filter((n) => n.degree === 1);
  const fof = g.nodes.filter((n) => n.degree === 2);
  const cities = [...new Set(g.nodes.filter((n) => n.degree > 0).map((n) => n.cityName))];

  return (
    <div className="min-h-screen bg-[#0b1220] text-slate-100">
      <header className="flex items-center gap-4 border-b border-white/10 px-6 py-3">
        <Link href="/dev/ai" className="flex items-center gap-1 text-sm text-slate-300 hover:text-white"><ArrowLeft size={16} /> Inspector</Link>
        <h1 className="text-lg font-semibold">Network graph <span className="ml-2 rounded bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-300">internal · demo only</span></h1>
        <span className="text-sm text-slate-400">viewing as <b className="text-slate-200">{byId.get(g.me)?.name ?? userId}</b> · <Link href="/switch" className="underline">switch</Link></span>
        <button onClick={() => mutate()} className="ml-auto flex items-center gap-1 text-sm text-slate-300 hover:text-white"><RefreshCw size={14} /> refresh</button>
      </header>

      <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-2xl bg-[#111a2e] p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[13px]">
            <span className="mr-2 text-slate-300"><b className="text-white">{friends.length}</b> friends · <b className="text-white">{fof.length}</b> friends-of-friends · <b className="text-white">{cities.length}</b> cities · <b className="text-white">{g.hidden}</b> invisible to this viewer</span>
            {(["all", "hosts", "cars", "run"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} disabled={f === "run" && !run} className={cx("rounded-full px-3 py-1 font-semibold", filter === f ? "bg-white text-[#0b1220]" : "bg-white/10 text-slate-200 disabled:opacity-40")}>
                {f === "all" ? "Everyone" : f === "hosts" ? "Open to hosting" : f === "cars" ? "Has a car" : "In latest run"}
              </button>
            ))}
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block max-h-[80vh] w-full" onClick={() => setSel(null)}>
            <circle cx={CX} cy={CY} r={R1} fill="none" stroke="#2a3650" strokeDasharray="4 6" />
            <circle cx={CX} cy={CY} r={R2} fill="none" stroke="#2a3650" strokeDasharray="4 6" />
            <text x={CX} y={CY - R1 - 10} textAnchor="middle" fontSize="11" fill="#7c89a6">FRIENDS · tools can return them directly</text>
            <text x={CX} y={CY - R2 - 10} textAnchor="middle" fontSize="11" fill="#7c89a6">FRIENDS OF FRIENDS · only via a named mutual</text>
            {g.edges.map((e) => {
              const a = pos.get(e.a), b = pos.get(e.b);
              if (!a || !b) return null;
              const hot = sel && (e.a === sel || e.b === sel);
              const toMe = e.a === g.me || e.b === g.me;
              return <line key={e.a + e.b} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={hot ? "#60a5fa" : toMe ? "#3b4a6b" : "#283553"} strokeWidth={hot ? 2.5 : toMe ? 1.2 : 1} opacity={sel && !hot ? 0.3 : 1} />;
            })}
            {g.nodes.map((n) => {
              const p = pos.get(n.id);
              if (!p) return null;
              const r = n.degree === 0 ? 26 : n.degree === 1 ? 18 : 14;
              const ti = tripOf.get(n.id);
              const ring = ti !== undefined ? TRIP_COLORS[ti % TRIP_COLORS.length] : n.openToHosting ? "#31a24c" : n.degree === 0 ? "#1877f2" : "#4b5a7a";
              return (
                <g key={n.id} transform={`translate(${p.x},${p.y})`} opacity={dim(n) ? 0.18 : 1} className="cursor-pointer" onClick={(ev) => { ev.stopPropagation(); setSel(sel === n.id ? null : n.id); }}>
                  {ti !== undefined && <circle r={r + 9} fill="none" stroke={ring} strokeWidth={2} strokeDasharray="3 3" />}
                  {considered.has(n.id) && ti === undefined && <circle r={r + 7} fill="none" stroke="#60a5fa" strokeWidth={1} opacity={0.6} />}
                  <clipPath id={`c-${n.id}`}><circle r={r} /></clipPath>
                  <circle r={r + 3} fill={ring} />
                  <image href={n.avatar} x={-r} y={-r} width={r * 2} height={r * 2} clipPath={`url(#c-${n.id})`} preserveAspectRatio="xMidYMid slice" />
                  {n.hasCar && <circle cx={r - 2} cy={-r + 2} r={6} fill="#1877f2" stroke="#0b1220" strokeWidth={1.5} />}
                  {n.restricted && <circle cx={-r + 2} cy={-r + 2} r={5} fill="#94a3b8" stroke="#0b1220" strokeWidth={1.5} />}
                  <text y={r + 13} textAnchor="middle" fontSize={n.degree === 0 ? 13 : 11} fontWeight={n.degree < 2 ? 600 : 400} fill="#e2e8f0">{first(n.name)}</text>
                  <text y={r + 24} textAnchor="middle" fontSize={9.5} fill="#7c89a6">{n.degree === 0 ? "" : n.cityName.split(",")[0]}</text>
                </g>
              );
            })}
          </svg>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-slate-400">
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-[#31a24c]" /> open to hosting</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-[#1877f2]" /> has a car</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-slate-400" /> friends-only profile</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full border border-blue-400" /> scanned in latest run</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full border-2 border-dashed border-amber-400" /> used in a proposed trip</span>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl bg-[#111a2e] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Latest Discover run for this viewer</div>
            {!run ? (
              <p className="mt-2 text-[13px] text-slate-300">None yet. Run Discover in the app (<Link href="/travel" className="underline">/travel</Link>) and this panel fills in; the graph then rings the people the agent scanned and the ones it put in trips.</p>
            ) : (
              <>
                <p className="mt-1 text-[13px] text-slate-300">{run.input.start} → {run.input.end} · ${run.input.budget} · <span className="uppercase">{run.mode}</span> · {(run.latencyMs / 1000).toFixed(1)}s · ${run.costUsd.toFixed(3)}</p>
                <p className="mt-1 text-[12px] text-slate-400">Scanned {run.considered.length} of {g.nodes.length - 1} visible people. Everything it saw is on this graph; nothing off it was reachable.</p>
                {run.declineReason && <p className="mt-2 rounded-lg bg-white/5 p-2 text-[13px] text-amber-200">Declined: {run.declineReason}</p>}
                <ul className="mt-3 space-y-3">
                  {run.trips.map((t, i) => (
                    <li key={t.id} className="rounded-xl border p-3" style={{ borderColor: TRIP_COLORS[i % TRIP_COLORS.length] }}>
                      <div className="text-[14px] font-semibold">{t.title}</div>
                      <div className="text-[12px] text-slate-400">{t.cityName} · ~${t.price} if yes · ~${t.otherwise} otherwise</div>
                      <div className="mt-1.5 flex flex-wrap gap-1 text-[11px]">
                        {t.host && <button onClick={() => setSel(t.host!)} className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-emerald-200">host · {first(byId.get(t.host)?.name ?? t.host)}</button>}
                        {t.driver && <button onClick={() => setSel(t.driver!)} className="rounded-full bg-blue-500/20 px-2 py-0.5 text-blue-200">ride · {first(byId.get(t.driver)?.name ?? t.driver)}</button>}
                        {[...new Set([...t.people, ...t.going])].filter((p) => p !== t.host && p !== t.driver).map((p) => {
                          const n = byId.get(p);
                          return <button key={p} onClick={() => setSel(p)} className={cx("rounded-full px-2 py-0.5", n?.degree === 2 ? "border border-dashed border-slate-500 text-slate-300" : "bg-white/10 text-slate-200")}>{first(n?.name ?? p)}{n?.degree === 2 ? ` · via ${first(byId.get(n.via ?? "")?.name ?? "")}` : ""}</button>;
                        })}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {selected && (
            <section className="rounded-2xl bg-[#111a2e] p-4">
              <Link href={`/profile/${selected.id}`} className="flex items-center gap-3">
                <img src={selected.avatar} alt="" className="h-11 w-11 rounded-full object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-bold">{selected.name}</div>
                  <div className="text-[12px] text-slate-400">{selected.cityName} · {selected.degree === 1 ? selected.connection : selected.degree === 2 ? `friend of a friend · ${selected.connection}` : "the viewer"}</div>
                </div>
              </Link>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                {selected.openToHosting && <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 font-semibold text-emerald-200"><Home size={12} /> open to hosting</span>}
                {selected.hasCar && <span className="flex items-center gap-1 rounded-full bg-blue-500/20 px-2 py-0.5 font-semibold text-blue-200"><Car size={12} /> has a car</span>}
                {selected.restricted && <span className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 font-semibold text-slate-300"><Lock size={12} /> friends-only: posts hidden from non-friends</span>}
              </div>
              {selected.degree === 2 && <p className="mt-2 text-[12px] text-slate-300">The agent never messages {first(selected.name)} directly. Any ask is drafted to {selected.mutuals.map((m) => first(byId.get(m)?.name ?? m)).join(" or ")} as an intro.</p>}
              <ul className="mt-2 space-y-0.5 text-[12px] text-slate-300">
                {g.edges.filter((e) => e.a === selected.id || e.b === selected.id).map((e) => {
                  const other = byId.get(e.a === selected.id ? e.b : e.a)!;
                  return <li key={e.a + e.b}>↔ <b className="font-semibold text-slate-100">{first(other.name)}</b> <span className="text-slate-500">· {e.label}</span></li>;
                })}
              </ul>
            </section>
          )}

          <section className="rounded-2xl bg-[#111a2e] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">By city</div>
            <div className="mt-2 divide-y divide-white/10">
              {cities.map((c) => (
                <div key={c} className="flex items-start gap-3 py-2">
                  <div className="w-24 shrink-0 text-[13px] font-semibold">{c.split(",")[0]}</div>
                  <div className="flex flex-1 flex-wrap gap-1">
                    {g.nodes.filter((n) => n.cityName === c && n.degree > 0).map((n) => (
                      <button key={n.id} onClick={() => setSel(n.id)} className={cx("rounded-full border px-2 py-0.5 text-[11px]", n.openToHosting ? "border-emerald-500/60 text-emerald-200" : "border-white/15 text-slate-300", n.degree === 2 && "border-dashed")}>
                        {first(n.name)}{n.degree === 2 ? " ·via" : ""}{n.hasCar ? " 🚗" : ""}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

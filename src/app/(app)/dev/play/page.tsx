"use client";
// Chat Games inspector (dev page, not a product surface): per chat the score parts, the topic table, today's game
// with what code refused from the draft, recent play events and the ranked unlock candidates, plus buttons that
// generate a game of a given format right now. It shows every member's numbers, which no product surface does.
// The inspect payload is loosely typed, so everything here reads it defensively.
import Link from "next/link";
import { useState } from "react";
import { Shell } from "@/components/Shell";
import { cx } from "@/components/ui";
import { api, refresh, useApi } from "@/lib/api";

type Rec = Record<string, unknown>;
const FORMATS = [["split", "Split"], ["blend", "Blend"], ["receipts", "Receipts"], ["wager", "Wager"], ["lineup", "Lineup"], ["hotseat", "Hot Seat"]] as const;

const rec = (x: unknown): Rec | undefined => (x && typeof x === "object" && !Array.isArray(x) ? (x as Rec) : undefined);
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
const recs = (x: unknown): Rec[] => arr(x).map(rec).filter((r): r is Rec => !!r);
const str = (x: unknown) => (typeof x === "string" ? x : typeof x === "number" || typeof x === "boolean" ? String(x) : "");
const fmt = (x: unknown): string => {
  if (typeof x === "number") return Number.isInteger(x) ? String(x) : x.toFixed(2);
  if (x === null || x === undefined) return "";
  if (typeof x === "object") return Array.isArray(x) && x.every((v) => typeof v !== "object") ? x.join(", ") : JSON.stringify(x);
  return String(x);
};
const time = (x: unknown) => { const d = new Date(str(x)); return Number.isNaN(d.getTime()) ? str(x) : d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); };

function Json({ value }: { value: unknown }) {
  const s = JSON.stringify(value, null, 2) ?? "";
  return <pre className="max-h-72 overflow-auto rounded-lg bg-[#0b1220] p-2 text-[11px] leading-relaxed break-words whitespace-pre-wrap text-emerald-100">{s.length > 6000 ? `${s.slice(0, 6000)}\n…` : s}</pre>;
}
function Table({ rows, cols }: { rows: Rec[]; cols: string[] }) {
  if (!rows.length) return <div className="text-[12px] text-ink-2">none</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[11.5px]">
        <thead><tr>{cols.map((c) => <th key={c} className="px-1.5 py-1 font-semibold whitespace-nowrap text-ink-2">{c}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-line/40">{cols.map((c) => <td key={c} className="max-w-[180px] truncate px-1.5 py-1 align-top tabular-nums">{fmt(r[c])}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
function KV({ value }: { value?: Rec }) {
  if (!value) return null;
  return <div className="flex flex-wrap gap-1.5">{Object.entries(value).map(([k, v]) => <span key={k} className="rounded bg-[#f0f2f5] px-1.5 py-0.5 text-[11.5px]"><span className="text-ink-2">{k}</span> <b className="font-semibold tabular-nums">{fmt(v)}</b></span>)}</div>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="mt-3"><div className="mb-1 text-[11px] font-semibold tracking-wide text-ink-2 uppercase">{title}</div>{children}</div>;
}

function Game({ g }: { g: Rec }) {
  const dropped = arr(g.dropped).map(fmt);
  const why = str(g.why) || str(g.selectionWhy) || str(rec(g.selection)?.why) || str(g.reason);
  return (
    <div className="rounded-lg border border-line/60 p-2">
      <div className="text-[13px] font-semibold leading-tight">{str(g.title) || str(g.id)}</div>
      <div className="mt-0.5 text-[11.5px] text-ink-2">{[str(g.formatLabel) || str(g.format), str(g.topicLabel) || str(g.topic), str(g.date), str(g.mode), typeof g.costUsd === "number" ? `$${g.costUsd.toFixed(4)}` : "", `${arr(g.completed).length} completed`].filter(Boolean).join(" · ")}</div>
      {str(g.premise) && <div className="mt-1 text-[12px]">{str(g.premise)}</div>}
      {why && <div className="mt-1 rounded bg-[#e7f0fd] px-1.5 py-1 text-[11.5px] text-[#0b5ed7]"><b className="font-semibold">Why this game:</b> {why}</div>}
      <div className={cx("mt-1 rounded px-1.5 py-1 text-[11.5px]", dropped.length ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-800")}>
        <b className="font-semibold">{dropped.length ? `Code refused ${dropped.length} from the draft` : "Nothing refused from the draft"}</b>
        {dropped.map((d, i) => <div key={i}>· {d}</div>)}
      </div>
      <details className="mt-1">
        <summary className="cursor-pointer text-[11.5px] font-semibold text-fb">Rounds, answers, engagement</summary>
        {recs(g.rounds).map((r, i) => (
          <div key={i} className="mt-1 text-[11.5px]">
            <b className="font-semibold">{i + 1}. [{str(r.kind)}] {str(r.prompt)}</b>
            {str(r.quote) && <div className="text-ink-2">“{str(r.quote)}”</div>}
            <div className="text-ink-2">{recs(r.options).map((o) => `${str(o.label)}${o.topic ? ` (${str(o.topic)})` : ""}${r.answer === o.id ? " ✓" : ""}`).join(" | ")}</div>
          </div>
        ))}
        <Section title="Engagement"><Table rows={recs(g.engagement)} cols={["userId", "value", "completed", "promptness", "depth", "social"]} /></Section>
        <Section title="Answers"><Json value={g.answers} /></Section>
        <Section title="Results"><Json value={g.results} /></Section>
      </details>
    </div>
  );
}

function Chat({ c, events }: { c: Rec; events: Rec[] }) {
  const games = recs(c.games);
  const today = games.find((g) => g.today === true);
  const earlier = games.filter((g) => g !== today);
  const ranking = rec(c.ranking) ?? rec(c.candidates) ?? {};
  const next = rec(c.next);
  return (
    <details className="mt-2 rounded-xl bg-white p-3" open>
      <summary className="cursor-pointer text-[15px] font-bold">
        {str(c.name) || str(c.conversationId)} <span className="font-normal text-ink-2">· score {fmt(c.score)}{c.muted ? " · muted" : ""}</span>
      </summary>
      <div className="mt-1 flex gap-3 text-[12px]"><Link href={`/messages/${str(c.conversationId)}`} className="font-semibold text-fb">Open chat</Link><span className="text-ink-2">{str(c.conversationId)} · {arr(c.members).length} members · streak {fmt(c.streakDays)}d{next ? ` · next ${str(next.tier)} at ${fmt(next.at)}` : ""}{arr(c.earned).length ? ` · earned ${arr(c.earned).join(", ")}` : ""}</span></div>
      <Section title="Score parts (0-1)"><KV value={rec(c.parts)} /></Section>
      <Section title="Chat topics"><Table rows={recs(c.topics)} cols={["label", "score", "mean", "coverage", "agreement", "games", "observedBy"]} /></Section>
      <Section title="Today's game">{today ? <Game g={today} /> : <div className="text-[12px] text-ink-2">No game today yet.</div>}</Section>
      {earlier.length > 0 && <Section title={`Earlier games (${earlier.length})`}><details><summary className="cursor-pointer text-[11.5px] font-semibold text-fb">Show</summary><div className="mt-1 space-y-1.5">{earlier.map((g, i) => <Game key={str(g.id) || i} g={g} />)}</div></details></Section>}
      <Section title="Unlock candidates (ranked by code)">
        {Object.entries(ranking).map(([tier, list]) => (
          <div key={tier} className="mb-2">
            <div className="text-[12px] font-semibold">{tier}</div>
            {recs(list).length ? recs(list).map((x, i) => (
              <div key={i} className="border-t border-line/40 py-1 text-[11.5px]">
                <div><b className="font-semibold">{i + 1}. {str(x.title) || str(x.id)}</b> <span className="text-ink-2">· {str(x.topic)} · {fmt(x.score)}</span></div>
                <KV value={rec(x.parts)} />
                {arr(x.facts).map((f, j) => <div key={j} className="text-ink-2">· {fmt(f)}</div>)}
              </div>
            )) : <div className="text-[11.5px] text-ink-2">none</div>}
          </div>
        ))}
      </Section>
      <Section title="Unlocks posted"><Table rows={recs(c.unlocks)} cols={["tier", "title", "topic", "score", "mode", "why"]} /></Section>
      <Section title="Member affinity (dev only; never sent to other members)">
        {recs(c.affinity).map((a, i) => <div key={i} className="mb-1 text-[11.5px]"><b className="font-semibold">{str(rec(a.user)?.first) || str(rec(a.user)?.id)}</b> <span className="text-ink-2">{recs(a.topics).map((t) => `${str(t.topic)} ${fmt(t.score)} (${fmt(t.observations)})`).join(" · ") || "no signal"}</span></div>)}
      </Section>
      <Section title={`Recent events (${events.length})`}>
        <Table rows={events.slice(0, 25).map((e) => ({ ...e, at: time(e.at) }))} cols={["at", "userId", "kind", "roundId", "topic", "ms", "choice"]} />
      </Section>
    </details>
  );
}

export default function PlayInspectorPage() {
  const { data, error, mutate } = useApi<unknown>("/api/play/inspect", { poll: 3000 });
  const { data: convs } = useApi<{ id: string; name: string }[]>("/api/conversations");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [raw, setRaw] = useState(false);

  const root = rec(data);
  const chats = recs(root?.chats ?? (Array.isArray(data) ? data : undefined));
  const events = recs(root?.events);
  const picks = [...(convs ?? []).map((c) => ({ id: c.id, name: c.name })), ...chats.map((c) => ({ id: str(c.conversationId), name: str(c.name) || str(c.conversationId) }))].filter((c, i, a) => c.id && a.findIndex((x) => x.id === c.id) === i);
  const chosen = target || picks[0]?.id || "";

  async function make(format: string) {
    if (!chosen) return;
    setBusy(format);
    setNote("");
    try {
      const r = await api<{ game?: { title?: string; formatLabel?: string; mode?: string } }>("/api/play/dev", { method: "POST", json: { conversationId: chosen, format } });
      setNote(`Made ${r.game?.formatLabel ?? format}: ${r.game?.title ?? "(untitled)"}${r.game?.mode ? ` · ${r.game.mode}` : ""}`);
      mutate();
      refresh(`/api/conversations/${chosen}`);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy("");
    }
  }

  return (
    <Shell back title="Play inspector" tabs={false}>
      <div className="px-2 pb-8">
        <div className="mt-2 rounded-xl bg-white p-3">
          <div className="text-[15px] font-bold">Make a game now</div>
          <div className="text-[12px] text-ink-2">Dev only. Replaces today&apos;s game for the chat and posts its card.</div>
          <select value={chosen} onChange={(e) => setTarget(e.target.value)} className="mt-2 w-full rounded-lg border border-line bg-white px-2 py-1.5 text-[14px]">
            {picks.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.id})</option>)}
          </select>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {FORMATS.map(([id, label]) => <button key={id} disabled={!!busy || !chosen} onClick={() => make(id)} className="rounded-lg bg-[#e4e6eb] py-1.5 text-[13px] font-semibold disabled:opacity-50">{busy === id ? "…" : label}</button>)}
          </div>
          {note && <div className="mt-2 text-[12px] text-ink-2">{note}</div>}
          <KV value={rec(root?.totals)} />
        </div>
        {error && !data && <div className="mt-2 rounded-xl bg-white p-3 text-[13px] text-red-700">Couldn&apos;t load /api/play/inspect: {error instanceof Error ? error.message : "error"}</div>}
        {data !== undefined && chats.length === 0 && <div className="mt-2 rounded-xl bg-white p-3 text-[13px] text-ink-2">No chat has a game yet. Open a thread or make one above.</div>}
        {chats.map((c, i) => <Chat key={str(c.conversationId) || i} c={c} events={events.filter((e) => e.conversationId === c.conversationId)} />)}
        {data !== undefined && (
          <div className="mt-2 rounded-xl bg-white p-3">
            <button onClick={() => setRaw((v) => !v)} className="text-[13px] font-semibold text-fb">{raw ? "Hide" : "Show"} raw inspect payload</button>
            {raw && <div className="mt-2"><Json value={data} /></div>}
          </div>
        )}
      </div>
    </Shell>
  );
}

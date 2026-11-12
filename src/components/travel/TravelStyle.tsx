"use client";
// "Your travel style" on the user's own profile. Every line shows its evidence; every line can be edited or
// deleted; a visible button re-runs it. Other people's agents only ever get the lines as left here.
import { useState } from "react";
import { Compass, Pencil, RefreshCw, Trash2, X, Check } from "lucide-react";
import { Button, cx } from "@/components/ui";
import { api, useApi } from "@/lib/api";
import type { TravelStyle } from "@/lib/travel/store";

export function TravelStyleCard() {
  const { data, mutate } = useApi<{ style: TravelStyle | null }>("/api/me/travel-style");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [text, setText] = useState("");
  const s = data?.style ?? null;
  const refresh = async () => {
    setBusy(true);
    try { mutate(await api("/api/me/travel-style", { method: "POST" }), false); } finally { setBusy(false); }
  };
  const remove = async (id: string) => mutate(await api("/api/me/travel-style", { method: "PATCH", json: { remove: [id] } }), false);
  const save = async (id: string) => { mutate(await api("/api/me/travel-style", { method: "PATCH", json: { lines: [{ id, text }] } }), false); setEditing(null); };
  return (
    <div className="rounded-xl bg-[#f0f2f5] p-3">
      <div className="flex items-center gap-3">
        <Compass size={20} className="text-ink-2" />
        <span className="flex-1"><b className="font-semibold">Your travel style</b><div className="text-[13px] text-ink-2">Built only from your own posts, Reels and likes. You see the evidence; you can change or delete any line. Hosts&apos; agents only get the lines you keep.</div></span>
      </div>
      {!s ? (
        <Button variant="secondary" className="mt-3 w-full" onClick={refresh} disabled={busy}>{busy ? "Reading your posts…" : "Build my travel style"}</Button>
      ) : (
        <div className="mt-3 space-y-2">
          {s.lines.length === 0 && <div className="text-[13px] text-ink-2">Nothing survived the evidence check. Post more, or write your own lines.</div>}
          {s.lines.map((l) => (
            <div key={l.id} className="rounded-lg bg-white p-2.5">
              <div className="flex items-start gap-2">
                <span className="shrink-0 rounded-full bg-fb/10 px-2 py-0.5 text-[11px] font-semibold text-fb">{l.label}</span>
                <div className="min-w-0 flex-1">
                  {editing === l.id ? (
                    <div className="flex gap-1"><input value={text} onChange={(e) => setText(e.target.value)} className="w-full rounded border border-line px-2 py-1 text-[13.5px] outline-none" /><button onClick={() => save(l.id)} className="text-emerald-600"><Check size={16} /></button><button onClick={() => setEditing(null)} className="text-ink-2"><X size={16} /></button></div>
                  ) : (
                    <div className="text-[13.5px] leading-snug">{l.text}{l.edited && <span className="ml-1 text-[11px] text-ink-2">(edited)</span>}</div>
                  )}
                  <div className="mt-0.5 text-[11.5px] text-ink-2">because · {l.evidence}</div>
                </div>
                <button onClick={() => { setEditing(l.id); setText(l.text); }} className="text-ink-2"><Pencil size={14} /></button>
                <button onClick={() => remove(l.id)} className="text-ink-2 hover:text-red-600"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2 text-[11px] text-ink-2">
            <span className={cx("rounded px-1.5 py-0.5 font-semibold uppercase", s.mode.startsWith("live") ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800")}>{s.mode}</span>
            <span>{new Date(s.generatedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · read {s.consideredIds.length} of your items</span>
            <button onClick={refresh} disabled={busy} className="ml-auto flex items-center gap-1 font-semibold text-fb"><RefreshCw size={12} className={busy ? "animate-spin" : ""} /> {busy ? "Re-reading…" : "Refresh"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

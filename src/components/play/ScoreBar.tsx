"use client";
// The chat's interaction score under the thread header: 0-100, progress to the next unlock, streak, top chat topics.
// Everything shown is a chat total except "your topics", which the server only ever returns for the viewer.
import { useState } from "react";
import { BellOff, Check, ChevronRight, Flame } from "lucide-react";
import { cx } from "@/components/ui";
import { api, useApi } from "@/lib/api";
import type { ChatView } from "@/lib/play/views";
import { PlaySheet } from "./shared";

const TIER_NOUN: Record<string, string> = { group: "Group", event: "Event", listing: "Marketplace pick" };
const PARTS: { key: keyof ChatView["parts"]; label: string; weight: number; hint: string }[] = [
  { key: "participation", label: "Participation", weight: 40, hint: "share of the chat finishing each game" },
  { key: "streak", label: "Streak", weight: 20, hint: "days in a row most of you played" },
  { key: "reciprocity", label: "Reciprocity", weight: 20, hint: "reacting and replying after results" },
  { key: "confidence", label: "Topic confidence", weight: 20, hint: "how settled the chat's top topic is" },
];
const pct = (n: number) => `${Math.round(Math.max(0, Math.min(1, n || 0)) * 100)}%`;

export function ScoreBar({ conversationId, onChanged }: { conversationId: string; onChanged?: () => void }) {
  const path = `/api/play/chat/${conversationId}`;
  const { data: v, mutate } = useApi<ChatView>(path, { poll: 3000 });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!v) return null;
  const toward = v.next ? Math.min(1, v.score / Math.max(1, v.next.at)) : 1;
  const noun = v.next ? TIER_NOUN[v.next.tier] ?? "Next" : "";
  const caption = !v.next ? "Every unlock reached" : v.next.ready ? `${noun} unlocks on the next finished game` : v.score >= v.next.at ? `${noun} is up next` : `${noun} unlocks at ${v.next.at}`;
  const tiers = Object.entries(v.thresholds ?? {}).sort((a, b) => a[1] - b[1]);
  const toggle = async () => {
    setBusy(true);
    try { mutate(await api<ChatView>(path, { method: "POST", json: { action: v.muted ? "unmute" : "mute" } }), { revalidate: false }); onChanged?.(); } finally { setBusy(false); }
  };
  return (
    <>
      <button onClick={() => setOpen(true)} className="block w-full border-t border-line/40 px-3 py-1.5 text-left">
        {v.muted ? (
          <span className="flex items-center gap-2 text-[12.5px] text-ink-2"><BellOff size={14} /> Games are muted for this chat <ChevronRight size={14} className="ml-auto" /></span>
        ) : (
          <>
            <span className="flex items-center gap-2">
              <span className="text-[17px] font-bold leading-none tabular-nums">{v.score}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e4e6eb]"><span className="block h-full rounded-full bg-messenger transition-all" style={{ width: pct(toward) }} /></span>
              <span className={cx("flex shrink-0 items-center gap-0.5 text-[12.5px] font-semibold", v.streakDays > 0 ? "text-orange-600" : "text-ink-2")}><Flame size={14} className={v.streakDays > 0 ? "fill-orange-500" : ""} /> {v.streakDays} {v.streakDays === 1 ? "day" : "days"}</span>
              <ChevronRight size={14} className="shrink-0 text-ink-2" />
            </span>
            <span className="mt-1 flex items-center gap-1.5 overflow-hidden text-[11.5px] text-ink-2">
              <span className="shrink-0">{caption}</span>
              {v.topics.slice(0, 3).map((t) => <span key={t.topic} className="shrink-0 rounded-full bg-[#f0f2f5] px-2 py-0.5 text-ink">{t.label}</span>)}
            </span>
          </>
        )}
      </button>
      <PlaySheet open={open} onClose={() => setOpen(false)} title="Chat score">
        <div className="px-4 pt-3 pb-6">
          <div className="flex items-end gap-3">
            <span className="text-[40px] font-bold leading-none tabular-nums">{v.score}</span>
            <span className="pb-1 text-[13px] leading-snug text-ink-2">out of 100 · last 14 days · {v.games} {v.games === 1 ? "game" : "games"}<br />{v.streakDays}-day streak · {caption.toLowerCase()}</span>
          </div>
          <div className="mt-4 space-y-2.5">
            {PARTS.map((p) => (
              <div key={p.key}>
                <div className="flex items-baseline justify-between text-[13.5px]"><span><b className="font-semibold">{p.label}</b> <span className="text-ink-2">· {p.weight}% of the score</span></span><span className="font-semibold tabular-nums">{pct(v.parts[p.key])}</span></div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#e4e6eb]"><div className="h-full rounded-full bg-messenger" style={{ width: pct(v.parts[p.key]) }} /></div>
                <div className="mt-0.5 text-[11.5px] text-ink-2">{p.hint}</div>
              </div>
            ))}
          </div>
          {tiers.length > 0 && (
            <div className="mt-4 flex gap-2">
              {tiers.map(([tier, at]) => {
                const got = v.unlocks.some((u) => u.tier === tier);
                return <div key={tier} className={cx("flex-1 rounded-lg border px-2 py-1.5 text-center", got ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-line/60 text-ink-2")}><div className="text-[15px] font-bold tabular-nums">{got ? <Check size={15} className="inline" /> : at}</div><div className="text-[11.5px]">{TIER_NOUN[tier] ?? tier}</div></div>;
              })}
            </div>
          )}
          <div className="mt-4 text-[15px] font-semibold">What this chat is into</div>
          <div className="text-[12px] text-ink-2">Chat totals. Nobody sees anyone else&apos;s numbers.</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {v.topics.length ? v.topics.map((t) => <span key={t.topic} className="rounded-full bg-[#e7f3ff] px-2.5 py-1 text-[13px] font-medium text-fb">{t.label}{t.games ? <span className="text-fb/70"> · {t.games} {t.games === 1 ? "game" : "games"}</span> : null}</span>) : <span className="text-[13px] text-ink-2">Play a few games to find out.</span>}
          </div>
          <div className="mt-4 text-[15px] font-semibold">Your topics</div>
          <div className="text-[12px] text-ink-2">Only you see this.</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {v.myTopics.length ? v.myTopics.map((t) => <span key={t.topic} className="rounded-full bg-[#f0f2f5] px-2.5 py-1 text-[13px] font-medium">{t.label}</span>) : <span className="text-[13px] text-ink-2">Nothing yet.</span>}
          </div>
          <button disabled={busy} onClick={toggle} className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#e4e6eb] py-2 text-[14px] font-semibold disabled:opacity-50">
            <BellOff size={15} /> {v.muted ? "Turn games back on for this chat" : "Mute games for this chat"}
          </button>
          <div className="mt-1.5 text-center text-[11.5px] text-ink-2">{v.muted ? "No new daily games are being made here." : "Muting stops the daily game for everyone in this chat."}</div>
        </div>
      </PlaySheet>
    </>
  );
}

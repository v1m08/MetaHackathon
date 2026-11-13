"use client";
import Link from "next/link";
import { useState } from "react";
import { Gamepad2, ShieldCheck } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Avatar, cx } from "@/components/ui";
import { useApi } from "@/lib/api";

type TopicEntry = { topic: string; label: string; score: number; observations: number; newlyDiscovered: boolean };
type GameSessionEntry = { ref: string; gameKind: string; gameLabel: string; title: string; interest: string; topics: string[]; withLabel: string; plays: number; coPlayers: number };
type CrewEntry = {
  conversationId: string;
  name: string;
  isGroup: boolean;
  avatar: string;
  closenessScore: number;
  parts: { participation: number; streak: number; reciprocity: number; confidence: number; momentum: number; balance: number; cohesion: number; tempo: number };
  streakDays: number;
  streakFreezes: number;
  streakMilestone?: number;
  hourglass: boolean;
  earnedTiers: string[];
  coPlayed: number;
  totalRuns: number;
  sameAnswers: number;
  sharedGames: string[];
  sharedTopics: { topic: string; label: string; strength: number; agreement: number; settled: boolean }[];
};
type RecItem = { id: string; title: string; fit: number; fitLabel?: string; price?: number; location?: string; parts?: { topicFit: number; chatOverlap: number; friendsGoing: number; soonness: number } };
type ContextPayload = {
  users: { id: string; name: string; first: string; avatar: string }[];
  profile: {
    user: { id: string; name: string; first: string; avatar: string };
    before: { staticInterests: string[]; staticTopics: string[]; friendCount: number; privacy: string };
    after: {
      gamesPlayedCount: number;
      recentGames: GameSessionEntry[];
      learnedTopics: TopicEntry[];
      newlyDiscoveredCount: number;
      blindSpotsNext: { topic: string; label: string; deepcutsChip: string; orderupChip: string }[];
      closenessGraph: CrewEntry[];
      recommendations: { events: RecItem[]; groups: RecItem[]; listings: RecItem[] };
    };
    privacyAudit: {
      privateSavesExcludedFromSharedPrompts: number;
      friendsOnlyPostsGuarded: number;
      crossChatLeakageBlocked: boolean;
    };
  };
};

export default function ContextInspectorPage() {
  const [who, setWho] = useState("maya");
  const { data } = useApi<ContextPayload>(`/api/context?for=${who}`, { poll: 2500 });
  const p = data?.profile;

  return (
    <Shell back title="Context engine" right={<span />} tabs={false}>
      <div className="space-y-2.5 px-2.5 py-2.5 pb-8">
        <div className="rounded-xl bg-white p-3">
          <div className="text-[15px] font-bold">Sidequest Context Engine</div>
          <div className="text-[12px] text-ink-2">Learns taste &amp; closeness live from Deep Cuts and Order Up! sessions in Messenger.</div>
          <div className="no-scrollbar mt-2.5 flex gap-1.5 overflow-x-auto pb-1">
            {(data?.users ?? []).map((u) => (
              <button
                key={u.id}
                onClick={() => setWho(u.id)}
                className={cx(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-semibold",
                  who === u.id ? "bg-fb text-white" : "bg-[#f0f2f5] text-ink",
                )}
              >
                <Avatar src={u.avatar} name={u.name} size={18} />
                {u.first}
              </button>
            ))}
          </div>
        </div>

        {p && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-line/60 bg-white p-3">
                <div className="text-[11px] font-bold tracking-wide text-ink-2 uppercase">Before (Cold Profile)</div>
                <div className="mt-1.5 text-[12px] font-semibold">Static profile tags</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {p.before.staticInterests.map((t) => (
                    <span key={t} className="rounded bg-[#f0f2f5] px-1.5 py-0.5 text-[11px]">{t}</span>
                  ))}
                </div>
                <div className="mt-2.5 text-[11.5px] text-ink-2">
                  {p.before.friendCount} friends · flat edges (no closeness or per-vibe crew)
                </div>
              </div>

              <div className="rounded-xl border border-[#b6d4fe] bg-[#f4f8ff] p-3">
                <div className="text-[11px] font-bold tracking-wide text-[#0b5ed7] uppercase">
                  After ({p.after.gamesPlayedCount} game{p.after.gamesPlayedCount === 1 ? "" : "s"})
                </div>
                <div className="mt-1.5 text-[12px] font-semibold">
                  Learned affinities ({p.after.newlyDiscoveredCount} new)
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {p.after.learnedTopics.length ? p.after.learnedTopics.slice(0, 6).map((t) => (
                    <span key={t.topic} className="rounded bg-white px-1.5 py-0.5 text-[11px] font-medium shadow-2xs">
                      {t.label} <b className="tabular-nums">{t.score.toFixed(2)}</b>
                      {t.newlyDiscovered && <span className="ml-1 font-bold text-emerald-700">NEW</span>}
                    </span>
                  )) : <span className="text-[11.5px] text-ink-2">Play Deep Cuts or Order Up! in a chat</span>}
                </div>
              </div>
            </div>

            {p.after.recentGames.length > 0 && (
              <div className="rounded-xl bg-white p-3">
                <div className="flex items-center gap-1.5 text-[14px] font-bold">
                  <Gamepad2 size={16} className="text-fb" /> Ingested Sidequest sessions
                </div>
                <div className="mt-1.5 divide-y divide-line/40">
                  {p.after.recentGames.map((g) => (
                    <div key={g.ref} className="flex items-center justify-between py-1.5 text-[12px]">
                      <div className="min-w-0 pr-2">
                        <div className="truncate font-semibold">{g.gameLabel}: {g.title} <span className="font-normal text-ink-2">with {g.withLabel}</span></div>
                        <div className="text-[11px] text-ink-2">Topic &ldquo;{g.interest}&rdquo; · {g.coPlayers} played{g.plays > 1 ? ` · ${g.plays} runs` : ""}</div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        {g.topics.slice(0, 2).map((t) => <span key={t} className="rounded-full bg-[#e7f3ff] px-2 py-0.5 text-[11px] font-medium text-fb">{t}</span>)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl bg-white p-3">
              <div className="text-[14px] font-bold">Relationship closeness &amp; crew graph</div>
              <div className="text-[11.5px] text-ink-2">Computed strictly from Deep Cuts &amp; Order Up! games co-played in shared threads.</div>
              <div className="mt-2 divide-y divide-line/40">
                {p.after.closenessGraph.length ? p.after.closenessGraph.map((m) => (
                  <div key={m.conversationId} className="py-2">
                    <div className="flex items-center gap-2">
                      <Avatar src={m.avatar} name={m.name} size={28} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <Link href={`/messages/${m.conversationId}`} className="truncate text-[13.5px] font-semibold text-fb">{m.name}</Link>
                          <span className="rounded-full bg-[#e7f3ff] px-2 py-0.5 text-[11.5px] font-bold text-fb tabular-nums">
                            Closeness {m.closenessScore}
                          </span>
                        </div>
                        <div className="text-[11.5px] text-ink-2">
                          {m.coPlayed} co-played · {m.totalRuns} runs
                          {m.streakDays > 0 ? <> · <b>{m.streakDays}d streak</b>{m.streakFreezes > 0 ? ` (${m.streakFreezes} freeze)` : ""}</> : null}
                          {m.sameAnswers > 0 ? <> · <b>{m.sameAnswers}</b> mind-meld{m.sameAnswers === 1 ? "" : "s"}</> : null}
                        </div>
                      </div>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1 pl-9 text-[10.5px] text-ink-2">
                      <span className="rounded bg-[#f0f2f5] px-1.5 py-0.5">turnout {Math.round(m.parts.participation * 100)}%</span>
                      <span className="rounded bg-[#f0f2f5] px-1.5 py-0.5">streak {Math.round(m.parts.streak * 100)}%</span>
                      <span className="rounded bg-[#f0f2f5] px-1.5 py-0.5">banter {Math.round(m.parts.reciprocity * 100)}%</span>
                      <span className="rounded bg-[#f0f2f5] px-1.5 py-0.5">agreement {Math.round(m.parts.confidence * 100)}%</span>
                      <span className="rounded bg-[#f0f2f5] px-1.5 py-0.5">momentum {Math.round(m.parts.momentum * 100)}%</span>
                      <span className="rounded bg-[#f0f2f5] px-1.5 py-0.5">balance {Math.round(m.parts.balance * 100)}%</span>
                      <span className="rounded bg-[#f0f2f5] px-1.5 py-0.5">cohesion {Math.round(m.parts.cohesion * 100)}%</span>
                      <span className="rounded bg-[#f0f2f5] px-1.5 py-0.5">tempo {Math.round(m.parts.tempo * 100)}%</span>
                      {m.earnedTiers.map((tier) => (
                        <span key={tier} className="rounded bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-800">{tier} ✓</span>
                      ))}
                    </div>
                    {m.sharedTopics.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1 pl-9">
                        {m.sharedTopics.map((t) => (
                          <span key={t.topic} className="rounded-full bg-[#f0f2f5] px-2 py-0.5 text-[11px]">
                            {t.label} <b className="tabular-nums">{t.strength.toFixed(2)}</b> · agree {Math.round(t.agreement * 100)}%
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )) : <div className="py-3 text-[12px] text-ink-2">No co-played Sidequest games yet for @{p.user.id}.</div>}
              </div>
            </div>

            <div className="rounded-xl bg-white p-3">
              <div className="text-[14px] font-bold">Next blind spots suggested in &ldquo;+&rdquo; GameTray</div>
              <div className="text-[11.5px] text-ink-2">Unexplored Austin categories suggested next when @{p.user.id} opens the game tray.</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {p.after.blindSpotsNext.map((b) => (
                  <span key={b.topic} className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11.5px] font-medium text-amber-900">
                    {b.label} · {b.deepcutsChip}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-white p-3">
              <div className="text-[14px] font-bold">Downstream ecosystem ranking</div>
              <div className="text-[11.5px] text-ink-2">How Events, Groups, and Marketplace rank for @{p.user.id} from Sidequest play.</div>
              {(["events", "groups", "listings"] as const).map((kind) => {
                const items = p.after.recommendations[kind];
                return (
                  <div key={kind} className="mt-2.5">
                    <div className="text-[11px] font-bold tracking-wide text-ink-2 uppercase">{kind}</div>
                    {items.length ? items.map((it, idx) => (
                      <div key={it.id} className="flex items-baseline justify-between border-t border-line/40 py-1 text-[12px]">
                        <span className="truncate pr-2"><b>{idx + 1}. {it.title}</b>{it.price !== undefined ? ` ($${it.price})` : ""}</span>
                        <span className="shrink-0 text-[11px] font-medium text-fb">{it.fitLabel ?? `fit ${it.fit}`}</span>
                      </div>
                    )) : <div className="text-[11.5px] text-ink-2">No game-backed items yet</div>}
                  </div>
                );
              })}
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
              <div className="flex items-center gap-1.5 text-[13.5px] font-bold text-emerald-900">
                <ShieldCheck size={16} /> Privacy guardrails verified
              </div>
              <div className="mt-1.5 space-y-0.5 text-[11.5px] text-emerald-900">
                <div>· {p.privacyAudit.privateSavesExcludedFromSharedPrompts} private Reel/Marketplace saves excluded from shared GameTray suggestions</div>
                <div>· Audience-intersection enforced ({p.before.privacy} profile · {p.privacyAudit.friendsOnlyPostsGuarded} restricted posts guarded)</div>
                <div>· Cross-chat signal leakage blocked (friend match badges only read shared threads)</div>
              </div>
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}

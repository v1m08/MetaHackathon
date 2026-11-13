"use client";
// Playing a game and reading its results. One round at a time; each answer is posted with the time spent on it,
// and the server validates every choice. The client only enforces the obvious (rank everyone, spend all 10 points).
// Results, the right answers and the "made from" list only exist in the view once the server says the viewer is done.
import { useEffect, useRef, useState } from "react";
import { CalendarDays, Check, LockOpen, Minus, Plus, Quote, Tag, Users } from "lucide-react";
import { Avatar, cx } from "@/components/ui";
import { api, useApi } from "@/lib/api";
import type { RoundResult } from "@/lib/play/results";
import type { Choice, Option, Round } from "@/lib/play/store";
import type { GameView, MemberCard, UnlockView } from "@/lib/play/views";
import { Faces, ModeTag, PlaySheet } from "./shared";

type ActBody = { action: "open" | "answer" | "skip" | "complete" | "react"; roundId?: string; choice?: Choice; ms?: number; emoji?: string };
type ActResult = { game: GameView; unlock?: UnlockView };
type People = Record<string, MemberCard>;
const REACTIONS = ["😂", "🔥", "😮", "❤️", "👏"];
const POINTS = 10;
const REF_ICON = { event: CalendarDays, group: Users, listing: Tag } as const;

const isSplit = (c: Choice | undefined): c is { pick: string; predict: string } => !!c && typeof c === "object" && !Array.isArray(c) && typeof (c as { pick?: unknown }).pick === "string";
const isPoints = (c: Choice | undefined): c is Record<string, number> => !!c && typeof c === "object" && !Array.isArray(c) && !isSplit(c);
const pickOf = (c: Choice | undefined) => (typeof c === "string" ? c : isSplit(c) ? c.pick : undefined);

function OptionFace({ o, people, size = 32 }: { o: Option; people: People; size?: number }) {
  const p = o.userId ? people[o.userId] : undefined;
  if (p) return <Avatar src={p.avatar} name={p.name} size={size} />;
  if (!o.ref) return null;
  const Icon = REF_ICON[o.ref.kind] ?? Tag;
  return <span className="flex shrink-0 items-center justify-center rounded-lg bg-[#e7f0fd] text-[#0b5ed7]" style={{ width: size, height: size }}><Icon size={size * 0.5} /></span>;
}
function OptionText({ o }: { o: Option }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block text-[15px] font-semibold leading-tight">{o.label}</span>
      {o.sub && <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-2">{o.sub}</span>}
      {o.pitch && <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-2 italic">&ldquo;{o.pitch}&rdquo;</span>}
    </span>
  );
}
function QuoteBubble({ text }: { text: string }) {
  return (
    <div className="mt-3 flex items-start gap-2">
      <Quote size={16} className="mt-2 shrink-0 text-ink-2" />
      <div className="rounded-[18px] bg-[#f0f0f0] px-3 py-2 text-[15px] leading-snug break-words whitespace-pre-wrap">{text}</div>
    </div>
  );
}
function Cta({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className="mt-4 w-full rounded-lg bg-messenger py-2.5 text-[15px] font-semibold text-white transition active:scale-[.98] disabled:opacity-40">{children}</button>;
}

// ---------- the four round renderers ----------
type RoundProps = { round: Round; people: People; initial?: Choice; busy: boolean; cta: string; onSubmit: (c: Choice) => void };

function SplitRound({ round, initial, busy, cta, onSubmit }: RoundProps) {
  const init = isSplit(initial) ? initial : undefined;
  const [pick, setPick] = useState(init?.pick);
  const [predict, setPredict] = useState(init?.predict);
  return (
    <>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {round.options.map((o) => (
          <button key={o.id} onClick={() => setPick(o.id)} className={cx("flex min-h-[128px] flex-col items-center justify-center rounded-2xl border-2 p-3 text-center transition", pick === o.id ? "border-messenger bg-[#e7f3ff]" : "border-line/60 bg-white")}>
            <span className="text-[16px] font-bold leading-tight">{o.label}</span>
            {o.sub && <span className="mt-1 text-[12.5px] leading-snug text-ink-2">{o.sub}</span>}
            {pick === o.id && <span className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-messenger"><Check size={13} /> your side</span>}
          </button>
        ))}
      </div>
      {pick && (
        <div className="fadein mt-4">
          <div className="text-[15px] font-semibold">How will the chat split?</div>
          <div className="text-[12.5px] text-ink-2">Tap the side you think wins.</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {round.options.map((o) => (
              <button key={o.id} onClick={() => setPredict(o.id)} className={cx("rounded-xl border-2 px-3 py-2.5 text-[14px] font-semibold leading-tight transition", predict === o.id ? "border-amber-500 bg-amber-50 text-amber-900" : "border-line/60 bg-white")}>{o.label}</button>
            ))}
          </div>
        </div>
      )}
      <Cta disabled={busy || !pick || !predict} onClick={() => pick && predict && onSubmit({ pick, predict })}>{cta}</Cta>
    </>
  );
}

function PickRound({ round, people, initial, busy, cta, onSubmit }: RoundProps) {
  const [pick, setPick] = useState(pickOf(initial));
  return (
    <>
      {round.quote && <QuoteBubble text={round.quote} />}
      <div className="mt-3 space-y-2">
        {round.options.map((o) => (
          <button key={o.id} onClick={() => setPick(o.id)} className={cx("flex w-full items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-left transition", pick === o.id ? "border-messenger bg-[#e7f3ff]" : "border-line/60 bg-white")}>
            <OptionFace o={o} people={people} />
            <OptionText o={o} />
            <span className={cx("flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2", pick === o.id ? "border-messenger bg-messenger text-white" : "border-line")}>{pick === o.id && <Check size={12} />}</span>
          </button>
        ))}
      </div>
      <Cta disabled={busy || !pick} onClick={() => pick && onSubmit(pick)}>{cta}</Cta>
    </>
  );
}

function RankRound({ round, people, initial, busy, cta, onSubmit }: RoundProps) {
  const ids = round.options.map((o) => o.id);
  const [order, setOrder] = useState<string[]>(Array.isArray(initial) ? initial.filter((id) => ids.includes(id)) : []);
  const toggle = (id: string) => setOrder((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const left = ids.length - order.length;
  return (
    <>
      <div className="mt-1 text-[12.5px] text-ink-2">Tap in order, first to last. Tap again to clear.</div>
      <div className="mt-3 space-y-2">
        {round.options.map((o) => {
          const n = order.indexOf(o.id) + 1;
          return (
            <button key={o.id} onClick={() => toggle(o.id)} className={cx("flex w-full items-center gap-3 rounded-xl border-2 px-3 py-2 text-left transition", n ? "border-messenger bg-[#e7f3ff]" : "border-line/60 bg-white")}>
              <span className={cx("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[14px] font-bold", n ? "bg-messenger text-white" : "bg-[#e4e6eb] text-transparent")}>{n || 0}</span>
              <OptionFace o={o} people={people} />
              <OptionText o={o} />
            </button>
          );
        })}
      </div>
      <Cta disabled={busy || left > 0} onClick={() => onSubmit(order)}>{left > 0 ? `${left} left to rank` : cta}</Cta>
    </>
  );
}

function PointsRound({ round, people, initial, busy, cta, onSubmit }: RoundProps) {
  const [pts, setPts] = useState<Record<string, number>>(() => Object.fromEntries(round.options.map((o) => [o.id, isPoints(initial) ? Math.max(0, Math.round(Number(initial[o.id]) || 0)) : 0])));
  const spent = Object.values(pts).reduce((s, x) => s + x, 0);
  const left = POINTS - spent;
  const bump = (id: string, d: number) => setPts((cur) => ({ ...cur, [id]: Math.max(0, cur[id] + d) }));
  return (
    <>
      <div className="mt-2 flex items-center justify-between rounded-lg bg-[#f0f2f5] px-3 py-2 text-[13px]">
        <span className="text-ink-2">Spread {POINTS} points across what the chat would actually do.</span>
        <span className={cx("ml-2 shrink-0 font-bold", left === 0 ? "text-emerald-700" : left < 0 ? "text-red-600" : "text-ink")}>{left} left</span>
      </div>
      <div className="mt-3 space-y-2">
        {round.options.map((o) => (
          <div key={o.id} className={cx("flex items-center gap-3 rounded-xl border-2 px-3 py-2.5", pts[o.id] > 0 ? "border-messenger bg-[#e7f3ff]" : "border-line/60 bg-white")}>
            <OptionFace o={o} people={people} size={40} />
            <OptionText o={o} />
            <div className="flex shrink-0 items-center gap-1.5">
              <button aria-label={`Fewer points for ${o.label}`} disabled={pts[o.id] <= 0} onClick={() => bump(o.id, -1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e4e6eb] disabled:opacity-40"><Minus size={16} /></button>
              <span className="w-5 text-center text-[16px] font-bold tabular-nums">{pts[o.id]}</span>
              <button aria-label={`More points for ${o.label}`} disabled={left <= 0} onClick={() => bump(o.id, 1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-messenger text-white disabled:opacity-40"><Plus size={16} /></button>
            </div>
          </div>
        ))}
      </div>
      <Cta disabled={busy || left !== 0} onClick={() => onSubmit(pts)}>{left > 0 ? `${left} ${left === 1 ? "point" : "points"} left to spend` : cta}</Cta>
    </>
  );
}

const RENDER = { split: SplitRound, pick: PickRound, rank: RankRound, points: PointsRound } as const;

// ---------- results ----------
function RoundResults({ round, n, rr, mine, people }: { round: Round; n: number; rr?: RoundResult; mine?: Choice; people: People }) {
  const byId = Object.fromEntries(round.options.map((o) => [o.id, o]));
  const totals = rr?.totals ?? {};
  const max = Math.max(1, ...Object.values(totals));
  const myPick = pickOf(mine);
  const myRank = Array.isArray(mine) ? mine : [];
  const ids = round.kind === "rank" || round.kind === "points" ? (rr?.order ?? []).filter((id) => byId[id]) : round.options.map((o) => o.id);
  const unit = (v: number) => (round.kind === "points" || round.kind === "rank" ? `${v} pts` : `${v}`);
  return (
    <div className="border-t border-line/40 px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-2">Round {n}{rr ? ` · ${rr.voters} answered` : ""}{round.kind === "rank" ? " · the chat's order" : ""}</div>
      <div className="mt-0.5 text-[15px] font-semibold leading-snug">{round.prompt}</div>
      {round.quote && <QuoteBubble text={round.quote} />}
      <div className="mt-2 space-y-1.5">
        {ids.map((id, i) => {
          const o = byId[id];
          const v = totals[id] ?? 0;
          const right = rr?.answer === id;
          const who = (rr?.who[id] ?? []).map((u) => people[u]).filter(Boolean);
          const myPts = isPoints(mine) ? Number(mine[id] ?? 0) : 0;
          const myPos = myRank.indexOf(id) + 1;
          const note = round.kind === "rank" ? (myPos ? `you: #${myPos}` : "") : round.kind === "points" ? (myPts ? `you: ${myPts}` : "") : myPick === id ? "you" : "";
          return (
            <div key={id} className={cx("relative overflow-hidden rounded-lg border", right ? "border-emerald-300" : "border-line/50")}>
              <div className={cx("absolute inset-y-0 left-0", right ? "bg-emerald-100" : "bg-[#e7f3ff]")} style={{ width: `${(v / max) * 100}%` }} />
              <div className="relative flex items-center gap-2 px-2.5 py-1.5">
                {round.kind === "rank" && <span className="w-4 shrink-0 text-[13px] font-bold text-ink-2">{i + 1}</span>}
                <OptionFace o={o} people={people} size={22} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">{o.label}</span>
                  {(right || note) && <span className="block text-[11.5px] text-ink-2">{right && <span className="font-semibold text-emerald-700"><Check size={11} className="mr-0.5 inline" />right answer{note ? " · " : ""}</span>}{note}</span>}
                </span>
                <Faces people={who} size={18} max={4} />
                <span className="shrink-0 text-[13px] font-bold tabular-nums">{unit(v)}</span>
              </div>
            </div>
          );
        })}
      </div>
      {isSplit(mine) && byId[mine.predict] && <div className="mt-1.5 text-[12px] text-ink-2">You predicted the chat would go with <b className="font-semibold text-ink">{byId[mine.predict].label}</b>.</div>}
    </div>
  );
}

function Results({ g, people, unlock, busy, onReact }: { g: GameView; people: People; unlock: UnlockView | null; busy: boolean; onReact: (emoji: string) => void }) {
  const names = Object.fromEntries(g.members.map((m) => [m.id, m.first]));
  return (
    <div className="pb-6">
      {unlock && (
        <div className="fadein mx-4 mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-900">
          <LockOpen size={16} className="shrink-0" /> <span className="min-w-0"><b className="font-semibold">Unlocked: {unlock.title}</b> · it&apos;s in the chat now</span>
        </div>
      )}
      <div className="px-4 pt-3 pb-3">
        <div className="text-[18px] font-bold leading-tight">{g.title}</div>
        <div className="mt-1 flex items-center gap-2 text-[13px] text-ink-2"><Faces people={g.players} size={20} /> {g.players.length} of {g.memberCount} played</div>
        {typeof g.performance === "number" && (
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-[#f0f2f5] px-3 py-2.5">
            <span className="text-[24px] font-bold tabular-nums">{Math.round(g.performance * 100)}%</span>
            <span className="text-[13px] leading-snug text-ink-2">how well you read the room. It&apos;s just for fun; it never changes what gets recommended.</span>
          </div>
        )}
        <div className="mt-3 flex items-center gap-2">
          {REACTIONS.map((e) => (
            <button key={e} disabled={busy} onClick={() => onReact(e)} className={cx("flex h-10 w-10 items-center justify-center rounded-full text-[20px] transition active:scale-90", g.reacted === e ? "bg-[#e7f3ff] ring-2 ring-messenger" : "bg-[#f0f2f5]")}>{e}</button>
          ))}
        </div>
      </div>
      {g.rounds.map((r, i) => <RoundResults key={r.id} round={r} n={i + 1} rr={g.results?.find((x) => x.roundId === r.id)} mine={g.mine[r.id]} people={people} />)}
      {!!g.madeFrom?.length && (
        <div className="border-t border-line/40 px-4 py-3">
          <div className="flex items-center gap-2 text-[15px] font-semibold">Made from <ModeTag mode={g.mode} /></div>
          <div className="text-[12.5px] text-ink-2">Lines everyone in this chat can already see. Nothing from any other chat.</div>
          <div className="mt-2 space-y-1.5">
            {g.madeFrom.map((s) => (
              <div key={s.id} className="rounded-lg bg-[#f0f2f5] px-3 py-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-2">{s.kind}{s.by ? ` · ${names[s.by] ?? s.by}` : ""}</div>
                <div className="text-[13.5px] leading-snug break-words">{s.text}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- the sheet ----------
export function GameSheet({ id, open, onClose, onChanged }: { id: string; open: boolean; onClose: () => void; onChanged?: () => void }) {
  const path = `/api/play/games/${id}`;
  const { data: g, mutate } = useApi<GameView>(open ? path : null, { poll: 3000 });
  const [idx, setIdx] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [unlock, setUnlock] = useState<UnlockView | null>(null);
  const opened = useRef(false);
  const t0 = useRef(0);
  const ready = !!g;

  const post = async (body: ActBody) => {
    const r = await api<ActResult>(path, { method: "POST", json: body });
    mutate(r.game, { revalidate: false });
    return r;
  };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr("");
    try { await fn(); } catch (e) { setErr(e instanceof Error ? e.message : "Something went wrong"); } finally { setBusy(false); }
  };

  // Each time the sheet opens: resume at the first unanswered round. The "open" event is sent once.
  useEffect(() => {
    if (!open) { setIdx(null); return; }
    if (!g || idx !== null) return;
    const firstOpen = g.rounds.findIndex((r) => !(r.id in g.mine));
    setIdx(firstOpen < 0 ? g.rounds.length : firstOpen);
    t0.current = Date.now();
    if (!opened.current && !g.done) { opened.current = true; post({ action: "open" }).catch(() => {}); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ready]);

  const finish = async () => {
    const r = await post({ action: "complete" });
    if (r.unlock) setUnlock(r.unlock);
    onChanged?.();
  };
  const advance = async (answered: boolean) => {
    if (!g || idx === null) return;
    t0.current = Date.now();
    if (idx + 1 < g.rounds.length) return setIdx(idx + 1);
    setIdx(g.rounds.length);
    if (answered) await finish(); // the server won't complete a game with no answers; the sheet offers round 1 again instead
  };
  const answer = (round: Round, choice: Choice) => run(async () => { await post({ action: "answer", roundId: round.id, choice, ms: Math.max(0, Date.now() - t0.current) }); await advance(true); });
  const skip = (round: Round) => run(async () => { await post({ action: "skip", roundId: round.id }); await advance(Object.keys(g?.mine ?? {}).length > 0); });

  const people: People = Object.fromEntries((g?.members ?? []).map((m) => [m.id, m]));
  const round = g && idx !== null ? g.rounds[idx] : undefined;
  const Play = round ? RENDER[round.kind] ?? PickRound : null;

  return (
    <PlaySheet open={open} onClose={onClose} full title={g ? `${g.formatLabel} · ${g.topicLabel}` : "Today's game"}>
      {!g ? (
        <div className="space-y-3 p-4"><div className="h-6 w-2/3 animate-pulse rounded bg-[#f0f2f5]" /><div className="h-32 animate-pulse rounded-xl bg-[#f0f2f5]" /></div>
      ) : g.done ? (
        <Results g={g} people={people} unlock={unlock} busy={busy} onReact={(emoji) => run(async () => { await post({ action: "react", emoji }); onChanged?.(); })} />
      ) : (
        <div className="px-4 pt-3 pb-6">
          <div className="flex items-center gap-1">
            {g.rounds.map((r, i) => <span key={r.id} className={cx("h-1 flex-1 rounded-full", idx !== null && i < idx ? "bg-messenger" : i === idx ? "bg-messenger/50" : "bg-[#e4e6eb]")} />)}
          </div>
          <div className="mt-2 flex items-center justify-between text-[12px] text-ink-2">
            <span className="truncate font-semibold">{g.title}</span>
            {round && <span className="ml-2 shrink-0">Round {(idx ?? 0) + 1} of {g.rounds.length}</span>}
          </div>
          {g.subject && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
              <Avatar src={g.subject.avatar} name={g.subject.name} size={28} />
              <span>{g.iAmSubject ? <b className="font-semibold">You&apos;re in the hot seat — answer for yourself</b> : <><b className="font-semibold">{g.subject.first}</b> is in the hot seat. Answer the way you think {g.subject.first} would.</>}</span>
            </div>
          )}
          {round && Play ? (
            <div key={round.id} className="fadein mt-4">
              {idx === 0 && g.premise && <div className="mb-2 text-[13.5px] leading-snug text-ink-2">{g.premise}</div>}
              <div className="text-[19px] font-bold leading-tight">{round.prompt}</div>
              <Play round={round} people={people} initial={g.mine[round.id]} busy={busy} cta={idx === g.rounds.length - 1 ? "Lock in & see results" : "Lock in"} onSubmit={(c) => answer(round, c)} />
              <button disabled={busy} onClick={() => skip(round)} className="mt-2 w-full py-1.5 text-[13px] font-semibold text-ink-2 disabled:opacity-40">Skip this one</button>
            </div>
          ) : idx !== null && !Object.keys(g.mine).length ? (
            <div className="mt-8 text-center">
              <div className="text-[17px] font-bold">You skipped every round</div>
              <div className="mt-1 text-[13.5px] text-ink-2">Answer at least one to see how the chat played.</div>
              <Cta disabled={busy} onClick={() => { setErr(""); t0.current = Date.now(); setIdx(0); }}>Go back to round 1</Cta>
            </div>
          ) : (
            <div className="mt-8 text-center">
              <div className="text-[17px] font-bold">That&apos;s every round</div>
              <div className="mt-1 text-[13.5px] text-ink-2">See how the rest of the chat answered.</div>
              <Cta disabled={busy} onClick={() => run(finish)}>See results</Cta>
            </div>
          )}
          {err && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{err}</div>}
        </div>
      )}
    </PlaySheet>
  );
}

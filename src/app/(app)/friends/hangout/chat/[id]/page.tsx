"use client";
// Messenger mock for Hang Again. The user writes every message; Muse can attach a photo the user chose,
// draft a plan the user decides to share, and pick a keepsake after the meetup. It never sends anything itself.
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Clock, Info, MapPin, Phone, PartyPopper, Send, Sparkles, Video, Wallet, X } from "lucide-react";
import { Critter, PIN_EMOJI } from "@/components/hangout/Critter";
import { monthYear, prettyDate, timeOfDay } from "@/components/hangout/format";
import { Avatar, Button, Photo, cx } from "@/components/ui";
import { ApiError, api, refresh, useApi } from "@/lib/api";
import { keepsakeLabel } from "@/lib/hangout/parts";
import type { ChatView, NudgeView } from "@/server/hangout/views";

export default function ChatPage() {
  return (
    <Suspense>
      <Thread />
    </Suspense>
  );
}

type Plan = NonNullable<ChatView["plan"]>;

function PlanDetails({ plan }: { plan: Plan }) {
  return (
    <>
      <div className="text-[17px] font-bold">{plan.place}</div>
      <div className="mt-1 space-y-0.5 text-[14px] text-ink-2">
        <div className="flex items-center gap-1.5"><Clock size={14} /> {plan.dayTime}</div>
        <div className="flex items-center gap-1.5"><Wallet size={14} /> {plan.estCostPerPerson ? `About $${plan.estCostPerPerson} each` : "Free"}</div>
      </div>
      <p className="mt-2 text-[14px]">{plan.reason}</p>
    </>
  );
}

function Thread() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const { data: c, mutate } = useApi<ChatView>(`/api/hangout/chat/${id}`, { poll: 1500 });
  const nudgeId = params.get("nudge");
  const { data: n } = useApi<NudgeView>(nudgeId ? `/api/hangout/nudges/${nudgeId}` : null);
  const [photoId, setPhotoId] = useState<string | null>(params.get("photo"));
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const plan = c?.plan ?? null;

  const count = c?.messages.length ?? 0;
  const planKey = plan ? `${plan.sharedOn}${plan.confirmedBy.join()}${plan.metUpOn}` : "";
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [count, planKey, photoId]);

  const call = async (key: string, path: string, json: unknown) => {
    setBusy(key);
    setErr(null);
    try {
      await mutate(await api<ChatView>(path, { method: "POST", json }), { revalidate: false });
      refresh("/api/hangout");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  };
  const planAction = (action: string, extra: Record<string, unknown> = {}) => call(action, `/api/hangout/chat/${id}/plan`, { action, ...extra });

  // Coming from a "make a plan" nudge: show Muse's draft right away (only the user sees it).
  const wantsPlan = params.get("plan") === "1";
  const asked = useRef(false);
  useEffect(() => {
    if (wantsPlan && c && !c.plan && !asked.current) {
      asked.current = true;
      planAction("propose");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsPlan, c]);

  const send = async () => {
    if (!text.trim() && !photoId) return;
    await call("send", `/api/hangout/chat/${id}`, { text, photoId: photoId ?? undefined, nudgeId: nudgeId ?? undefined });
    setText("");
    setPhotoId(null);
    if (nudgeId) router.replace(`/friends/hangout/chat/${id}`);
  };

  const first = c?.friend.first ?? "";
  const attach = photoId && n?.photo?.id === photoId ? n.photo : null;
  let lastDay = "";

  return (
    <div className="relative flex h-full flex-col bg-white">
      <header className="safe-top sticky top-0 z-10 border-b border-line/60 bg-white">
        <div className="flex h-14 items-center gap-1 px-2">
          <button onClick={() => router.back()} className="rounded-full p-2 text-messenger" aria-label="Back"><ArrowLeft size={22} /></button>
          {c && (
            <Link href={`/friends/hangout/${c.friend.id}`} className="flex min-w-0 flex-1 items-center gap-2">
              <span className="relative">
                <Avatar src={c.friend.avatar} name={c.friend.name} size={36} />
                <span className="absolute -right-2.5 -bottom-2.5 rounded-full bg-white">
                  <Critter design={c.critter.design} state={c.critter.state} size={26} showKeepsakes={false} />
                </span>
              </span>
              <span className="ml-1 min-w-0">
                <span className="block truncate text-[16px] leading-tight font-semibold">{c.friend.name}</span>
                <span className="block text-[12px] text-ink-2">Messenger</span>
              </span>
            </Link>
          )}
          <button className="p-2 text-messenger" aria-label="Call"><Phone size={21} /></button>
          <button className="p-2 text-messenger" aria-label="Video"><Video size={23} /></button>
          <button className="p-2 text-messenger" aria-label="Info"><Info size={21} /></button>
        </div>
      </header>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pt-3 pb-2">
        <p className="mx-auto mb-2 max-w-[260px] text-center text-[11px] text-ink-2">Earlier messages are from chats you opted in to share with Muse.</p>
        {c?.messages.map((m, i) => {
          const mine = m.sender === "me";
          const day = m.date.slice(0, 10);
          const sep = day !== lastDay;
          lastDay = day;
          const next = c.messages[i + 1];
          const lastOfRun = !next || next.sender !== m.sender || next.date.slice(0, 10) !== day;
          return (
            <div key={m.id}>
              {sep && <div className="my-3 text-center text-[11px] font-semibold text-ink-2 uppercase">{day === c.demoDate ? `Today ${timeOfDay(m.date)}` : prettyDate(day)}</div>}
              <div className={cx("flex items-end gap-2", mine ? "justify-end" : "justify-start", lastOfRun ? "mb-2" : "mb-0.5")}>
                {!mine && <span className="w-7 shrink-0">{lastOfRun && <Avatar src={c.friend.avatar} name={c.friend.name} size={28} />}</span>}
                <div className={cx("flex max-w-[75%] flex-col", mine ? "items-end" : "items-start")}>
                  {m.photo && (
                    <figure className="mb-1">
                      <Photo src={m.photo.imagePath} alt={m.photo.place} className="w-[220px] rounded-2xl object-cover" />
                      <figcaption className="mt-0.5 text-right text-[11px] text-ink-2">{m.photo.place} · {monthYear(m.photo.date)}</figcaption>
                    </figure>
                  )}
                  {m.text && <div className={cx("rounded-[18px] px-3 py-2 text-[15px] leading-snug break-words", mine ? "bg-messenger text-white" : "bg-[#f0f0f0] text-ink")}>{m.text}</div>}
                </div>
              </div>
            </div>
          );
        })}

        {plan?.sharedOn && c && (
          <div className="fadein mx-auto my-3 w-[90%] overflow-hidden rounded-2xl border border-line/70 bg-white shadow-sm">
            <div className="flex items-center gap-1.5 bg-[#eef4ff] px-3 py-2 text-[12px] font-semibold text-fb"><Sparkles size={13} /> Plan · suggested with Muse</div>
            <div className="p-3">
              <PlanDetails plan={plan} />
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[{ who: "me", name: "You" }, { who: c.friend.id, name: first }].map(({ who, name }) =>
                  plan.confirmedBy.includes(who) ? (
                    <span key={who} className="flex items-center justify-center gap-1 rounded-lg bg-[#E3F6E8] py-2 text-[14px] font-semibold text-[#1E7B3A]"><Check size={15} /> {name === "You" ? "You're in" : `${name}'s in`}</span>
                  ) : (
                    <Button key={who} variant={who === "me" ? "primary" : "secondary"} disabled={!!busy} onClick={() => planAction("confirm", { who })} className="flex-col !gap-0 leading-tight">
                      <span>{who === "me" ? "Yes" : `Yes for ${name}`}</span>
                      {who !== "me" && <span className="text-[10px] font-normal text-ink-2">demo: answer as {name}</span>}
                    </Button>
                  ),
                )}
              </div>
              {plan.confirmedBy.length === 2 && !plan.metUpOn && (
                <Button variant="secondary" className="mt-2 w-full" disabled={!!busy} onClick={() => planAction("met")}>
                  <PartyPopper size={16} /> {busy === "met" ? "Logging it…" : "We met up"}
                </Button>
              )}
              {plan.metUpOn && (
                <div className="pop mt-3 flex flex-col items-center rounded-xl bg-[#FFF3E2] px-3 pt-1 pb-3 text-center">
                  <Critter design={c.critter.design} state={c.critter.state} size={110} />
                  <div className="text-[16px] font-bold">You two met up at {plan.place}!</div>
                  {plan.keepsake && (
                    <div className="mt-1 text-[14px]">
                      New keepsake: <span className="text-[17px]">{PIN_EMOJI[plan.keepsake]}</span> {keepsakeLabel(plan.keepsake)}
                    </div>
                  )}
                  <Link href="/friends/hangout" className="mt-2 text-[14px] font-semibold text-fb">See your Hangout</Link>
                </div>
              )}
            </div>
          </div>
        )}
        <div ref={bottom} />
      </div>

      {plan && !plan.sharedOn && (
        <div className="slideup mx-3 mb-2 rounded-2xl border border-[#cfe0ff] bg-[#f5f9ff] p-3">
          <div className="mb-1 flex items-center justify-between text-[12px] font-semibold text-fb">
            <span className="flex items-center gap-1.5"><Sparkles size={13} /> Muse suggests · only you can see this</span>
            <button onClick={() => planAction("dismiss")} aria-label="Dismiss plan" className="text-ink-2"><X size={16} /></button>
          </div>
          <PlanDetails plan={plan} />
          <Button className="mt-2 w-full" disabled={!!busy} onClick={() => planAction("share")}><MapPin size={16} /> Share in chat</Button>
        </div>
      )}

      {err && <div className="mx-3 mb-2 rounded-lg bg-[#fff1f0] px-3 py-2 text-[13px] text-[#b42318]">{err}</div>}

      <div className="border-t border-line/60 bg-white px-2 pt-2 pb-2">
        {!plan && c && (
          <div className="mb-2 flex gap-2 px-1">
            <button onClick={() => planAction("propose")} disabled={!!busy} className={cx("flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold", wantsPlan ? "hang-glow border-fb bg-[#eef4ff] text-fb" : "border-line text-ink")}>
              <Sparkles size={14} /> {busy === "propose" ? "Checking both calendars…" : "Suggest a plan"}
            </button>
          </div>
        )}
        {attach && (
          <div className="mb-2 flex items-center gap-2 px-1">
            <span className="relative">
              <Photo src={attach.imagePath} className="h-16 w-16 rounded-xl object-cover" />
              <button onClick={() => setPhotoId(null)} className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-white" aria-label="Remove photo"><X size={12} /></button>
            </span>
            <span className="text-[12px] text-ink-2">{attach.place} · {monthYear(attach.date)}<br />Add your own words, or just send the photo.</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <div className="flex flex-1 items-center rounded-full bg-[#f0f2f5] pr-1">
            <input ref={input} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Write your own message…" className="flex-1 bg-transparent px-3 py-2 text-[15px] outline-none" />
          </div>
          <button onClick={send} disabled={busy === "send" || (!text.trim() && !photoId)} className="p-1.5 text-messenger disabled:opacity-40" aria-label="Send"><Send size={24} /></button>
        </div>
      </div>
    </div>
  );
}

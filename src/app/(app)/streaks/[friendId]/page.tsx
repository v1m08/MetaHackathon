"use client";
// One friend's streak: their critter, today for each of you, the last 14 days, and the way into today's game.
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Flame, Gamepad2, MessageCircle, Sparkles } from "lucide-react";
import { Critter } from "@/components/hangout/Critter";
import { MessengerShell } from "@/components/messenger/MessengerShell";
import { Avatar, Button, cx } from "@/components/ui";
import { api, refresh, useApi } from "@/lib/api";
import { endsLabel, STATUS, statusLine, timeLeft } from "@/lib/streaks/copy";
import type { DayMark, StreakDetail } from "@/lib/streaks/views";

const MARK: Record<DayMark, { dot: string; label: string }> = {
  both: { dot: "bg-orange-500 text-white", label: "you both played" },
  one: { dot: "border-2 border-orange-400 bg-orange-50 text-orange-500", label: "one of you played" },
  none: { dot: "border-2 border-[#d8dadf] bg-white text-[#bcc0c4]", label: "nobody played" },
  nogame: { dot: "border-2 border-dashed border-[#e4e6eb] bg-white", label: "no game" },
};
const weekday = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "narrow", timeZone: "UTC" });

export default function StreakPage() {
  const { friendId } = useParams<{ friendId: string }>();
  const router = useRouter();
  const path = `/api/streaks/${friendId}`;
  const { data: s, mutate } = useApi<StreakDetail>(path, { poll: 3000 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!s) return <MessengerShell back title=""><div className="skeleton m-3 h-72 rounded-3xl" /></MessengerShell>;
  const ends = endsLabel(s.endsAt);

  const openChat = async () => {
    if (s.conversationId) return router.push(`/messages/${s.conversationId}`);
    const c = await api<{ id: string }>(`/api/conversations/with/${s.friendId}`, { method: "POST" });
    router.push(`/messages/${c.id}`);
  };
  const friendPlays = async () => {
    setBusy(true);
    setError("");
    try {
      await mutate(await api<StreakDetail>(path, { method: "POST", json: { action: "friendPlays" } }), { revalidate: false });
      refresh("/api/streaks");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <MessengerShell back title={s.first}>
      <section className="relative mx-3 mt-3 overflow-hidden rounded-3xl px-4 pt-4 pb-5 text-center shadow-sm" style={{ background: "linear-gradient(#FFF3E2, #FFFaF3)" }}>
        <div className="flex items-center justify-center gap-2">
          <Avatar src={s.avatar} name={s.name} size={30} />
          <span className="text-[17px] font-bold">{s.name}</span>
        </div>
        <div className="mt-1 flex justify-center">
          <Critter design={s.design} state={s.state} size={176} label={`${s.first}'s critter`} />
        </div>
        <span className={cx("inline-block rounded-full px-2.5 py-0.5 text-[12px] font-semibold", STATUS[s.status].chip)}>{STATUS[s.status].label}</span>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-[28px] font-bold leading-none tabular-nums">
          <Flame size={26} className={s.streak > 0 ? "fill-orange-500 text-orange-600" : "text-ink-2"} /> {s.streak}
          <span className="text-[16px] font-semibold text-ink-2">{s.streak === 1 ? "day" : "days"}</span>
        </p>
        <p className="mt-2 text-[15px] font-semibold">{statusLine(s, ends)}</p>
        <p className="mt-0.5 text-[12.5px] text-ink-2">{s.first}&apos;s critter is a {s.animal}</p>
      </section>

      <div className="mx-3 mt-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line/30">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] font-semibold text-ink-2 uppercase">Today</span>
          <span className="text-[12.5px] text-ink-2">resets {ends} · {timeLeft(s.endsAt)} left</span>
        </div>
        <div className="mt-2 flex gap-2 text-[14px]">
          <span className={cx("flex-1 rounded-xl px-3 py-2", s.today.me ? "bg-[#e3f6e8] text-[#1e7b3b]" : "bg-[#f0f2f5] text-ink-2")}>You · {s.today.me ? "played" : "not yet"}</span>
          <span className={cx("flex-1 rounded-xl px-3 py-2", s.today.them ? "bg-[#e3f6e8] text-[#1e7b3b]" : "bg-[#f0f2f5] text-ink-2")}>{s.first} · {s.today.them ? "played" : "not yet"}</span>
        </div>
        <Button className="mt-3 w-full !bg-messenger" onClick={openChat}>
          {s.today.me ? <><MessageCircle size={17} /> Message {s.first}</> : <><Gamepad2 size={17} /> Play today&apos;s game</>}
        </Button>
        {!s.today.them && s.conversationId && (
          <button onClick={friendPlays} disabled={busy} className="mt-2 flex w-full items-center justify-center gap-1 text-[12.5px] text-ink-2 disabled:opacity-50">
            <Sparkles size={13} /> {busy ? "Playing…" : `Demo: have ${s.first} play today's game`}
          </button>
        )}
        {error && <p className="mt-1 text-center text-[12.5px] text-red-600">{error}</p>}
      </div>

      <div className="mx-3 mt-3 mb-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line/30">
        <span className="text-[13px] font-semibold text-ink-2 uppercase">Last 14 days</span>
        <div className="mt-3 grid grid-cols-7 gap-y-3">
          {s.days.map((d, i) => (
            <div key={d.date} className="flex flex-col items-center gap-1" title={`${d.date}: ${MARK[d.mark].label}`}>
              <span className={cx("flex h-7 w-7 items-center justify-center rounded-full", MARK[d.mark].dot, i === s.days.length - 1 && "ring-2 ring-messenger ring-offset-2")}>
                {(d.mark === "both" || d.mark === "one") && <Flame size={14} className={d.mark === "both" ? "fill-current" : ""} />}
              </span>
              <span className="text-[11px] text-ink-2">{i === s.days.length - 1 ? "Today" : weekday(d.date)}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-ink-2">
          {(["both", "one", "none"] as DayMark[]).map((m) => (
            <span key={m} className="flex items-center gap-1"><span className={cx("inline-block h-3 w-3 rounded-full", MARK[m].dot)} /> {MARK[m].label}</span>
          ))}
        </div>
        {s.conversationId && (
          <Link href={`/messages/${s.conversationId}`} className="mt-3 block text-center text-[13px] font-semibold text-messenger">Open your chat</Link>
        )}
      </div>
    </MessengerShell>
  );
}

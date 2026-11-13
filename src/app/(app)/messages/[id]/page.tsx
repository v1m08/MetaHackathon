"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GAMES, GameCard, GamePlayer, GameTray, type Finished } from "@/components/ChatGames";
import { EventPicksSheet } from "@/components/events/EventPicksSheet";
import { Critter } from "@/components/hangout/Critter";
import { useBack, useMe } from "@/components/Shell";
import { DemoGuide, type GuideStep } from "@/components/DemoGuide";
import { DEMO_CHAT, MUSE_ID } from "@/lib/demo";
import { ArrowLeft, Flame, Image as ImageIcon, Info, Phone, Plus, Send, Smile, Sparkles, ThumbsUp, Video, X } from "lucide-react";
import { Avatar, Photo, cx } from "@/components/ui";
import { api, refresh, useApi } from "@/lib/api";
import { eventDate, messageTime } from "@/lib/format";
import { useSession } from "@/lib/session";
import { endsLabel, STATUS, statusLine } from "@/lib/streaks/copy";
import type { DayMark, StreakDetail } from "@/lib/streaks/views";
import type { Conversation, FBEvent, Group, Listing, Message } from "@/types";

type Card = { id: string; name: string; avatar: string };
type Conv = Conversation & {
  name: string;
  participants: Card[];
  others: Card[];
  chatContext?: {
    streakDays: number;
    lockedInToday: boolean;
    hourglass: boolean;
    closenessScore: number;
    critterFriendId?: string;
  };
};

function ListingChip({ id, onReady }: { id: string; onReady?: () => void }) {
  const { data } = useApi<Listing>(`/api/marketplace/${id}`);
  useEffect(() => {
    if (data) onReady?.();
  }, [data, onReady]);
  if (!data) return null;
  return (
    <Link href={`/marketplace/${id}`} className="mb-1 flex w-60 items-center gap-2 overflow-hidden rounded-xl border border-line/60 bg-white">
      <Photo src={data.images[0]} className="h-16 w-16 shrink-0 bg-[#f0f2f5] object-cover" />
      <div className="min-w-0 pr-2">
        <div className="text-[10.5px] font-bold text-emerald-700 uppercase">Marketplace</div>
        <div className="truncate text-[13px] font-semibold text-ink">{data.title}</div>
        <div className="text-[12.5px] text-ink-2">${data.price}</div>
      </div>
    </Link>
  );
}

function GroupChip({ id, onReady }: { id: string; onReady?: () => void }) {
  const { data } = useApi<Group & { memberCount?: number }>(`/api/groups/${id}`);
  useEffect(() => {
    if (data) onReady?.();
  }, [data, onReady]);
  if (!data) return null;
  return (
    <Link href={`/groups/${id}`} className="mb-1 flex w-60 items-center gap-2 overflow-hidden rounded-xl border border-line/60 bg-white">
      <Photo src={data.cover} className="h-16 w-16 shrink-0 bg-[#f0f2f5] object-cover" />
      <div className="min-w-0 py-1 pr-2">
        <div className="text-[10.5px] font-bold text-indigo-600 uppercase">Group</div>
        <div className="truncate text-[13px] font-semibold text-ink">{data.name}</div>
        <div className="truncate text-[11.5px] text-ink-2">{data.memberCount ?? data.memberIds.length} members</div>
      </div>
    </Link>
  );
}

function EventChip({ id, onReady }: { id: string; onReady?: () => void }) {
  const { data } = useApi<FBEvent>(`/api/events/${id}`);
  useEffect(() => {
    if (data) onReady?.();
  }, [data, onReady]);
  if (!data) return null;
  return (
    <Link href={`/events/${id}`} className="mb-1 flex w-60 items-center gap-2 overflow-hidden rounded-xl border border-line/60 bg-white">
      <Photo src={data.cover} className="h-16 w-16 shrink-0 bg-[#f0f2f5] object-cover" />
      <div className="min-w-0 py-1 pr-2">
        <div className="truncate text-[11px] font-semibold text-red-600 uppercase">{eventDate(data.startsAt)}</div>
        <div className="truncate text-[13px] font-semibold text-ink">{data.title}</div>
        <div className="truncate text-[11.5px] text-ink-2">{data.location}</div>
      </div>
    </Link>
  );
}

export default function ThreadPage() {
  const { id } = useParams<{ id: string }>();
  const goBack = useBack("/messages");
  const { userId } = useSession();
  const { data: c, mutate } = useApi<Conv>(`/api/conversations/${id}`, { poll: 1500 });
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const count = c?.messages.length ?? 0;
  const scrollToEnd = useCallback(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, []);
  useEffect(() => {
    scrollToEnd();
  }, [count, scrollToEnd]);
  useEffect(() => {
    refresh("/api/me");
  }, [count]);

  async function send(body = text, attachment?: Message["attachment"]) {
    if ((!body.trim() && !attachment) || !c) return;
    setSending(true);
    if (!attachment) setText("");
    const optimistic = { id: `tmp_${Date.now()}`, senderId: userId, text: body, createdAt: new Date().toISOString(), readBy: [userId], attachment };
    mutate({ ...c, messages: [...c.messages, optimistic] }, { revalidate: false });
    await api(`/api/conversations/${c.id}/messages`, { method: "POST", json: { text: body, attachment } });
    await mutate();
    refresh("/api/conversations");
    refresh("/api/streaks");
    refresh("/api/context");
    setSending(false);
  }

  // ---------- Sidequest chat games (Deep Cuts, Order Up!, Ghost Run, Sketch Off) ----------
  const { data: me } = useMe();
  const [tray, setTray] = useState(false);
  const [streakOpen, setStreakOpen] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("play") === "1") {
      setTray(true);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);
  // Event unlock popup: after a scored game, closing the game asks the server whether the chat earned event picks
  const [picksFor, setPicksFor] = useState<string | null>(null);
  const scored = useRef<{ ref: string; sent: Promise<void> } | null>(null);
  const closeGame = useCallback(() => {
    setPlaying(null);
    const s = scored.current;
    scored.current = null;
    if (s) void s.sent.catch(() => {}).then(() => setPicksFor(s.ref));
  }, []);
  const closePicks = useCallback(() => setPicksFor(null), []);
  const sendRef = useRef(send);
  sendRef.current = send;
  const finished = useCallback((f: Finished) => {
    // GamePigeon style: a quiet "Maya played … · score" line, not a new card
    if (f.text && f.ref) scored.current = { ref: f.ref, sent: sendRef.current(f.text, { type: "sqgamelog", ref: f.ref }) };
  }, []);

  const byId = Object.fromEntries((c?.participants ?? []).map((p) => [p.id, p]));
  const other = c?.others[0];
  const ctx = c?.chatContext;
  const { data: streakInfo, mutate: mutateStreak } = useApi<StreakDetail>(ctx?.critterFriendId && streakOpen ? `/api/streaks/${ctx.critterFriendId}` : null);
  const [simBusy, setSimBusy] = useState(false);
  async function simulateFriendPlay() {
    if (!ctx?.critterFriendId || simBusy) return;
    setSimBusy(true);
    try {
      const next = await api<StreakDetail>(`/api/streaks/${ctx.critterFriendId}`, { method: "POST", json: { action: "friendPlays" } });
      await mutateStreak(next, { revalidate: false });
      await mutate();
      refresh("/api/streaks");
      refresh("/api/conversations");
    } finally {
      setSimBusy(false);
    }
  }

  // ---------- hackathon demo: Muse sends the group a game, then suggests a plan ----------
  const isDemoChat = id === DEMO_CHAT;
  useEffect(() => {
    if (isDemoChat) void api("/api/demo/kickoff", { method: "POST", json: { conversationId: id } }).then(() => mutate()).catch(() => {});
  }, [isDemoChat, id, mutate]);
  const museGame = c?.messages.find((m) => m.senderId === MUSE_ID && m.attachment?.type === "sqgame");
  const musePlan = c?.messages.find((m) => m.senderId === MUSE_ID && m.attachment?.type === "event");
  const done = new Set(c?.messages.filter((m) => m.attachment?.type === "sqgamelog" && m.attachment.ref === museGame?.attachment?.ref).map((m) => m.senderId));
  const people = Math.max(1, (c?.participantIds.length ?? 2) - 1);
  const guide: GuideStep | null = !isDemoChat
    ? null
    : musePlan
      ? { step: 4, text: "Muse found a plan for your group 👀", href: `/events/${musePlan.attachment!.ref}`, cta: "See it →" }
      : !museGame
        ? { step: 3, text: "Muse is reading the room and making your group a game…" }
        : done.has(userId)
          ? { step: 3, text: `Nice! Muse suggests a plan once ${Math.ceil(people / 2)} of ${people} finish (${done.size}/${people} done).` }
          : { step: 3, text: "Muse sent your group a game. Tap Play!" };

  return (
    <div className="relative flex h-full flex-col bg-white">
      <header className="safe-top sticky top-0 z-10 border-b border-line/60 bg-white">
        <div className="flex h-14 items-center gap-1.5 px-2">
          <button onClick={goBack} aria-label="Back to chats" className="rounded-full p-2 text-messenger"><ArrowLeft size={22} /></button>
          {c && (
            <Link href={c.isGroup ? "#" : `/profile/${other?.id}`} className="flex min-w-0 flex-1 items-center gap-2">
              <Avatar src={c.isGroup ? c.others[0]?.avatar : other?.avatar} name={c.name} size={36} online={!c.isGroup} />
              <div className="min-w-0">
                <div className="truncate text-[16px] font-semibold leading-tight">{c.name}</div>
                <div className="truncate text-[12px] text-ink-2">{c.isGroup ? `${c.participantIds.length} people` : "Active now"}</div>
              </div>
            </Link>
          )}
          {ctx && ctx.streakDays > 0 && (
            ctx.critterFriendId ? (
              <button
                type="button"
                onClick={() => setStreakOpen(true)}
                className={cx(
                  "shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold tabular-nums",
                  ctx.lockedInToday ? "bg-orange-50 text-orange-600" : "bg-[#fff1d6] text-[#a35a00]",
                )}
                title="View game streak"
              >
                {ctx.lockedInToday ? "🔥" : "⏳"} {ctx.streakDays}d
              </button>
            ) : (
              <Link
                href="/dev/context"
                className={cx(
                  "shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold tabular-nums",
                  ctx.lockedInToday ? "bg-orange-50 text-orange-600" : "bg-[#fff1d6] text-[#a35a00]",
                )}
              >
                {ctx.lockedInToday ? "🔥" : "⏳"} {ctx.streakDays}d
              </Link>
            )
          )}
          <button className="p-1.5 text-messenger"><Phone size={20} /></button>
          <button className="p-1.5 text-messenger"><Video size={22} /></button>
          <button className="p-1.5 text-messenger"><Info size={20} /></button>
        </div>
        {isDemoChat && <div className="pb-2"><DemoGuide guide={guide} /></div>}
      </header>

      <div className="flex-1 px-3 py-3">
        {c?.messages.map((m, i) => {
          const mine = m.senderId === userId;
          const prev = c.messages[i - 1];
          const next = c.messages[i + 1];
          const gap = !prev || new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() > 30 * 60e3;
          const card = (x?: Message) => !!x && x.attachment?.type === "sqgamelog";
          const firstOfRun = !prev || card(prev) || prev.senderId !== m.senderId || gap;
          const lastOfRun = !next || card(next) || next.senderId !== m.senderId;
          const sender = byId[m.senderId];
          if (m.attachment?.type === "sqgamelog")
            return (
              <div key={m.id} className="my-2 flex justify-center">
                <button onClick={() => setPlaying(m.attachment!.ref)} className="max-w-[85%] rounded-full bg-[#f0f2f5] px-3 py-1 text-center text-[12px] text-ink-2">
                  🎮 <b className="font-semibold text-ink">{mine ? "You" : (sender?.name.split(" ")[0] ?? "Someone")}</b> {m.text}
                </button>
              </div>
            );
          return (
            <div key={m.id}>
              {gap && <div className="my-3 text-center text-[11px] font-semibold text-ink-2 uppercase">{messageTime(m.createdAt)}</div>}
              {c.isGroup && !mine && firstOfRun && sender && (
                <Link href={`/profile/${sender.id}`} className="mb-0.5 ml-10 block w-fit text-[11px] text-ink-2">{sender.name.split(" ")[0]}</Link>
              )}
              <div className={cx("flex items-end gap-2", mine ? "justify-end" : "justify-start", lastOfRun ? "mb-2" : "mb-0.5")}>
                {!mine && (
                  <span className="w-7 shrink-0">
                    {lastOfRun && sender && (
                      <Link href={`/profile/${sender.id}`} aria-label={`${sender.name}'s profile`}>
                        <Avatar src={sender.avatar} name={sender.name} size={28} />
                      </Link>
                    )}
                  </span>
                )}
                <div className={cx("flex max-w-[75%] flex-col", mine ? "items-end" : "items-start")}>
                  {m.attachment?.type === "listing" && <ListingChip id={m.attachment.ref} onReady={scrollToEnd} />}
                  {m.attachment?.type === "group" && <GroupChip id={m.attachment.ref} onReady={scrollToEnd} />}
                  {m.attachment?.type === "event" && <EventChip id={m.attachment.ref} onReady={scrollToEnd} />}
                  {m.attachment?.type === "image" && <Photo src={m.attachment.ref} className="mb-1 max-h-60 rounded-2xl object-cover" />}
                  {m.attachment?.type === "sqgame" && <GameCard roomId={m.attachment.ref} userId={userId} onOpen={setPlaying} />}
                  {m.text && !(m.attachment?.type === "sqgame" && m.text.startsWith("🎮")) && (
                    <div
                      className={cx(
                        "px-3 py-2 text-[15px] leading-snug break-words whitespace-pre-wrap",
                        mine ? "bg-messenger text-white" : "bg-[#f0f0f0] text-ink",
                        "rounded-[18px]",
                        mine ? (firstOfRun ? "" : "rounded-tr-md") + (lastOfRun ? "" : " rounded-br-md") : (firstOfRun ? "" : "rounded-tl-md") + (lastOfRun ? "" : " rounded-bl-md"),
                      )}
                    >
                      {m.text}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {c && c.messages.length > 0 && c.messages.at(-1)!.senderId === userId && (
          <div className="mr-1 text-right text-[11px] text-ink-2">{(c.messages.at(-1)!.readBy?.length ?? 1) > 1 ? "Seen" : "Delivered"}</div>
        )}
        <div ref={bottom} className="h-3 scroll-mb-20" />
      </div>

      <div className="safe-bottom sticky bottom-0 z-10 flex items-center gap-1 border-t border-line/60 bg-white px-2 py-2">
        <button onClick={() => setTray(true)} className="p-1.5 text-messenger" aria-label="Games"><Plus size={24} /></button>
        <button className="p-1.5 text-messenger"><ImageIcon size={22} /></button>
        <div className="flex flex-1 items-center rounded-full bg-[#f0f2f5] pr-2">
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Aa" className="flex-1 bg-transparent px-3 py-2 text-[15px] outline-none" />
          <Smile size={20} className="text-messenger" />
        </div>
        {text.trim() ? (
          <button onClick={() => send()} disabled={sending} className="p-1.5 text-messenger"><Send size={24} /></button>
        ) : (
          <button onClick={() => send("👍")} className="p-1.5 text-messenger"><ThumbsUp size={24} className="fill-messenger" /></button>
        )}
      </div>

      {tray && (
        <GameTray
          conversationId={c?.id}
          onClose={() => setTray(false)}
          onCreate={(ref, interest, game) => {
            setTray(false);
            void send(`🎮 ${GAMES[game].name}: ${interest}`, { type: "sqgame", ref });
          }}
        />
      )}
      {playing && <GamePlayer roomId={playing} userId={userId} name={me?.name.split(" ")[0] ?? userId} onClose={closeGame} onFinished={finished} />}
      {picksFor && c && (
        <EventPicksSheet
          conversationId={c.id}
          gameRef={picksFor}
          onClose={closePicks}
          onSend={(item) =>
            send(
              item.kind === "event"
                ? `Wait should we go to ${item.title}?`
                : item.kind === "group"
                  ? `Should we check out ${item.name}?`
                  : `Saw this on Marketplace and thought of our chat`,
              { type: item.kind, ref: item.id },
            )
          }
        />
      )}
      {streakOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className={`${document.querySelector(".phone") ? "absolute" : "fixed"} inset-0 z-[60] flex flex-col justify-end`} onClick={() => setStreakOpen(false)}>
            <div className="fadein absolute inset-0 bg-black/45" />
            <div className="slideup relative rounded-t-3xl bg-white px-4 pb-6 pt-3" onClick={(e) => e.stopPropagation()}>
              <div className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-line" />
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[16px] font-bold">{streakInfo ? `${streakInfo.first}'s Hangout Streak` : "Streak"}</span>
                <button type="button" onClick={() => setStreakOpen(false)} className="rounded-full bg-[#e4e6eb] p-1.5"><X size={16} /></button>
              </div>
              {streakInfo && (
                <>
                  <div className="flex items-center gap-3 rounded-2xl bg-[#FFF6E9] p-3">
                    <Critter design={streakInfo.design} state={streakInfo.state} size={80} showKeepsakes={false} label={`${streakInfo.first}'s critter`} />
                    <div className="min-w-0 flex-1">
                      <span className={cx("inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold", STATUS[streakInfo.status].chip)}>
                        {STATUS[streakInfo.status].label}
                      </span>
                      <div className="mt-1 flex items-baseline gap-1 text-[24px] font-extrabold leading-none tabular-nums">
                        <Flame size={20} className={streakInfo.streak > 0 ? "fill-orange-500 text-orange-600" : "text-ink-2"} />
                        {streakInfo.streak} <span className="text-[14px] font-semibold text-ink-2">day streak</span>
                      </div>
                      <div className="mt-1 text-[13px] text-ink-2">{statusLine(streakInfo, endsLabel(streakInfo.endsAt))}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-1">
                    {streakInfo.days.slice(-7).map((d: { date: string; mark: DayMark }, idx: number) => (
                      <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                        <span
                          className={cx(
                            "flex h-7 w-7 items-center justify-center rounded-full text-[11px]",
                            d.mark === "both" ? "bg-orange-500 text-white" : d.mark === "one" ? "border-2 border-orange-400 bg-orange-50 text-orange-500" : "border border-line bg-[#f7f8fa] text-ink-2",
                          )}
                        >
                          {(d.mark === "both" || d.mark === "one") && <Flame size={13} className={d.mark === "both" ? "fill-current" : ""} />}
                        </span>
                        <span className="text-[10.5px] text-ink-2">{idx === 6 ? "Today" : new Date(`${d.date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "narrow", timeZone: "UTC" })}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setStreakOpen(false);
                        setTray(true);
                      }}
                      className="flex-1 rounded-full bg-messenger py-2 text-[14px] font-semibold text-white"
                    >
                      Play a game
                    </button>
                    {!streakInfo.today.them && (
                      <button
                        type="button"
                        onClick={() => void simulateFriendPlay()}
                        disabled={simBusy}
                        className="inline-flex items-center justify-center gap-1 rounded-full bg-[#f0f2f5] px-3.5 py-2 text-[13px] font-semibold text-ink"
                      >
                        <Sparkles size={13} /> {simBusy ? "…" : `Have ${streakInfo.first} play`}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>,
          document.querySelector<HTMLElement>(".phone") ?? document.body,
        )}
    </div>
  );
}

"use client";
import Link from "next/link";
import { Search } from "lucide-react";
import { MessengerShell } from "@/components/messenger/MessengerShell";
import { HangoutCard } from "@/components/streaks/HangoutCard";
import { useMe } from "@/components/Shell";
import { Avatar, cx } from "@/components/ui";
import { useApi } from "@/lib/api";
import { messageTime } from "@/lib/format";
import type { StreakCard, StreaksView } from "@/lib/streaks/views";
import type { Message } from "@/types";

const CARD_LABEL: Record<string, string> = { game: "Today's game", unlock: "Unlocked for this chat" };
type Conv = { id: string; isGroup: boolean; name: string; emoji?: string; participants: { id: string; name: string; avatar: string }[]; avatar?: string; last?: Message & { mine: boolean; senderName: string }; unread: number };

/** Snapchat-style streak on a DM row: 🔥 21, or ⏳ 21 when it ends tonight. */
function StreakTag({ s }: { s?: StreakCard }) {
  if (!s) return null;
  const ending = s.status === "atRisk";
  return <span className={cx("shrink-0 text-[13px] font-semibold tabular-nums", ending ? "text-[#a35a00]" : "text-orange-600")}>{ending ? "⏳" : "🔥"}{s.streak}</span>;
}

export default function MessagesPage() {
  const { data: me } = useMe();
  const { data: convs } = useApi<Conv[]>("/api/conversations", { poll: 2500 });
  const { data: streaks } = useApi<StreaksView>("/api/streaks", { poll: 4000 });
  const streakIn = new Map(streaks?.friends.filter((s) => s.conversationId && s.streak > 0).map((s) => [s.conversationId, s]));
  const active = me ? convs?.flatMap((c) => c.participants).filter((p, i, a) => a.findIndex((x) => x.id === p.id) === i).slice(0, 8) : [];
  return (
    <MessengerShell>
      <div className="bg-white">
        <h1 className="px-4 pt-2 pb-2 text-[24px] font-bold">Chats</h1>
        <HangoutCard />
        <div className="px-4 py-3">
          <Link href="/search" className="flex items-center gap-2 rounded-full bg-[#f0f2f5] px-3 py-2 text-[15px] text-ink-2"><Search size={18} /> Search</Link>
        </div>
        <div className="no-scrollbar flex gap-4 overflow-x-auto px-4 pb-3">
          {active?.map((p) => (
            <Link key={p.id} href={`/profile/${p.id}`} className="flex w-16 flex-col items-center gap-1 text-center">
              <Avatar src={p.avatar} name={p.name} size={56} online />
              <span className="w-full truncate text-[12px]">{p.name.split(" ")[0]}</span>
            </Link>
          ))}
        </div>
        <div>
          {convs?.map((c) => (
            <Link key={c.id} href={`/messages/${c.id}`} className="flex items-center gap-3 px-4 py-2">
              {c.isGroup ? (
                <span className="relative h-14 w-14 shrink-0">
                  <span className="absolute top-0 left-0"><Avatar src={c.participants[0]?.avatar} name={c.participants[0]?.name ?? "G"} size={38} /></span>
                  <span className="absolute right-0 bottom-0 rounded-full border-2 border-white"><Avatar src={c.participants[1]?.avatar} name={c.participants[1]?.name ?? "G"} size={34} /></span>
                </span>
              ) : (
                <Avatar src={c.avatar} name={c.name} size={56} online={c.participants[0]?.id.length % 2 === 0} />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className={cx("truncate text-[16px]", c.unread ? "font-bold" : "font-medium")}>{c.emoji ? `${c.name}` : c.name}</span>
                  <StreakTag s={streakIn.get(c.id)} />
                </div>
                {c.last && (
                  <div className={cx("flex items-center gap-1 text-[14px]", c.unread ? "font-semibold text-ink" : "text-ink-2")}>
                    <span className="truncate">{c.last.attachment && CARD_LABEL[c.last.attachment.type] ? CARD_LABEL[c.last.attachment.type] : <>{c.last.mine ? "You: " : c.isGroup ? `${c.last.senderName}: ` : ""}{c.last.attachment && !c.last.text ? "Sent an attachment" : c.last.text}</>}</span>
                    <span className="shrink-0">· {messageTime(c.last.createdAt)}</span>
                  </div>
                )}
              </div>
              {c.unread > 0 && <span className="h-3 w-3 shrink-0 rounded-full bg-fb" />}
            </Link>
          ))}
        </div>
      </div>
    </MessengerShell>
  );
}

"use client";
import Link from "next/link";
import { Camera, PenSquare, Search } from "lucide-react";
import { Shell, useMe } from "@/components/Shell";
import { Avatar, cx } from "@/components/ui";
import { useApi } from "@/lib/api";
import { messageTime } from "@/lib/format";
import type { Message } from "@/types";

type Conv = { id: string; isGroup: boolean; name: string; emoji?: string; participants: { id: string; name: string; avatar: string }[]; avatar?: string; last?: Message & { mine: boolean; senderName: string }; unread: number };

export default function MessagesPage() {
  const { data: me } = useMe();
  const { data: convs } = useApi<Conv[]>("/api/conversations", { poll: 2500 });
  const active = me ? convs?.flatMap((c) => c.participants).filter((p, i, a) => a.findIndex((x) => x.id === p.id) === i).slice(0, 8) : [];
  return (
    <Shell title={undefined} back right={<><button className="rounded-full bg-[#e4e6eb] p-2"><Camera size={18} /></button><button className="rounded-full bg-[#e4e6eb] p-2"><PenSquare size={18} /></button></>}>
      <div className="bg-white">
        <h1 className="px-4 pt-2 text-[24px] font-bold">Chats</h1>
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
                <div className={cx("truncate text-[16px]", c.unread ? "font-bold" : "font-medium")}>{c.emoji ? `${c.name}` : c.name}</div>
                {c.last && (
                  <div className={cx("flex items-center gap-1 text-[14px]", c.unread ? "font-semibold text-ink" : "text-ink-2")}>
                    <span className="truncate">{c.last.mine ? "You: " : c.isGroup ? `${c.last.senderName}: ` : ""}{c.last.attachment && !c.last.text ? "Sent an attachment" : c.last.text}</span>
                    <span className="shrink-0">· {messageTime(c.last.createdAt)}</span>
                  </div>
                )}
              </div>
              {c.unread > 0 && <span className="h-3 w-3 shrink-0 rounded-full bg-fb" />}
            </Link>
          ))}
        </div>
      </div>
    </Shell>
  );
}

"use client";
import Link from "next/link";
import { useEffect } from "react";
import { Bell, Cake, CalendarDays, MessageSquare, Store, ThumbsUp, UserPlus, Users } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Avatar, RichText, cx } from "@/components/ui";
import { api, refresh, useApi } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import type { Notification } from "@/types";

type N = Notification & { actor?: { id: string; name: string; avatar: string } };
const ICON: Record<string, { icon: React.ElementType; bg: string }> = {
  like: { icon: ThumbsUp, bg: "bg-fb" },
  comment: { icon: MessageSquare, bg: "bg-green-500" },
  friend_request: { icon: UserPlus, bg: "bg-fb" },
  event_invite: { icon: CalendarDays, bg: "bg-red-500" },
  group_post: { icon: Users, bg: "bg-fb" },
  birthday: { icon: Cake, bg: "bg-pink-500" },
  marketplace: { icon: Store, bg: "bg-fb" },
  memory: { icon: Bell, bg: "bg-fb" },
  mention: { icon: MessageSquare, bg: "bg-fb" },
};

export default function NotificationsPage() {
  const { data } = useApi<N[]>("/api/notifications", { poll: 5000 });
  useEffect(() => {
    const t = setTimeout(async () => {
      await api("/api/notifications/read", { method: "POST", json: {} });
      refresh("/api/me");
    }, 1500);
    return () => clearTimeout(t);
  }, []);
  const recent = data?.filter((n) => Date.now() - new Date(n.createdAt).getTime() < 24 * 3600e3) ?? [];
  const earlier = data?.filter((n) => !recent.includes(n)) ?? [];
  const Row = ({ n }: { n: N }) => {
    const I = ICON[n.type] ?? ICON.memory;
    return (
      <Link href={n.href} className={cx("flex items-start gap-3 px-4 py-2.5", !n.read && "bg-[#e7f3ff]")}>
        <span className="relative shrink-0">
          <Avatar src={n.actor?.avatar} name={n.actor?.name ?? "Facebook"} size={56} />
          <span className={cx("absolute -right-1 -bottom-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-white", I.bg)}>
            <I.icon size={14} />
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] leading-snug"><RichText text={n.text} /></div>
          <div className={cx("mt-0.5 text-[13px]", n.read ? "text-ink-2" : "font-semibold text-fb")}>{timeAgo(n.createdAt, false)}</div>
        </div>
        {!n.read && <span className="mt-5 h-3 w-3 shrink-0 rounded-full bg-fb" />}
      </Link>
    );
  };
  return (
    <Shell>
      <div className="bg-white pb-4">
        <h1 className="px-4 pt-3 text-[24px] font-bold">Notifications</h1>
        {recent.length > 0 && <h2 className="px-4 pt-3 pb-1 text-[17px] font-bold">New</h2>}
        {recent.map((n) => <Row key={n.id} n={n} />)}
        {earlier.length > 0 && <h2 className="px-4 pt-3 pb-1 text-[17px] font-bold">Earlier</h2>}
        {earlier.map((n) => <Row key={n.id} n={n} />)}
      </div>
    </Shell>
  );
}

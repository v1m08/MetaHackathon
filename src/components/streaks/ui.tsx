"use client";
// Small pieces shared by the Hangout card, the streaks page, the detail page and the Chats rows.
import Link from "next/link";
import { ChevronRight, Flame, Hourglass } from "lucide-react";
import { Critter } from "@/components/hangout/Critter";
import { cx } from "@/components/ui";
import { STATUS, statusLine } from "@/lib/streaks/copy";
import type { StreakCard } from "@/lib/streaks/views";

export const streakHref = (c: StreakCard) => `/streaks/${c.friendId}`;

/** 🔥 21, or ⏳ 21 when it ends tonight, in the status colour. */
export function Count({ c, className }: { c: StreakCard; className?: string }) {
  const Icon = c.status === "atRisk" ? Hourglass : Flame;
  return (
    <span className={cx("inline-flex items-center gap-0.5 rounded-full px-2 py-[1px] text-[11px] font-semibold tabular-nums", STATUS[c.status].chip, className)}>
      <Icon size={11} className={c.status === "done" ? "fill-current" : ""} /> {c.streak}
    </span>
  );
}

/** A friend in a list: critter, name, what to do today, count. */
export function StreakRow({ c, ends }: { c: StreakCard; ends: string }) {
  return (
    <Link href={streakHref(c)} className="flex items-center gap-3 px-4 py-2 active:bg-hover">
      <span className="flex h-12 w-12 shrink-0 items-end justify-center rounded-full bg-[#FFF3E2]">
        <Critter design={c.design} state={c.state} size={48} showKeepsakes={false} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-medium">{c.name}</span>
        <span className={cx("block truncate text-[14px]", c.status === "yourTurn" || c.status === "atRisk" ? "font-semibold text-ink" : "text-ink-2")}>{statusLine(c, ends)}</span>
      </span>
      {c.status !== "new" && <Count c={c} className="text-[12.5px]" />}
      <ChevronRight size={18} className="shrink-0 text-ink-2" />
    </Link>
  );
}

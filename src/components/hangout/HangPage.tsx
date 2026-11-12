"use client";
// Page shell for Hang Again screens: top bar, internally scrolling body, tab bar. The root is `relative h-full`
// so bottom sheets (absolute inset-0) cover the phone no matter how far the body has scrolled.
import { TabBar, TopBar } from "@/components/Shell";
import { cx } from "@/components/ui";
import type { CritterState } from "@/lib/hangout/types";

export function HangPage({ title, children, right, tabs = true, className }: { title: string; children: React.ReactNode; right?: React.ReactNode; tabs?: boolean; className?: string }) {
  return (
    <div className="relative flex h-full flex-col bg-bg">
      <TopBar title={title} back right={right} />
      <main className={cx("no-scrollbar min-h-0 flex-1 overflow-y-auto", className)}>{children}</main>
      {tabs && <TabBar />}
    </div>
  );
}

export const STATE_CHIP: Record<CritterState, string> = {
  awake: "bg-[#E3F6E8] text-[#1E7B3A]",
  sleepy: "bg-[#FFF2D6] text-[#9A6400]",
  napping: "bg-[#ECEBFF] text-[#4B45B5]",
  celebrating: "bg-[#FFE4EF] text-[#B4235E]",
  egg: "bg-[#FFF6E5] text-[#9A6B1F]",
  hatching: "bg-[#FFF6E5] text-[#9A6B1F]",
  resting: "bg-[#EEF1F4] text-[#5A6573]",
};

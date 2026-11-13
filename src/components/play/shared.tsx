"use client";
// Small pieces shared by the Chat Games components: the Live / Cached / Mock tag used across the app, a row of
// member faces, and a Sheet that mounts on the phone frame itself so it stays put when the thread is scrolled.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Avatar, Sheet, cx } from "@/components/ui";
import type { MemberCard } from "@/lib/play/views";

export function ModeTag({ mode, className }: { mode?: string; className?: string }) {
  const m = (mode ?? "mock").toLowerCase();
  const live = m.startsWith("live");
  const cached = m.startsWith("cached");
  return (
    <span className={cx("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase", live ? "bg-emerald-100 text-emerald-700" : cached ? "bg-sky-100 text-sky-700" : "bg-[#e4e6eb] text-ink-2", className)}>
      {live ? "Live" : cached ? "Cached" : "Mock"}
    </span>
  );
}

export function Faces({ people, size = 20, max = 5 }: { people: MemberCard[]; size?: number; max?: number }) {
  if (!people.length) return null;
  return (
    <span className="flex shrink-0 items-center -space-x-1.5">
      {people.slice(0, max).map((p) => <span key={p.id} className="rounded-full border border-white"><Avatar src={p.avatar} name={p.name} size={size} /></span>)}
      {people.length > max && <span className="pl-2.5 text-[11px] text-ink-2">+{people.length - max}</span>}
    </span>
  );
}

/** Same Sheet as everywhere else, portalled to the phone frame (or the window on a real phone) instead of the scrolling thread. */
export function PlaySheet({ open, onClose, title, full, children }: { open: boolean; onClose: () => void; title?: string; full?: boolean; children: React.ReactNode }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [host, setHost] = useState<Element | null>(null);
  useEffect(() => {
    if (open) setHost(anchor.current?.closest(".phone") ?? document.body);
  }, [open]);
  const framed = !!host && host !== document.body;
  return (
    <>
      <span ref={anchor} className="hidden" />
      {open && host && createPortal(
        <div className={cx(framed ? "absolute" : "fixed", "inset-0 z-[60] text-left text-ink")}>
          <Sheet open onClose={onClose} title={title} full={full}>{children}</Sheet>
        </div>,
        host,
      )}
    </>
  );
}

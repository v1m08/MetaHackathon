"use client";
// Muse's notifications (src/server/demo.ts): when your group's game is ready, or Muse has a plan for you, a banner
// slides down from the top of whatever screen you're on. Tapping it opens the chat, or the Friends tab for a plan.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useApi } from "@/lib/api";
import { isDemoUser } from "@/lib/demo";
import { museAvatarFor } from "@/lib/museAvatar";
import { useMe } from "./Shell";

const seenKey = (id: string) => `muse-toast-seen:${id}`;
const wasSeen = (id: string) => {
  try {
    return sessionStorage.getItem(seenKey(id)) === "1";
  } catch {
    return false;
  }
};
const markSeen = (id: string) => {
  try {
    sessionStorage.setItem(seenKey(id), "1");
  } catch {
    /* private mode */
  }
};

export function MuseToast({ inFrame }: { inFrame: boolean }) {
  const { data: me } = useMe();
  const path = usePathname();
  // only the demo's judge accounts ever get a note from Muse
  const { data } = useApi<{ latest: { id: string; text: string; href: string; kind: "game" | "plan" } | null }>(isDemoUser(me?.id) ? "/api/demo/muse" : null, { poll: 4000 });
  const note = data?.latest;
  const target = note?.kind === "plan" ? "/friends" : note?.href;
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    if (!note) return;
    // already looking at what it points to: no banner needed
    if (path === (note.kind === "plan" ? "/friends" : note.href)) {
      markSeen(note.id);
      return setHidden(true);
    }
    setHidden(wasSeen(note.id));
  }, [note, path]);
  if (!target) return null;
  if (!note || hidden) return null;
  const close = () => {
    markSeen(note.id);
    setHidden(true);
  };
  return (
    <div className={`${inFrame ? "absolute" : "fixed"} inset-x-0 top-0 z-[70] px-2 pt-2 safe-top`} role="status">
      <div className="muse-toast flex items-start gap-2.5 rounded-2xl bg-white/95 p-3 shadow-[0_8px_28px_rgba(0,0,0,0.22)] ring-1 ring-black/5 backdrop-blur">
        <Link href={target} onClick={close} className="flex min-w-0 flex-1 items-start gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={museAvatarFor("muse")} alt="" className="h-10 w-10 flex-none rounded-full" />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-2">
              Muse <span className="font-normal">· {note.kind === "plan" ? "sent you a plan for your group" : "your game is ready"}</span>
            </span>
            <span className="mt-0.5 line-clamp-2 block text-[14px] leading-snug text-ink">{note.text}</span>
          </span>
        </Link>
        <button onClick={close} aria-label="Dismiss" className="flex-none rounded-full p-1 text-ink-2 hover:bg-hover">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

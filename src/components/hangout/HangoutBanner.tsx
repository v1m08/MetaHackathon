"use client";
// Push banner mock. Mounted once in the (app) layout so a nudge, match or reply can land on any screen.
// Sticky + zero height keeps it pinned to the top of the phone viewport without taking up space.
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import { api, refresh, useApi } from "@/lib/api";
import type { AlertView } from "@/server/hangout/views";

export function HangoutBanner() {
  const router = useRouter();
  const path = usePathname();
  const { data, mutate } = useApi<{ alert: AlertView | null }>("/api/hangout/alerts", { poll: 2000 });
  const alert = data?.alert ?? null;
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const seen = async (id: string) => {
    await api("/api/hangout/alerts", { method: "POST", json: { id } }).catch(() => {});
    mutate();
  };

  // A reply from the friend whose chat is already open doesn't need a banner.
  const inThread = !!alert && alert.kind === "reply" && path === `/friends/hangout/chat/${alert.friendId}`;

  useEffect(() => {
    if (!alert) return;
    refresh("/api/hangout");
    if (inThread) {
      seen(alert.id);
      return;
    }
    timer.current = setTimeout(() => seen(alert.id), 8000);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alert?.id, inThread]);

  if (!alert || inThread) return null;
  return (
    <div className="sticky top-0 z-[80] h-0">
      <button
        key={alert.id}
        onClick={() => {
          seen(alert.id);
          router.push(alert.href);
        }}
        className="hang-banner hang-banner-pos absolute right-2 left-2 flex items-start gap-3 rounded-2xl bg-white/95 p-3 text-left shadow-[0_10px_30px_rgba(0,0,0,.22)] backdrop-blur"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-fb text-white">
          <Sparkles size={19} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between text-[12px] text-ink-2">
            <span className="font-semibold tracking-wide uppercase">Facebook</span>
            <span>now</span>
          </span>
          <span className="block text-[15px] font-semibold leading-tight">{alert.title}</span>
          <span className="line-clamp-2 block text-[14px] leading-snug text-ink">{alert.body}</span>
        </span>
      </button>
    </div>
  );
}

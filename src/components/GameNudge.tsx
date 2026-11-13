"use client";
// Push-style banner that drops in from the top of the phone when Muse sends you a "game" notification (today's game was
// dropped in one of your chats, src/lib/demo/drop.ts). Tap it to jump straight into the game; it shows once per
// notification per tab and also lives on the Notifications page.
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { MuseHost } from "@/components/hangout/MuseHost";
import { api, refresh, useApi } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { Notification } from "@/types";

const SEEN_KEY = "fb.nudges.seen";
const seen = (): string[] => {
  try {
    return JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? "[]");
  } catch {
    return [];
  }
};
const markSeen = (id: string) => {
  try {
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen(), id].slice(-50)));
  } catch {}
};

export function GameNudge() {
  const { userId } = useSession();
  const path = usePathname();
  const router = useRouter();
  const { data } = useApi<Notification[]>("/api/notifications", { poll: 3000 });
  const [shown, setShown] = useState<Notification | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.querySelector<HTMLElement>(".phone") ?? document.body), [path]);

  useEffect(() => {
    if (!data) return;
    if (shown) {
      // read elsewhere (the Notifications page), or wiped by a demo reset: take it down
      const live = data.find((n) => n.id === shown.id);
      if (!live || live.read) setShown(null);
      return;
    }
    const skip = new Set(seen());
    const next = data.find((n) => n.type === "game" && !n.read && !skip.has(`${userId}|${n.id}`));
    if (next) setShown(next);
  }, [data, shown, userId]);

  // Already playing (opened the card directly): don't cover the game or the post-game sheet. It stays in Notifications.
  const [inGame, setInGame] = useState(false);
  useEffect(() => {
    const check = () => setInGame(document.body.classList.contains("game-open"));
    check();
    const mo = new MutationObserver(check);
    mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);

  // They got into a game some other way while the banner was up: it has done its job, so retire it.
  useEffect(() => {
    if (!inGame || !shown) return;
    markSeen(`${userId}|${shown.id}`);
    void api("/api/notifications/read", { method: "POST", json: { ids: [shown.id] } }).catch(() => {});
    setShown(null);
  }, [inGame, shown, userId]);

  if (!shown || !host || inGame) return null;
  const dismiss = () => {
    markSeen(`${userId}|${shown.id}`);
    setShown(null);
  };
  const open = () => {
    dismiss();
    void api("/api/notifications/read", { method: "POST", json: { ids: [shown.id] } }).then(() => refresh("/api/notifications"));
    const [target, query] = shown.href.split("?");
    const ref = new URLSearchParams(query).get("game");
    // Already in that chat: ask the page to open the game instead of navigating to itself.
    if (path === target && ref) window.dispatchEvent(new CustomEvent("fb:play", { detail: ref }));
    else router.push(shown.href);
  };
  const inFrame = host !== document.body;

  return createPortal(
    <div className={`${inFrame ? "absolute top-11" : "fixed top-0 pt-[max(10px,env(safe-area-inset-top))]"} inset-x-0 z-[90] px-2`}>
      <div role="alert" className="nudge-in flex items-center gap-2.5 rounded-2xl bg-white/95 p-2.5 shadow-[0_8px_30px_rgba(0,0,0,.18)] ring-1 ring-black/5 backdrop-blur">
        <button onClick={open} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
          <MuseHost size={40} image="/seed/muse/host-plush.webp" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[11.5px] text-ink-2">
              <span className="font-bold text-fb">facebook</span>
              <span>· Muse · now</span>
            </div>
            <div className="text-[14px] leading-snug font-medium text-ink">{shown.text}</div>
            <div className="mt-1 inline-flex rounded-full bg-fb px-3 py-1 text-[12.5px] font-semibold text-white">Play now</div>
          </div>
        </button>
        <button onClick={dismiss} aria-label="Dismiss" className="self-start rounded-full p-1 text-ink-2">
          <X size={16} />
        </button>
      </div>
    </div>,
    host,
  );
}

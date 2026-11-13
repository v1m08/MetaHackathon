"use client";
// Phone frame + top bar + tab bar. Every in-app page renders inside <Shell>.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Bell, Home, LayoutGrid, MessageCircle, Plus, Search, Store, Users, Clapperboard } from "lucide-react";
import { useApi } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Avatar, cx } from "./ui";
import type { User } from "@/types";

export type Me = User & { unreadMessages: number; unreadNotifications: number; friendRequests: number; groupIds: string[] };
export const useMe = () => useApi<Me>("/api/me", { poll: 4000 });

const tabs = [
  { href: "/feed", icon: Home, label: "Home" },
  { href: "/friends", icon: Users, label: "Friends", badge: "friendRequests" as const },
  { href: "/reels", icon: Clapperboard, label: "Reels" },
  { href: "/marketplace", icon: Store, label: "Marketplace" },
  { href: "/notifications", icon: Bell, label: "Notifications", badge: "unreadNotifications" as const },
  { href: "/menu", icon: LayoutGrid, label: "Menu" },
];

// The desktop "phone on a stage" only makes sense on a wide screen driven by a mouse.
// Real phones and tablets (coarse pointer) always get the full-bleed app.
const STAGE_QUERY = "(min-width: 768px) and (hover: hover) and (pointer: fine)";
export function useDesktopStage() {
  const { frame } = useSession();
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia(STAGE_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(STAGE_QUERY);
    const onChange = () => setWide(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return frame && wide;
}

export function PhoneFrame({ children }: { children: React.ReactNode }) {
  const stage = useDesktopStage();
  // Render exactly one copy of the app: two copies meant double data fetching and polling.
  if (!stage) return <div className="app-viewport h-dvh bg-bg">{children}</div>;
  return (
    <div className="phone-stage">
      <div className="phone">
        <div className="phone-notch" />
        <div className="app-viewport">{children}</div>
      </div>
    </div>
  );
}

export function TopBar({ title, back, right, transparent }: { title?: string; back?: boolean; right?: React.ReactNode; transparent?: boolean }) {
  const router = useRouter();
  const { data: me } = useMe();
  return (
    <header className={cx("safe-top sticky top-0 z-40", transparent ? "bg-transparent" : "border-b border-line/50 bg-white")}>
      <div className="flex h-14 items-center justify-between px-3">
        {back ? (
          <button onClick={() => router.back()} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-hover">
            <ArrowLeft size={22} />
          </button>
        ) : (
          <Link href="/feed" className="pl-1 text-[28px] font-extrabold tracking-[-0.04em] text-fb select-none">
            facebook
          </Link>
        )}
        {title && <span className="absolute left-1/2 -translate-x-1/2 text-[17px] font-bold">{title}</span>}
        <div className="flex items-center gap-2">
          {right ?? (
            <>
              <Link href="/compose" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e4e6eb]" aria-label="Create">
                <Plus size={20} />
              </Link>
              <Link href="/search" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e4e6eb]" aria-label="Search">
                <Search size={19} />
              </Link>
              <Link href="/messages" className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[#e4e6eb]" aria-label="Messenger">
                <MessageCircle size={20} />
                {!!me?.unreadMessages && <Badge n={me.unreadMessages} />}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function Badge({ n }: { n: number }) {
  return <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#e41e3f] px-1 text-[11px] font-bold text-white">{n > 9 ? "9+" : n}</span>;
}

export function TabBar({ dark }: { dark?: boolean }) {
  const path = usePathname();
  const { data: me } = useMe();
  return (
    <nav className={cx("safe-bottom sticky bottom-0 z-40 border-t", dark ? "border-white/10 bg-black" : "border-line/60 bg-white")}>
      <div className="flex h-[52px] items-stretch">
        {tabs.map((t) => {
          const active = path.startsWith(t.href);
          const Icon = t.icon;
          const n = t.badge && me ? me[t.badge] : 0;
          return (
            <Link key={t.href} href={t.href} className="relative flex flex-1 items-center justify-center" aria-label={t.label}>
              {active && <span className="absolute top-0 h-[3px] w-10 rounded-b bg-fb" />}
              <span className="relative">
                {t.href === "/menu" && me ? <Avatar src={me.avatar} name={me.name} size={26} /> : <Icon size={26} strokeWidth={active ? 2.4 : 1.8} className={active ? "text-fb" : dark ? "text-white/80" : "text-ink-2"} />}
                {!!n && <Badge n={n} />}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Standard page: top bar + scrollable content + tab bar. Use `bare` for full-bleed surfaces like Reels. */
export function Shell({ children, title, back, right, tabs: showTabs = true, dark, className }: { children: React.ReactNode; title?: string; back?: boolean; right?: React.ReactNode; tabs?: boolean; dark?: boolean; className?: string }) {
  return (
    <div className={cx("flex min-h-full flex-col", dark ? "bg-black" : "bg-bg")}>
      {title !== null && <TopBar title={title} back={back} right={right} />}
      <main className={cx("flex-1", className)}>{children}</main>
      {showTabs && <TabBar dark={dark} />}
    </div>
  );
}

/** Thin status strip rendered under the phone on desktop: who you are + AI activity. */
export function DemoStrip() {
  const { userId } = useSession();
  const stage = useDesktopStage();
  const { data: ai } = useApi<{ mode: string; calls: number; avgLatency: number }>("/api/ai/status", { poll: 3000 });
  if (!stage) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-50 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-black/70 px-4 py-1.5 text-[12px] text-white/90 backdrop-blur">
        <span>
          Viewing as <b className="text-white">@{userId}</b>
        </span>
        <span className="text-white/30">|</span>
        <Link href="/switch" className="hover:underline">Switch user</Link>
        <span className="text-white/30">|</span>
        <Link href="/dev/ai" className="hover:underline">
          AI Inspector · {ai ? `${ai.mode} · ${ai.calls} calls${ai.calls ? ` · ${ai.avgLatency}ms avg` : ""}` : "…"}
        </Link>
      </div>
    </div>
  );
}

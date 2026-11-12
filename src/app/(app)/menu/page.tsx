"use client";
import Link from "next/link";
import { Bookmark, CalendarDays, ChevronRight, Clapperboard, Compass, DoorOpen, Gamepad2, Heart, HelpCircle, Settings, Store, Users, UsersRound, Wand2 } from "lucide-react";
import { Shell, useMe } from "@/components/Shell";
import { Avatar, Button } from "@/components/ui";

const SHORTCUTS = [
  { href: "/groups", icon: UsersRound, label: "Groups", color: "text-fb" },
  { href: "/events", icon: CalendarDays, label: "Events", color: "text-red-500" },
  { href: "/travel", icon: Compass, label: "Trips", color: "text-fb" },
  { href: "/travel/opendoor", icon: DoorOpen, label: "Open Door", color: "text-emerald-600" },
  { href: "/marketplace", icon: Store, label: "Marketplace", color: "text-fb" },
  { href: "/dating", icon: Heart, label: "Dating", color: "text-pink-500" },
  { href: "/gaming", icon: Gamepad2, label: "Gaming", color: "text-fb" },
  { href: "/reels", icon: Clapperboard, label: "Reels", color: "text-orange-500" },
  { href: "/saved", icon: Bookmark, label: "Saved", color: "text-purple-600" },
  { href: "/friends", icon: Users, label: "Friends", color: "text-fb" },
];

export default function MenuPage() {
  const { data: me } = useMe();
  return (
    <Shell>
      <div className="px-4 pt-3">
        <h1 className="text-[24px] font-bold">Menu</h1>
        {me && (
          <Link href={`/profile/${me.id}`} className="mt-3 flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 shadow-sm">
            <Avatar src={me.avatar} name={me.name} size={40} />
            <div className="flex-1">
              <div className="text-[16px] font-semibold">{me.name}</div>
              <div className="text-[13px] text-ink-2">View your profile</div>
            </div>
            <ChevronRight size={18} className="text-ink-2" />
          </Link>
        )}
        <h2 className="mt-5 mb-2 text-[17px] font-bold">Your shortcuts</h2>
        <div className="grid grid-cols-2 gap-2">
          {SHORTCUTS.map((s) => (
            <Link key={s.href} href={s.href} className="rounded-xl bg-white p-3 shadow-sm">
              <s.icon size={26} className={s.color} />
              <div className="mt-2 text-[15px] font-semibold">{s.label}</div>
            </Link>
          ))}
        </div>

        <h2 className="mt-5 mb-2 text-[17px] font-bold">Hackathon tools</h2>
        <div className="divide-y divide-line/60 overflow-hidden rounded-xl bg-white shadow-sm">
          <Link href="/switch" className="flex items-center gap-3 px-3 py-3">
            <Users size={22} className="text-ink-2" />
            <span className="flex-1 text-[15px] font-semibold">Switch account</span>
            <ChevronRight size={18} className="text-ink-2" />
          </Link>
          <Link href="/dev/ai" className="flex items-center gap-3 px-3 py-3">
            <Wand2 size={22} className="text-ink-2" />
            <span className="flex-1 text-[15px] font-semibold">AI Inspector</span>
            <ChevronRight size={18} className="text-ink-2" />
          </Link>
          <div className="flex items-center gap-3 px-3 py-3">
            <Settings size={22} className="text-ink-2" />
            <span className="flex-1 text-[15px] font-semibold">Settings &amp; privacy</span>
          </div>
          <div className="flex items-center gap-3 px-3 py-3">
            <HelpCircle size={22} className="text-ink-2" />
            <span className="flex-1 text-[15px] font-semibold">Help &amp; support</span>
          </div>
        </div>
        <Link href="/switch" className="block pt-4 pb-6">
          <Button variant="secondary" className="w-full">Log out</Button>
        </Link>
      </div>
    </Shell>
  );
}

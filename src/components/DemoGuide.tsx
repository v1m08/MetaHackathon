"use client";
// The hackathon demo's "what to do next" banner. Only the 5 judge accounts see it. Pages get a sensible step from
// the URL; the group chat passes its own (it knows whether you've played and whether Muse has suggested a plan).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DEMO_CHAT, DEMO_EVENT_IDS, isDemoUser } from "@/lib/demo";
import { useMe } from "./Shell";

export type GuideStep = { step?: number; text: string; href?: string; cta?: string };
const TOTAL = 4;

export function DemoGuide({ guide }: { guide?: GuideStep | null }) {
  const { data: me } = useMe();
  const path = usePathname();
  if (!me || !isDemoUser(me.id)) return null;
  const g = guide === undefined ? stepFor(path, me.id, me.name.split(" ")[0]) : guide;
  if (!g) return null;
  return (
    <div className="px-3 pt-2">
      <div className="flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-white shadow-[0_4px_14px_rgba(123,97,255,0.35)]" style={{ background: "linear-gradient(100deg, #7B61FF, #FF6CAB)" }} role="status">
        {g.step && <span className="flex-none rounded-full bg-white/25 px-2 py-0.5 text-[11px] font-bold tracking-wide">STEP {g.step}/{TOTAL}</span>}
        <span className="min-w-0 flex-1 text-[14px] font-medium leading-snug">{g.text}</span>
        {g.href && g.cta && (
          <Link href={g.href} className="flex-none rounded-full bg-white px-3 py-1.5 text-[13px] font-bold text-[#6a4cf5] active:scale-95">
            {g.cta}
          </Link>
        )}
      </div>
    </div>
  );
}

function stepFor(path: string, myId: string, name: string): GuideStep | null {
  const chat = `/messages/${DEMO_CHAT}`;
  if (path === `/profile/${myId}`) return { step: 1, text: `Hi ${name}! This is you. Peek at your posts, then tap Next.`, href: "/messages", cta: "Next →" };
  if (path === "/messages") return { step: 2, text: "Open your group chat with the other judges.", href: chat, cta: "Open chat →" };
  if ((DEMO_EVENT_IDS as readonly string[]).some((id) => path === `/events/${id}`)) return { step: 4, text: "Muse picked this plan for your group. Tap Going if you'd go 🎉", href: chat, cta: "Back to chat" };
  if (path.startsWith("/messages/")) return null; // the chat sets its own
  return { text: "Your group chat is waiting.", href: chat, cta: "Open chat →" };
}

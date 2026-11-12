"use client";
// Feed nudge: "Owen is driving to Dallas on the 12th. You're free that weekend." Tapping opens Discover with that trip.
import Link from "next/link";
import { Car, ChevronRight, Compass } from "lucide-react";
import { Avatar } from "@/components/ui";
import { useApi } from "@/lib/api";

type Options = { nudges: { rideId: string; driver: { id: string; name: string; avatar: string; connection?: string }; toCityName: string; departAt: string; seatsOpen: number; event?: { id: string; title: string }; weekend?: { start: string; end: string; label: string } }[] };

export function TravelNudge({ index = 0 }: { index?: number }) {
  const { data } = useApi<Options>("/api/travel/options");
  const n = data?.nudges?.[index];
  if (!n || !n.weekend) return null;
  const day = new Date(n.departAt).toLocaleString("en-US", { month: "short", day: "numeric" });
  const href = `/travel?start=${n.weekend.start}&end=${n.weekend.end}&budget=100&run=1&hint=${encodeURIComponent(`I could ride with ${n.driver.name.split(" ")[0]} to ${n.toCityName}${n.event ? ` for ${n.event.title}` : ""}`)}`;
  return (
    <Link href={href} className="mb-2 block bg-white px-4 py-3">
      <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-fb"><Compass size={13} /> Where can my people take me?</div>
      <div className="mt-2 flex items-center gap-3">
        <span className="relative"><Avatar src={n.driver.avatar} name={n.driver.name} size={48} /><span className="absolute -right-1 -bottom-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-fb text-white"><Car size={12} /></span></span>
        <div className="min-w-0 flex-1 text-[15px] leading-snug">
          <b className="font-semibold">{n.driver.name.split(" ")[0]}</b> is driving to <b className="font-semibold">{n.toCityName}</b> on {day}{n.event ? ` for ${n.event.title}` : ""}. <span className="text-ink-2">You&apos;re free that weekend.</span>
        </div>
        <ChevronRight size={18} className="shrink-0 text-ink-2" />
      </div>
      <div className="mt-2 text-[12px] text-ink-2">{n.seatsOpen} seat{n.seatsOpen === 1 ? "" : "s"} open · {n.driver.connection} · tap to see what the weekend could look like</div>
    </Link>
  );
}

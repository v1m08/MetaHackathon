"use client";
import Link from "next/link";
import { BedDouble, Calendar, Car, ChevronRight, Home, Ticket, Users } from "lucide-react";
import { Avatar, Photo, cx } from "@/components/ui";
import type { Trip, TripPerson } from "@/lib/travel/validate";

const first = (n: string) => n.split(" ")[0];
const fmt = (iso: string) => new Date(iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric" });
const fmtTime = (iso: string) => new Date(iso).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });

export function PersonRow({ p, role, note }: { p: TripPerson; role: string; note?: string }) {
  return (
    <Link href={`/profile/${p.id}`} className="flex items-center gap-3 py-1.5">
      <Avatar src={p.avatar} name={p.name} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[14px]">
          <b className="font-semibold">{p.name}</b>
          <span className="text-ink-2">· {role}</span>
        </div>
        <div className="truncate text-[12px] text-ink-2">
          {p.degree === 1 ? p.connection : <>{p.connection}{p.via ? <> · intro via <b className="font-semibold">{first(p.via.name)}</b></> : null}</>}
          {note ? ` · ${note}` : ""}
        </div>
      </div>
      {p.openToHosting && role.startsWith("host") && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Open to hosting</span>}
    </Link>
  );
}

export function PriceLine({ trip, big }: { trip: Trip; big?: boolean }) {
  const { ifYes, otherwise, conditions } = trip.prices;
  const cond = conditions.length ? conditions.join(" and ") : "with your network";
  return (
    <div className={cx("rounded-xl bg-[#f0f2f5] px-3 py-2.5", big && "px-4 py-3")}>
      <div className="flex items-baseline gap-2">
        <span className={cx("font-bold tabular-nums", big ? "text-[28px]" : "text-[22px]", trip.fitsBudget ? "text-ink" : "text-amber-700")}>~${ifYes.total}</span>
        <span className="text-[13px] text-ink-2">if {cond}</span>
      </div>
      <div className="text-[13px] text-ink-2">
        <b className="font-semibold text-ink">~${otherwise.total}</b> otherwise ({otherwise.lodging === "hostel" ? "hostel" : otherwise.lodging}{otherwise.transport !== ifYes.transport ? ` + ${otherwise.transport}` : ""}) · a hotel trip would be ~${trip.prices.solo.total}
      </div>
      {!trip.fitsBudget && <div className="mt-1 text-[12px] font-semibold text-amber-700">${ifYes.total - trip.budget} over your ${trip.budget}</div>}
    </div>
  );
}

export function TripCard({ trip, compact }: { trip: Trip; compact?: boolean }) {
  const cover = trip.evidence[0]?.image;
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
      {cover && !compact && (
        <div className="relative h-40">
          <Photo src={cover} className="h-40 w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-2 pt-10 text-white">
            <div className="text-[12px] opacity-90">{trip.evidence[0].author.split(" ")[0]}&apos;s photo · {trip.cityName}, {trip.state}</div>
          </div>
        </div>
      )}
      <div className="px-4 pt-3">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-fb"><Calendar size={12} /> {trip.nights === 0 ? `${fmt(trip.start)} · day trip` : `${fmt(trip.start)} – ${fmt(trip.end)} · ${trip.nights} night${trip.nights === 1 ? "" : "s"}`}</div>
        <h3 className="mt-0.5 text-[19px] font-bold leading-tight">{trip.title}</h3>
        {!compact && <p className="mt-1.5 text-[14.5px] leading-snug text-ink">{trip.pitch}</p>}
        <div className="mt-3"><PriceLine trip={trip} /></div>
        <div className="mt-2 divide-y divide-line/60">
          {trip.host && <PersonRow p={trip.host} role="host" note={trip.host.hostingNote} />}
          {trip.ride && <PersonRow p={trip.ride.driver} role={`driving · ${trip.ride.seatsOpen} seat${trip.ride.seatsOpen === 1 ? "" : "s"} open`} note={`leaves ${fmtTime(trip.ride.departAt)}`} />}
          {trip.people.slice(0, compact ? 1 : 3).map((p) => <PersonRow key={p.id} p={p} role={p.id === trip.event?.goingYouKnow.find((g) => g.id === p.id)?.id ? "going too" : "there"} />)}
        </div>
        {trip.event && (
          <Link href={`/events/${trip.event.id}`} className="mt-1 flex items-center gap-3 rounded-xl border border-line/70 px-3 py-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-fb/10 text-fb"><Ticket size={18} /></span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-semibold">{trip.event.title}</div>
              <div className="truncate text-[12px] text-ink-2">{fmtTime(trip.event.startsAt)} · {trip.event.location}{trip.event.goingYouKnow.length ? ` · ${trip.event.goingYouKnow.slice(0, 3).map((g) => first(g.name)).join(", ")} going` : ""}</div>
            </div>
            <ChevronRight size={16} className="text-ink-2" />
          </Link>
        )}
        {!compact && trip.reasons.length > 0 && (
          <ul className="mt-3 space-y-1 text-[13.5px] text-ink">
            {trip.reasons.map((r, i) => <li key={i} className="flex gap-2"><span className="text-fb">•</span><span>{r}</span></li>)}
          </ul>
        )}
        {!compact && trip.evidence.length > 1 && (
          <div className="mt-3 flex gap-1.5 overflow-x-auto">
            {trip.evidence.slice(0, 5).map((e) => (
              <Link key={e.id} href={e.kind === "post" ? `/post/${e.id}` : "/reels"} className="relative shrink-0">
                <Photo src={e.image} className="h-16 w-16 rounded-lg object-cover" />
                <span className="absolute bottom-0 left-0 right-0 truncate rounded-b-lg bg-black/60 px-1 text-[10px] text-white">{first(e.author)}</span>
              </Link>
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center gap-3 border-t border-line/60 py-2.5 text-[12px] text-ink-2">
          <span className="flex items-center gap-1"><Home size={13} /> {trip.nights === 0 ? "back the same night" : trip.host ? `stay with ${first(trip.host.name)}` : "hostel"}</span>
          <span className="flex items-center gap-1"><Car size={13} /> {trip.prices.transportIfYes === "ride" ? `ride with ${first(trip.ride!.driver.name)}` : trip.prices.transportIfYes}</span>
          <span className="flex items-center gap-1"><Users size={13} /> {trip.people.length + (trip.host ? 1 : 0) + (trip.ride ? 1 : 0)} people you know</span>
          <span className="ml-auto flex items-center gap-1"><BedDouble size={13} /> {trip.prices.miles} mi</span>
        </div>
      </div>
      <Link href={`/travel/${trip.id}`} className="flex items-center justify-center gap-1 bg-fb py-2.5 text-[15px] font-semibold text-white">Build my guide <ChevronRight size={16} /></Link>
    </div>
  );
}

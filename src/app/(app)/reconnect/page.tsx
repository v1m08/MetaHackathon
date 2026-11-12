"use client";
// Reconnect: the people you've drifted from, in four kinds. The trigger usually brings you here from a notification
// or the feed; this is the place to come on purpose. Everything on it is computed in code from your own chats,
// events and tagged photos. Nothing here is visible to anyone else.
import Link from "next/link";
import { Car, ChevronRight, Heart, Landmark, MapPin, MessageCircle, Users } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Avatar, cx } from "@/components/ui";
import { useApi } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { MissButton, StatePill, type DriftState } from "@/components/reconnect/ui";
import type { Crew, CultureCard, DriftCard, Place } from "@/lib/reconnect/drift";

type Data = { people: DriftCard[]; crews: Crew[]; places: Place[]; culture: CultureCard[]; stats: { friends: number; asleep: number; napping: number; withHistory: number; withTrigger: number }; mutual: string[] };

export default function ReconnectPage() {
  const { data } = useApi<Data>("/api/reconnect/drift", { poll: 6000 });
  const asleep = data?.people.filter((p) => p.state !== "awake") ?? [];
  const awake = data?.people.filter((p) => p.state === "awake") ?? [];
  return (
    <Shell back title="Reconnect">
      <div className="space-y-2 pb-6">
        <section className="bg-white px-4 py-3">
          <div className="text-[13px] leading-snug text-ink-2">Friendships don&apos;t end, they go quiet. This is computed from your own chats, events and tagged photos. Likes don&apos;t count, and nobody else can see this list.</div>
          {data && <div className="mt-2 flex gap-2 text-[12.5px]"><span className="rounded-full bg-[#f0f2f5] px-2.5 py-1"><b className="font-semibold">{data.stats.asleep}</b> of {data.stats.friends} quiet</span><span className="rounded-full bg-[#f0f2f5] px-2.5 py-1"><b className="font-semibold">{data.stats.withHistory}</b> with history to draw on</span>{data.mutual.length > 0 && <span className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-700"><b className="font-semibold">{data.mutual.length}</b> mutual</span>}</div>}
        </section>

        <section className="bg-white pb-2">
          <h2 className="flex items-center gap-2 px-4 pt-3 pb-1 text-[17px] font-bold"><MessageCircle size={16} className="text-fb" /> A person</h2>
          {!data && <div className="px-4 py-6 text-[13px] text-ink-2">Reading your history…</div>}
          {asleep.slice(0, 8).map((p) => <PersonRow key={p.friendId} p={p} />)}
          {asleep.length > 8 && <div className="px-4 pt-1 text-[12.5px] text-ink-2">+{asleep.length - 8} more quiet friends below</div>}
        </section>

        {data && data.crews.length > 0 && (
          <section className="bg-white pb-2">
            <h2 className="flex items-center gap-2 px-4 pt-3 pb-1 text-[17px] font-bold"><Users size={16} className="text-fb" /> A chapter</h2>
            {data.crews.map((c) => (
              <Link key={c.id} href={`/reconnect/${encodeURIComponent(c.id)}`} className="flex items-start gap-3 px-4 py-2.5">
                <span className="flex -space-x-2">{c.members.slice(0, 3).map((m) => <span key={m.id} className="rounded-full border-2 border-white"><Avatar src={m.avatar} name={m.name} size={36} /></span>)}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2"><b className="truncate text-[15px] font-semibold">{c.name}</b><StatePill state={c.quiet >= c.memberIds.length / 2 ? "napping" : c.quiet ? "sleepy" : "awake"} label={c.quiet ? `${c.quiet} of ${c.memberIds.length} quiet` : "all awake"} /></span>
                  {c.hook ? <span className="mt-0.5 block text-[13px] leading-snug text-ink-2"><b className="font-semibold text-ink">{c.members.find((m) => m.id === c.hook!.authorId)?.name.split(" ")[0]}</b> asked: “{c.hook.text.slice(0, 90)}{c.hook.text.length > 90 ? "…" : ""}” <span className="text-amber-800">No plan came of it.</span></span> : <span className="mt-0.5 block text-[13px] text-ink-2">{c.kind === "label" ? "People you know from the same place." : `Last message ${c.lastTogether ? timeAgo(c.lastTogether) : "a while ago"}.`}</span>}
                </span>
                <ChevronRight size={18} className="mt-2 shrink-0 text-ink-2" />
              </Link>
            ))}
          </section>
        )}

        {data && data.culture.length > 0 && (
          <section className="bg-white pb-2">
            <h2 className="flex items-center gap-2 px-4 pt-3 pb-1 text-[17px] font-bold"><Landmark size={16} className="text-fb" /> Your culture</h2>
            {data.culture.map((c) => (
              <Link key={c.groupId} href={`/reconnect/${encodeURIComponent(`event:${c.event.id}`)}`} className="flex items-start gap-3 px-4 py-2.5">
                <span className="flex -space-x-2">{c.friendsGoing.slice(0, 3).map((m) => <span key={m.id} className="rounded-full border-2 border-white"><Avatar src={m.avatar} name={m.name} size={36} /></span>)}</span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[15px] font-semibold">{c.event.title}</b>
                  <span className="block text-[13px] leading-snug text-ink-2">{c.groupName} · {new Date(c.event.startsAt).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric" })} · {c.friendsGoing.map((f) => f.name.split(" ")[0]).slice(0, 3).join(", ")} going{c.lastWent ? ` · you last went ${timeAgo(c.lastWent)}` : ""}</span>
                </span>
                <ChevronRight size={18} className="mt-2 shrink-0 text-ink-2" />
              </Link>
            ))}
          </section>
        )}

        {data && data.places.length > 0 && (
          <section className="bg-white pb-2">
            <h2 className="flex items-center gap-2 px-4 pt-3 pb-1 text-[17px] font-bold"><MapPin size={16} className="text-fb" /> A place</h2>
            {data.places.slice(0, 4).map((pl) => (
              <Link key={pl.city} href={`/reconnect/${encodeURIComponent(`city:${pl.city}`)}`} className="flex items-start gap-3 px-4 py-2.5">
                <span className="flex -space-x-2">{pl.friends.slice(0, 3).map((m) => <span key={m.id} className="rounded-full border-2 border-white"><Avatar src={m.avatar} name={m.name} size={36} /></span>)}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2"><b className="text-[15px] font-semibold">{pl.cityName}</b><StatePill state={pl.quiet >= pl.friends.length / 2 ? "napping" : pl.quiet ? "sleepy" : "awake"} label={`${pl.quiet} of ${pl.friends.length} quiet`} /></span>
                  <span className="block text-[13px] leading-snug text-ink-2">{pl.friends.map((f) => f.name.split(" ")[0]).join(", ")}{pl.ride ? <> · <Car size={12} className="inline" /> {pl.ride.driverName.split(" ")[0]} is driving up {new Date(pl.ride.departAt).toLocaleString("en-US", { month: "short", day: "numeric" })}, {pl.ride.seatsOpen} seats</> : ""}</span>
                </span>
                <ChevronRight size={18} className="mt-2 shrink-0 text-ink-2" />
              </Link>
            ))}
          </section>
        )}

        {asleep.length > 8 && (
          <section className="bg-white pb-2">
            <h2 className="px-4 pt-3 pb-1 text-[15px] font-bold text-ink-2">More quiet friends</h2>
            {asleep.slice(8).map((p) => <PersonRow key={p.friendId} p={p} />)}
          </section>
        )}
        {awake.length > 0 && (
          <section className="bg-white pb-2">
            <h2 className="px-4 pt-3 pb-1 text-[15px] font-bold text-ink-2">Awake</h2>
            <div className="flex flex-wrap gap-1.5 px-4 pb-2">{awake.map((p) => <Link key={p.friendId} href={`/reconnect/${p.friendId}`} className="inline-flex items-center gap-1.5 rounded-full bg-[#f0f2f5] py-0.5 pr-2.5 pl-0.5 text-[12.5px]"><Avatar src={p.avatar} name={p.name} size={22} /> {p.name.split(" ")[0]}</Link>)}</div>
          </section>
        )}
        <div className="px-4 pt-2 text-[12px] text-ink-2">Rhythm = the median gap between your real exchanges with someone over the last six months. Quiet means you&apos;re past it. <Heart size={11} className="inline fill-rose-400 text-rose-400" /> is private: if you both tap it, you both find out, and nobody else ever does.</div>
      </div>
    </Shell>
  );
}

function PersonRow({ p }: { p: DriftCard }) {
  return (
    <Link href={`/reconnect/${p.friendId}`} className={cx("flex items-start gap-3 px-4 py-2.5", p.mutual && "bg-rose-50/40")}>
      <Avatar src={p.avatar} name={p.name} size={48} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2"><b className="truncate text-[15px] font-semibold">{p.name}</b><StatePill state={p.state as DriftState} label={p.daysSince === null ? "quiet" : p.state} /></span>
        <span className="block text-[12.5px] text-ink-2">{p.connection}{p.cityName ? ` · ${p.cityName}` : ""} · {p.daysSince === null ? "no real exchange we can see" : `${p.daysSince < 14 ? `${p.daysSince} days` : `${Math.round(p.daysSince / 7)} weeks`} since a real chat`}</span>
        {p.recentPost && <span className="mt-0.5 block truncate text-[13px] text-ink">Posted {timeAgo(p.recentPost.createdAt)}: “{p.recentPost.text.slice(0, 70)}”</span>}
        <span className="mt-1.5 flex items-center gap-2"><MissButton personId={p.friendId} missed={p.missed} mutual={p.mutual} size="sm" />{p.sharedCount > 0 && <span className="text-[11.5px] text-ink-2">{p.sharedCount} shared {p.sharedCount === 1 ? "memory" : "memories"}</span>}</span>
      </span>
      <ChevronRight size={18} className="mt-3 shrink-0 text-ink-2" />
    </Link>
  );
}

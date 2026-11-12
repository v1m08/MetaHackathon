"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Calendar, Car, Check, ChevronRight, Compass, MapPin, Share2, Star, Ticket, Users } from "lucide-react";
import { PostCard } from "@/components/Post";
import { Shell, useMe } from "@/components/Shell";
import { Avatar, Button, Photo, cx } from "@/components/ui";
import { api, refresh, useApi } from "@/lib/api";
import { eventDate, eventDay } from "@/lib/format";
import type { HydratedPost } from "@/server/db";
import type { FBEvent, Group } from "@/types";

type Card = { id: string; name: string; avatar: string };
type E = FBEvent & { host?: Card; hostGroup?: Group; myStatus: "going" | "interested" | "none"; goingUsers: Card[]; interestedUsers: Card[]; friendsGoing: Card[]; posts: HydratedPost[]; myRide: { id: string; seatsOpen: number } | null; outOfTownForMe: boolean };

export default function EventPage() {
  const { id } = useParams<{ id: string }>();
  const { data: e, mutate } = useApi<E>(`/api/events/${id}`);
  const [text, setText] = useState("");
  const { data: me } = useMe();
  if (!e) return <Shell back title=""><div className="skeleton h-56" /></Shell>;
  const outOfTown = !!e.city && !!me?.city && e.city !== me.city;
  const tripHref = (() => {
    const d = new Date(e.startsAt);
    const dow = d.getDay();
    const fri = new Date(d);
    fri.setDate(d.getDate() - (dow === 6 ? 1 : dow === 0 ? 2 : dow === 5 ? 0 : dow - 5 < 0 ? dow + 2 : 0));
    const sun = new Date(fri);
    sun.setDate(fri.getDate() + 2);
    const ymd = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
    return `/travel?start=${ymd(fri)}&end=${ymd(sun)}&budget=150&run=1&hint=${encodeURIComponent(`I want to go to ${e.title} in ${e.location}`)}`;
  })();
  const { mon, day } = eventDay(e.startsAt);
  const setStatus = async (status: "going" | "interested" | "none") => {
    await api(`/api/events/${e.id}/rsvp`, { method: "POST", json: { status: e.myStatus === status ? "none" : status } });
    mutate();
  };
  const post = async () => {
    if (!text.trim()) return;
    await api("/api/posts", { method: "POST", json: { text, eventId: e.id, audience: "public" } });
    setText("");
    mutate();
  };
  return (
    <Shell back title="" right={<button className="rounded-full p-2"><Share2 size={20} /></button>}>
      <div className="bg-white pb-3">
        <div className="relative">
          <Photo src={e.cover} className="h-52 w-full object-cover" />
          <div className="absolute bottom-3 left-4 flex h-14 w-14 flex-col items-center justify-center rounded-lg bg-white shadow">
            <span className="text-[11px] font-bold text-red-600">{mon}</span>
            <span className="text-[22px] font-bold leading-none">{day}</span>
          </div>
        </div>
        <div className="px-4 pt-3">
          <div className="text-[14px] font-semibold text-red-600 uppercase">{eventDate(e.startsAt)}</div>
          <h1 className="mt-1 text-[22px] font-bold leading-tight">{e.title}</h1>
          <div className="mt-1 text-[15px] text-ink-2">{e.location}</div>
          <div className="mt-2 flex items-center gap-2 text-[14px] text-ink-2">
            <span className="flex -space-x-1.5">{e.goingUsers.slice(0, 4).map((f) => <span key={f.id} className="rounded-full border border-white"><Avatar src={f.avatar} name={f.name} size={22} /></span>)}</span>
            <span><b className="font-semibold text-ink">{e.going.length} going</b> · {e.interested.length} interested{e.friendsGoing.length > 0 && <> · {e.friendsGoing.length} friends</>}</span>
          </div>
          <div className="mt-3 flex gap-2">
            <Button className={cx("flex-1", e.myStatus === "going" ? "" : "")} variant={e.myStatus === "going" ? "primary" : "secondary"} onClick={() => setStatus("going")}>
              <Check size={16} /> {e.myStatus === "going" ? "Going" : "Going?"}
            </Button>
            <Button className="flex-1" variant={e.myStatus === "interested" ? "primary" : "secondary"} onClick={() => setStatus("interested")}>
              <Star size={16} /> Interested
            </Button>
          </div>
          {e.outOfTownForMe && (
            <div className="mt-2 flex items-center gap-2 rounded-xl bg-[#f0f2f5] px-3 py-2 text-[13.5px]">
              <Car size={16} className="text-fb" />
              <span className="flex-1">{e.myRide ? <><b className="font-semibold">You&apos;re driving</b> · {e.myRide.seatsOpen} seat{e.myRide.seatsOpen === 1 ? "" : "s"} open. Friends&apos; agents can ask for one.</> : <><b className="font-semibold">Driving there?</b> <span className="text-ink-2">Share your empty seats with your people.</span></>}</span>
              <select value={e.myRide?.seatsOpen ?? 0} onChange={async (ev) => { await api(`/api/events/${e.id}/rsvp`, { method: "POST", json: { drivingSeats: Number(ev.target.value) } }); mutate(); refresh("/api/travel/options"); }} className="rounded-lg border border-line bg-white px-2 py-1 text-[13px]">
                <option value={0}>not driving</option>
                {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} seat{n === 1 ? "" : "s"}</option>)}
              </select>
            </div>
          )}
          {outOfTown && (
            <Link href={tripHref} className="mt-2 flex items-center gap-3 rounded-xl border border-fb/30 bg-fb/5 px-3 py-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-fb text-white"><Compass size={18} /></span>
              <span className="min-w-0 flex-1 text-[14px] leading-snug"><b className="font-semibold">Make this a trip.</b> <span className="text-ink-2">See who could host you and who&apos;s driving{e.friendsGoing.length ? ` · ${e.friendsGoing.length} friend${e.friendsGoing.length === 1 ? "" : "s"} going` : ""}.</span></span>
              <ChevronRight size={16} className="text-ink-2" />
            </Link>
          )}
          <div className="hidden" />
        </div>
        <div className="mt-4 space-y-3 border-t border-line/60 px-4 pt-3 text-[15px]">
          <div className="flex gap-3"><Calendar size={20} className="shrink-0 text-ink-2" /><span>{eventDate(e.startsAt)}{e.endsAt && ` – ${new Date(e.endsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`}</span></div>
          <div className="flex gap-3"><MapPin size={20} className="shrink-0 text-ink-2" /><span><b className="font-semibold">{e.location}</b>{e.address && <div className="text-ink-2">{e.address}</div>}</span></div>
          {e.price && <div className="flex gap-3"><Ticket size={20} className="shrink-0 text-ink-2" /><span>{e.price}</span></div>}
          <div className="flex gap-3">
            <Users size={20} className="shrink-0 text-ink-2" />
            <span>
              Hosted by{" "}
              {e.host && <Link href={`/profile/${e.host.id}`} className="font-semibold">{e.host.name}</Link>}
              {e.hostGroup && <> · <Link href={`/groups/${e.hostGroup.id}`} className="font-semibold">{e.hostGroup.name}</Link></>}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-2 bg-white px-4 py-3 text-[15px]">
        <h2 className="text-[17px] font-bold">What to expect</h2>
        <p className="mt-2 leading-snug whitespace-pre-wrap">{e.description}</p>
      </div>
      <div className="mt-2 bg-white px-4 py-3">
        <h2 className="text-[17px] font-bold">Guests</h2>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {e.goingUsers.slice(0, 6).map((g) => (
            <Link key={g.id} href={`/profile/${g.id}`} className="flex flex-col items-center rounded-lg bg-[#f0f2f5] p-2 text-center">
              <Avatar src={g.avatar} name={g.name} size={48} />
              <span className="mt-1 truncate text-[12px] font-semibold">{g.name.split(" ")[0]}</span>
            </Link>
          ))}
        </div>
      </div>
      <div className="mt-2 bg-white">
        <h2 className="px-4 pt-3 text-[17px] font-bold">Discussion</h2>
        <div className="flex items-center gap-2 px-4 py-3">
          <input value={text} onChange={(ev) => setText(ev.target.value)} onKeyDown={(ev) => ev.key === "Enter" && post()} placeholder="Ask a question or share an update…" className="flex-1 rounded-full bg-[#f0f2f5] px-4 py-2.5 text-[15px] outline-none" />
          <Button onClick={post} disabled={!text.trim()} className="rounded-full px-4">Post</Button>
        </div>
      </div>
      {e.posts.map((p) => <PostCard key={p.id} post={p} compact />)}
      {e.posts.length === 0 && <div className="bg-white py-6 text-center text-[14px] text-ink-2">No posts yet. Start the discussion.</div>}
    </Shell>
  );
}

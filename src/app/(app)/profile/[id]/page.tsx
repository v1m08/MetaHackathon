"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Briefcase, Camera, Compass, GraduationCap, Heart, Home, MapPin, MessageCircle, MoreHorizontal, Pencil, UserPlus, UserCheck, Clock } from "lucide-react";
import { ComposerCard } from "@/components/Composer";
import { PostCard } from "@/components/Post";
import { Shell } from "@/components/Shell";
import { Avatar, Button, Photo, Pill, PostSkeleton, cx } from "@/components/ui";
import { api, refresh, useApi } from "@/lib/api";
import { useSession } from "@/lib/session";
import { OpenDoorBadge } from "@/components/travel/OpenDoor";
import type { HydratedPost } from "@/server/db";
import type { Reel, User } from "@/types";

type Profile = User & {
  friends: { id: string; name: string; avatar: string }[];
  mutualCount: number;
  isFriend: boolean;
  requestPending: boolean;
  requestedMe: boolean;
  photos: string[];
  posts: HydratedPost[];
  groups: { id: string; name: string; cover: string; members: number }[];
  reels: Reel[];
};

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useSession();
  const { data: u, mutate } = useApi<Profile>(`/api/users/${id}`);
  const { data: me } = useApi<User>("/api/me");
  const [tab, setTab] = useState<"posts" | "about" | "photos" | "reels">("posts");
  if (!u) return <Shell back title=""><div className="skeleton h-56" /><PostSkeleton /></Shell>;
  const mine = u.id === userId;

  async function message() {
    const { id: cid } = await api<{ id: string }>(`/api/conversations/with/${u!.id}`, { method: "POST" });
    router.push(`/messages/${cid}`);
  }

  return (
    <Shell back title={u.name} right={<button className="rounded-full p-2"><MoreHorizontal size={22} /></button>}>
      <div className="bg-white pb-3">
        <div className="relative">
          <Photo src={u.cover} className="h-44 w-full object-cover" />
          <div className="absolute -bottom-12 left-4 rounded-full border-4 border-white">
            <Avatar src={u.avatar} name={u.name} size={128} />
          </div>
          {mine && <button className="absolute right-3 bottom-3 rounded-full bg-white p-2 shadow"><Camera size={18} /></button>}
        </div>
        <div className="mt-14 px-4">
          <h1 className="text-[26px] font-bold leading-tight">{u.name}</h1>
          <div className="text-[15px] text-ink-2">{u.pronouns} · <b className="font-semibold text-ink">{u.friends.length} friends</b>{!mine && u.mutualCount > 0 && <> · {u.mutualCount} mutual</>}</div>
          <p className="mt-2 text-[15px] leading-snug">{u.bio}</p>
          <div className="mt-3 flex gap-2">
            {mine ? (
              <>
                <Button className="flex-1"><Pencil size={16} /> Edit profile</Button>
                <Link href="/compose" className="flex-1"><Button variant="secondary" className="w-full">Add to story</Button></Link>
              </>
            ) : u.isFriend ? (
              <>
                <Button className="flex-1" onClick={message}><MessageCircle size={16} /> Message</Button>
                <Button variant="secondary" className="flex-1"><UserCheck size={16} /> Friends</Button>
              </>
            ) : (
              <>
                {u.requestedMe ? (
                  <Button className="flex-1" onClick={async () => { await api("/api/friends/respond", { method: "POST", json: { fromId: u.id, accept: true } }); mutate(); refresh("/api/me"); }}><UserCheck size={16} /> Confirm request</Button>
                ) : (
                  <Button className="flex-1" disabled={u.requestPending} onClick={async () => { await api("/api/friends/request", { method: "POST", json: { toId: u.id } }); mutate(); }}>
                    {u.requestPending ? <><Clock size={16} /> Requested</> : <><UserPlus size={16} /> Add friend</>}
                  </Button>
                )}
                <Button variant="secondary" className="flex-1" onClick={message}><MessageCircle size={16} /> Message</Button>
              </>
            )}
          </div>
        </div>
        <div className="mt-4 border-t border-line/60 px-4 pt-3 text-[15px]">
          <div className="space-y-2">
            {u.work && <div className="flex items-center gap-3"><Briefcase size={20} className="text-ink-2" /><span>{u.work}</span></div>}
            {u.school && <div className="flex items-center gap-3"><GraduationCap size={20} className="text-ink-2" /><span>{u.school}</span></div>}
            <div className="flex items-center gap-3"><Home size={20} className="text-ink-2" /><span>Lives in <b className="font-semibold">{u.location}</b></span></div>
            {u.hometown && <div className="flex items-center gap-3"><MapPin size={20} className="text-ink-2" /><span>From <b className="font-semibold">{u.hometown}</b></span></div>}
            {u.relationship && <div className="flex items-center gap-3"><Heart size={20} className="text-ink-2" /><span>{u.relationship}</span></div>}
            {mine ? (
              <Link href="/travel/setup" className="flex items-center gap-3 rounded-xl bg-[#f0f2f5] px-3 py-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-fb text-white"><Compass size={18} /></span>
                <span className="min-w-0 flex-1 text-[14px] leading-snug"><b className="font-semibold">Trips settings.</b> <span className="text-ink-2">{u.openDoor?.on ? `Your agent answers for you (${u.openDoor.offers.length} offer${u.openDoor.offers.length === 1 ? "" : "s"}, open to ${u.openDoor.tier === "fof" ? "friends of friends" : u.openDoor.tier === "network" ? "your network" : "friends"}).` : "Your agent is off; turn it on to let friends' agents ask you."} Travel style lives here too.</span></span>
              </Link>
            ) : (
              <>
                <OpenDoorBadge d={u.openDoor} name={u.name} />
                {u.city && me?.city && u.city !== me.city && (u.isFriend || u.mutualCount > 0) && (
                  <Link href={`/travel?hint=${encodeURIComponent(`I want to visit ${u.name.split(" ")[0]} in ${u.location}`)}`} className="flex items-center gap-3 rounded-xl border border-fb/30 bg-fb/5 px-3 py-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-fb text-white"><Compass size={18} /></span>
                    <span className="min-w-0 flex-1 text-[14px] leading-snug"><b className="font-semibold">Plan a visit.</b> <span className="text-ink-2">See what a weekend in {u.location.split(",")[0]} would cost with your people.</span></span>
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
        <div className="mt-3 flex gap-2 border-t border-line/60 px-4 pt-3">
          {(["posts", "about", "photos", "reels"] as const).map((t) => (
            <Pill key={t} active={tab === t} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</Pill>
          ))}
        </div>
      </div>

      {tab === "posts" && (
        <>
          <div className="mt-2 bg-white px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[17px] font-bold">Friends</div>
                <div className="text-[13px] text-ink-2">{u.friends.length} friends</div>
              </div>
              <Link href="/friends" className="text-[15px] font-medium text-fb">See all</Link>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {u.friends.slice(0, 6).map((f) => (
                <Link key={f.id} href={`/profile/${f.id}`} className="overflow-hidden rounded-lg">
                  <div className="aspect-square overflow-hidden rounded-lg bg-gray-200"><Photo src={f.avatar} className="h-full w-full object-cover" /></div>
                  <div className="truncate pt-1 text-[13px] font-semibold">{f.name}</div>
                </Link>
              ))}
            </div>
          </div>
          <div className="mt-2">
            {mine && <ComposerCard />}
            {u.posts.length === 0 && <div className="bg-white py-10 text-center text-ink-2">No posts yet</div>}
            {u.posts.map((p) => <PostCard key={p.id} post={p} />)}
          </div>
        </>
      )}
      {tab === "about" && (
        <div className="mt-2 bg-white px-4 py-4 text-[15px]">
          <h3 className="text-[17px] font-bold">Interests</h3>
          <div className="mt-2 flex flex-wrap gap-2">{u.interests.map((i) => <span key={i} className="rounded-full bg-[#f0f2f5] px-3 py-1">{i}</span>)}</div>
          <h3 className="mt-5 text-[17px] font-bold">Groups</h3>
          <div className="mt-2 space-y-2">
            {u.groups.map((g) => (
              <Link key={g.id} href={`/groups/${g.id}`} className="flex items-center gap-3">
                <Photo src={g.cover} className="h-12 w-12 rounded-lg object-cover" />
                <div><div className="font-semibold leading-tight">{g.name}</div><div className="text-[13px] text-ink-2">{g.members} members</div></div>
              </Link>
            ))}
          </div>
          <h3 className="mt-5 text-[17px] font-bold">Joined</h3>
          <div className="mt-1 text-ink-2">Facebook member since {new Date(u.joined).getFullYear()}</div>
        </div>
      )}
      {tab === "photos" && (
        <div className="mt-2 grid grid-cols-3 gap-0.5 bg-white p-0.5">
          {u.photos.length === 0 && <div className="col-span-3 py-10 text-center text-ink-2">No photos yet</div>}
          {u.photos.map((p, i) => <Photo key={i} src={p} className="aspect-square w-full object-cover" />)}
        </div>
      )}
      {tab === "reels" && (
        <div className={cx("mt-2 grid grid-cols-3 gap-0.5 bg-white p-0.5")}>
          {u.reels.length === 0 && <div className="col-span-3 py-10 text-center text-ink-2">No reels yet</div>}
          {u.reels.map((r) => (
            <Link key={r.id} href="/reels" className="relative aspect-[9/16]">
              <Photo src={r.image} className="h-full w-full object-cover" />
              <span className="absolute bottom-1 left-1 text-[12px] font-semibold text-white drop-shadow">▶ {Math.round(r.views / 1000)}K</span>
            </Link>
          ))}
        </div>
      )}
    </Shell>
  );
}

"use client";
import Link from "next/link";
import { Shell } from "@/components/Shell";
import { Avatar, Button, Pill, SectionTitle } from "@/components/ui";
import { api, refresh, useApi } from "@/lib/api";
import { timeAgo } from "@/lib/format";

type Card = { id: string; name: string; avatar: string; mutuals?: number; createdAt?: string };
type Data = { friends: Card[]; requests: Card[]; suggestions: Card[] };

function Row({ u, actions, sub }: { u: Card; actions: React.ReactNode; sub?: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <Link href={`/profile/${u.id}`}>
        <Avatar src={u.avatar} name={u.name} size={60} />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <Link href={`/profile/${u.id}`} className="truncate text-[16px] font-semibold">{u.name}</Link>
          {u.createdAt && <span className="text-[13px] text-ink-2">{timeAgo(u.createdAt)}</span>}
        </div>
        {sub && <div className="text-[13px] text-ink-2">{sub}</div>}
        <div className="mt-1.5 flex gap-2">{actions}</div>
      </div>
    </div>
  );
}

export default function FriendsPage() {
  const { data, mutate } = useApi<Data>("/api/friends");
  const act = async (path: string, json: unknown) => {
    await api(path, { method: "POST", json });
    await Promise.all([mutate(), refresh("/api/me")]);
  };
  return (
    <Shell title="Friends" back>
      <div className="bg-white pb-2">
        <div className="flex gap-2 px-4 py-3">
          <Pill active>Suggestions</Pill>
          <Pill>Your friends</Pill>
        </div>
        <SectionTitle action={data?.requests.length ? `${data.requests.length}` : undefined}>Friend requests</SectionTitle>
        {data?.requests.length === 0 && <div className="px-4 pb-2 text-[14px] text-ink-2">No new requests</div>}
        {data?.requests.map((u) => (
          <Row
            key={u.id}
            u={u}
            sub={u.mutuals ? `${u.mutuals} mutual friends` : undefined}
            actions={
              <>
                <Button className="flex-1" onClick={() => act("/api/friends/respond", { fromId: u.id, accept: true })}>Confirm</Button>
                <Button variant="secondary" className="flex-1" onClick={() => act("/api/friends/respond", { fromId: u.id, accept: false })}>Delete</Button>
              </>
            }
          />
        ))}
      </div>
      <div className="mt-2 bg-white pb-2">
        <SectionTitle>People you may know</SectionTitle>
        {data?.suggestions.map((u) => (
          <Row
            key={u.id}
            u={u}
            sub={u.mutuals ? `${u.mutuals} mutual friends` : "Lives in Austin, TX"}
            actions={
              <>
                <Button className="flex-1" onClick={() => act("/api/friends/request", { toId: u.id })}>Add friend</Button>
                <Button variant="secondary" className="flex-1">Remove</Button>
              </>
            }
          />
        ))}
      </div>
      <div className="mt-2 bg-white pb-4">
        <SectionTitle>{data ? `${data.friends.length} friends` : "Friends"}</SectionTitle>
        <div className="grid grid-cols-3 gap-2 px-4">
          {data?.friends.map((u) => (
            <Link key={u.id} href={`/profile/${u.id}`} className="overflow-hidden rounded-lg border border-line/60">
              <Avatar src={u.avatar} name={u.name} size={110} className="!block !h-28 !w-full [&>span]:!rounded-none" />
              <div className="truncate px-2 py-1.5 text-[13px] font-semibold">{u.name}</div>
            </Link>
          ))}
        </div>
      </div>
    </Shell>
  );
}

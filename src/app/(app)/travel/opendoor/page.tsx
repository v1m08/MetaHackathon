"use client";
// Open Door inbox: requests where I'm the host (anonymous until I say "see who") and requests my agent made.
import Link from "next/link";
import { DoorOpen } from "lucide-react";
import { Shell, useMe } from "@/components/Shell";
import { RequestCard, type RequestView } from "@/components/travel/Negotiation";
import { Empty } from "@/components/ui";
import { useApi } from "@/lib/api";

export default function OpenDoorPage() {
  const { data: me } = useMe();
  const { data, mutate } = useApi<{ requests: RequestView[] }>("/api/opendoor/requests", { poll: 3000 });
  const reqs = data?.requests ?? [];
  const asHost = reqs.filter((r) => r.role === "host");
  const asTraveler = reqs.filter((r) => r.role === "traveler");
  const update = (r: RequestView) => mutate({ requests: reqs.map((x) => (x.id === r.id ? r : x)) }, false);
  return (
    <Shell back title="Trips · your agent">
      <div className="space-y-3 p-3">
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-fb"><DoorOpen size={18} /><span className="text-[12px] font-semibold uppercase tracking-wide">your agent asks so you don&apos;t have to</span></div>
          <p className="mt-1 text-[14px] text-ink-2">People&apos;s agents negotiate from the policy each person wrote. Nobody&apos;s name is shown until both sides say yes; the host decides last, with full information. <Link href="/travel/setup" className="font-semibold text-fb">Trips settings →</Link></p>
        </section>
        {!data ? <div className="skeleton h-40 rounded-2xl" /> : reqs.length === 0 ? <Empty icon={<DoorOpen size={28} />} title="Nothing yet" body="When a traveler's agent gets a yes from yours, it shows up here anonymously, and you decide. Your own trips' asks show up here too." /> : null}
        {asHost.length > 0 && (
          <section className="space-y-2">
            <h2 className="px-1 text-[13px] font-semibold uppercase tracking-wide text-ink-2">Asked of you</h2>
            {asHost.map((r) => <RequestCard key={r.id} r={r} onChange={update} />)}
          </section>
        )}
        {asTraveler.length > 0 && (
          <section className="space-y-2">
            <h2 className="px-1 text-[13px] font-semibold uppercase tracking-wide text-ink-2">Your agent&apos;s asks</h2>
            {asTraveler.map((r) => <RequestCard key={r.id} r={r} onChange={update} />)}
          </section>
        )}
      </div>
    </Shell>
  );
}

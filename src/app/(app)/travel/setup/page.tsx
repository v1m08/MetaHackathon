"use client";
// Trips intake. Two things, then you're in: (1) your travel style, built from your own posts and editable;
// (2) whether your agent may answer asks for you (Open Door: your words, your tier, your offers). Everything an
// agent does comes back to you for a yes before it counts.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, Check, Compass, ShieldCheck } from "lucide-react";
import { Shell } from "@/components/Shell";
import { OpenDoorEditor } from "@/components/travel/OpenDoor";
import { TravelStyleCard } from "@/components/travel/TravelStyle";
import { Button } from "@/components/ui";
import { api, refresh, useApi } from "@/lib/api";

type Options = { setupDone: boolean; agent: { door: boolean; tier: string; offers: string[]; styleLines: number } };

export default function TripsSetupPage() {
  const router = useRouter();
  const { data: opt } = useApi<Options>("/api/travel/options");
  const done = async () => {
    await api("/api/me/trips-setup", { method: "POST", json: { done: true } });
    refresh("/api/travel/options");
    router.push("/travel");
  };
  return (
    <Shell back title="Trips · setup">
      <div className="space-y-3 p-3">
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-fb"><Compass size={18} /><span className="text-[12px] font-semibold uppercase tracking-wide">where can my people take me?</span></div>
          <h1 className="mt-1 text-[22px] font-bold leading-tight">Two things before your first trip.</h1>
          <p className="mt-1 text-[14px] text-ink-2">Trips finds weekends that only exist because of who you know, and lets an agent do the awkward asking. Both parts run on what you set here, and nothing an agent does is final until you say so.</p>
          <ol className="mt-3 space-y-1.5 text-[13.5px]">
            <li className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-fb text-[11px] font-bold text-white">1</span><span><b className="font-semibold">Your travel style</b>, from your own posts. You see the evidence and keep only what&apos;s true.</span></li>
            <li className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-fb text-[11px] font-bold text-white">2</span><span><b className="font-semibold">Let your agent answer for you</b> (Open Door). Write what you&apos;d offer, in your words. When a friend&apos;s agent asks, yours answers inside those words; you still get the final yes, with the person revealed.</span></li>
          </ol>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-2">1 · travel style</div>
          <TravelStyleCard />
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-ink-2"><Bot size={14} /> 2 · your agent</div>
          <OpenDoorEditor />
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-fb/5 p-3 text-[13px] text-ink">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-fb" />
            <span>Agents only use what you could already see, never send anything without your approval, and never show a name until both sides say yes. The host decides last, with full information; the traveler confirms the plan last.</span>
          </div>
        </section>

        <Button className="w-full py-3 text-[15px]" onClick={done}><Check size={16} /> {opt?.agent.door ? "Done, find my trips" : "Done (agent off for now), find my trips"}</Button>
        <div className="text-center text-[12px] text-ink-2">You can change any of this later from the Trips page. <Link href="/travel" className="font-semibold text-fb">Skip for now</Link></div>
      </div>
    </Shell>
  );
}

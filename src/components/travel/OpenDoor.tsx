"use client";
// Open Door intake (own profile) and the public summary other people see. Policy text is the user's own words; the
// controls are deliberately few. Everything saved here is what the host-side agent will be allowed to act on.
import { useEffect, useState } from "react";
import { Car, DoorOpen, Footprints, BedDouble } from "lucide-react";
import { cx } from "@/components/ui";
import { api, refresh, useApi } from "@/lib/api";
import type { OpenDoor, OpenDoorOffer, OpenDoorTier } from "@/types";

const TIERS: { v: OpenDoorTier; label: string; hint: string }[] = [
  { v: "friends", label: "Friends", hint: "people you're friends with" },
  { v: "fof", label: "Friends of friends", hint: "anyone a friend of yours knows, introduced through them" },
  { v: "network", label: "Broader network", hint: "also people who share a group with you" },
];
const OFFERS: { v: OpenDoorOffer; label: string; icon: typeof BedDouble }[] = [
  { v: "couch", label: "A place to sleep", icon: BedDouble },
  { v: "ride", label: "Seats in my car", icon: Car },
  { v: "show-around", label: "Showing someone around", icon: Footprints },
];
export const offerLabel = (o: OpenDoorOffer) => OFFERS.find((x) => x.v === o)?.label.toLowerCase() ?? o;
export const tierLabel = (t: OpenDoorTier) => TIERS.find((x) => x.v === t)?.label.toLowerCase() ?? t;

export function OpenDoorEditor() {
  const { data, mutate } = useApi<OpenDoor>("/api/me/opendoor");
  const [d, setD] = useState<OpenDoor | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (data && !d) setD(data); }, [data, d]);
  if (!d) return <div className="skeleton h-24 rounded-xl" />;
  const save = async (patch: Partial<OpenDoor>) => {
    const next = { ...d, ...patch };
    setD(next);
    const r = await api<OpenDoor>("/api/me/opendoor", { method: "POST", json: patch });
    setD(r);
    mutate(r, false);
    refresh("/api/me");
    refresh("/api/users");
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  };
  return (
    <div className={cx("rounded-xl p-3", d.on ? "bg-emerald-50" : "bg-[#f0f2f5]")}>
      <label className="flex items-center gap-3">
        <DoorOpen size={20} className={d.on ? "text-emerald-700" : "text-ink-2"} />
        <span className="flex-1"><b className="font-semibold">Open Door</b><div className="text-[13px] text-ink-2">Your agent answers asks for you, within what you write here. Identities stay hidden until you both say yes.</div></span>
        <input type="checkbox" checked={d.on} onChange={(e) => save({ on: e.target.checked })} className="h-5 w-5 accent-fb" />
      </label>
      {d.on && (
        <div className="mt-3 space-y-3">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-wide text-ink-2">In your words</div>
            <textarea value={d.policy} onChange={(e) => setD({ ...d, policy: e.target.value })} onBlur={() => save({ policy: d.policy })} rows={3} placeholder="Couch open for college friends and their friends. Not during finals. One person max. Would love a guest who cooks." className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-[14px] leading-snug outline-none focus:border-fb" />
            <div className="text-[11px] text-ink-2">This is the only thing your agent is allowed to promise. Conditions, exceptions and preferences all go here.</div>
          </div>
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-wide text-ink-2">Open to</div>
            <div className="mt-1 flex gap-1.5">
              {TIERS.map((t) => <button key={t.v} onClick={() => save({ tier: t.v })} title={t.hint} className={cx("rounded-full px-3 py-1 text-[12px] font-semibold", d.tier === t.v ? "bg-fb text-white" : "bg-white text-ink")}>{t.label}</button>)}
            </div>
            <div className="mt-1 text-[11px] text-ink-2">{TIERS.find((t) => t.v === d.tier)?.hint}. Enforced by code: nobody outside this tier can even ask.</div>
          </div>
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-wide text-ink-2">What you offer</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {OFFERS.map((o) => {
                const on = d.offers.includes(o.v);
                return <button key={o.v} onClick={() => save({ offers: on ? d.offers.filter((x) => x !== o.v) : [...d.offers, o.v] })} className={cx("flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-semibold", on ? "bg-emerald-600 text-white" : "bg-white text-ink")}><o.icon size={13} /> {o.label}</button>;
              })}
            </div>
          </div>
          {d.offers.includes("couch") && (
            <label className="flex items-center gap-2 text-[13px]">Up to
              <select value={d.maxGuests} onChange={(e) => save({ maxGuests: Number(e.target.value) })} className="rounded-lg border border-line bg-white px-2 py-1">{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}</select>
              guest{d.maxGuests === 1 ? "" : "s"} at a time
            </label>
          )}
          <div className="text-[11px] text-ink-2">{saved ? "Saved." : "Saves as you go."}</div>
        </div>
      )}
    </div>
  );
}

/** What someone else sees on a profile: that the door exists, to whom, for what. Never the full policy. */
export function OpenDoorBadge({ d, name }: { d?: OpenDoor; name: string }) {
  if (!d?.on || !d.offers.length) return null;
  return (
    <div className="flex items-start gap-3">
      <DoorOpen size={20} className="mt-0.5 text-emerald-600" />
      <span className="text-[14px] leading-snug"><b className="font-semibold text-emerald-700">Open Door</b> <span className="text-ink-2">· {d.offers.map(offerLabel).join(", ")} · open to {tierLabel(d.tier)}. Ask through your agent; {name.split(" ")[0]}&apos;s agent answers from a policy you can&apos;t read.</span></span>
    </div>
  );
}

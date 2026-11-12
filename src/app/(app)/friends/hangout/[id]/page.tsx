"use client";
// Critter detail: what you two share, keepsakes, last real chat, and "Let this one rest".
import Link from "next/link";
import { useParams } from "next/navigation";
import { MessageCircle, Moon, Sun } from "lucide-react";
import { Critter, PIN_EMOJI } from "@/components/hangout/Critter";
import { ago, monthYear, prettyDate, rhythm } from "@/components/hangout/format";
import { HangPage, STATE_CHIP } from "@/components/hangout/HangPage";
import { Avatar, Button, Photo, cx } from "@/components/ui";
import { api, refresh, useApi } from "@/lib/api";
import { CRITTER_STATE_LABEL, keepsakeLabel } from "@/lib/hangout/parts";
import type { FriendView } from "@/server/hangout/views";

function stateLine(f: FriendView) {
  switch (f.state) {
    case "egg":
      return `${f.first}'s egg hatches after your first real chat.`;
    case "hatching":
      return `${f.first}'s egg is hatching!`;
    case "resting":
      return `${f.first}'s critter is resting in the hammock. No nudges, no changes.`;
    case "celebrating":
      return `You two just hung out. ${f.first}'s critter is celebrating!`;
    case "napping":
      return `${f.first}'s critter is napping.`;
    case "sleepy":
      return `${f.first}'s critter is a little sleepy.`;
    default:
      return `${f.first}'s critter is wide awake.`;
  }
}

export default function CritterDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: f, mutate } = useApi<FriendView>(`/api/hangout/friends/${id}`, { poll: 3000 });
  const label = CRITTER_STATE_LABEL;

  const rest = async (resting: boolean) => {
    await mutate(await api<FriendView>(`/api/hangout/friends/${id}`, { method: "POST", json: { resting } }), { revalidate: false });
    refresh("/api/hangout");
  };

  if (!f) return <HangPage title=""><div className="skeleton m-3 h-72 rounded-3xl" /></HangPage>;
  const isEgg = f.state === "egg";
  return (
    <HangPage title={f.first}>
      <section className="relative mx-3 mt-3 overflow-hidden rounded-3xl px-4 pt-4 pb-5 text-center shadow-sm" style={{ background: "linear-gradient(#FFF3E2, #FFFaF3)" }}>
        <div className="flex items-center justify-center gap-2">
          <Avatar src={f.avatar} name={f.name} size={30} />
          <span className="text-[17px] font-bold">{f.name}</span>
        </div>
        <div className="mt-1 flex justify-center">
          <Critter design={f.design} state={f.state} size={176} label={`${f.first}'s critter`} />
        </div>
        <span className={cx("inline-block rounded-full px-2.5 py-0.5 text-[12px] font-semibold", STATE_CHIP[f.state])}>{label[f.state]}</span>
        <p className="mt-2 text-[16px] font-semibold">{stateLine(f)}</p>
        {f.why && !isEgg && <p className="mt-1 text-[13px] text-ink-2">{f.why}</p>}
      </section>

      <div className="mx-3 mt-3 rounded-2xl bg-white p-4 shadow-sm">
        {f.lastChat ? (
          <>
            <div className="text-[13px] font-semibold text-ink-2 uppercase">Last real chat · {ago(f.lastChat.daysAgo)}</div>
            <p className="mt-1 text-[15px]">
              <b>{f.lastChat.sender}:</b> “{f.lastChat.text}”
            </p>
            <p className="mt-0.5 text-[13px] text-ink-2">{prettyDate(f.lastChat.date)} · you two usually talk {rhythm(f.rhythmDays)}</p>
          </>
        ) : (
          <p className="text-[15px] text-ink-2">{isEgg ? `You and ${f.first} both picked each other at run club. Say hi to start.` : "No real chat yet."}</p>
        )}
        <div className="mt-3 flex gap-2">
          <Link href={`/friends/hangout/chat/${f.friendId}`} className="flex-1">
            <Button className="w-full whitespace-nowrap"><MessageCircle size={17} /> {isEgg ? `Say hi to ${f.first}` : "Message"}</Button>
          </Link>
          {!isEgg &&
            (f.isResting ? (
              <Button variant="secondary" className="flex-1 whitespace-nowrap" onClick={() => rest(false)}><Sun size={16} /> Bring back</Button>
            ) : (
              <Button variant="secondary" className="flex-1 whitespace-nowrap" onClick={() => rest(true)}><Moon size={16} /> Let this one rest</Button>
            ))}
        </div>
        {f.isResting && <p className="mt-2 text-[12px] text-ink-2">Resting friends stay in the hammock. Muse won&apos;t suggest anything about them.</p>}
      </div>

      {f.sharedPlaces.length > 0 && (
        <div className="mx-3 mt-3 rounded-2xl bg-white py-3 shadow-sm">
          <h2 className="px-4 text-[17px] font-bold">Places you share</h2>
          {f.sharedPlaces.map((p) => (
            <div key={p.name} className="mt-2">
              <div className="flex items-baseline justify-between px-4">
                <span className="text-[15px] font-semibold">{p.name}</span>
                <span className="text-[13px] text-ink-2">
                  {p.count === 1 ? `once · ${monthYear(p.firstDate)}` : `${p.count} times · ${monthYear(p.firstDate)} – ${monthYear(p.lastDate)}`}
                </span>
              </div>
              <div className="no-scrollbar mt-1.5 flex gap-1.5 overflow-x-auto px-4">
                {p.photos.map((ph) => (
                  <Photo key={ph.id} src={ph.imagePath} alt={`${p.name}, ${ph.date}`} className="h-20 w-20 shrink-0 rounded-lg object-cover" />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {f.insideJokes.length > 0 && (
        <div className="mx-3 mt-3 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-[17px] font-bold">Inside jokes</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {f.insideJokes.map((j) => (
              <span key={j.phrase} className="rounded-full bg-[#f0f2f5] px-3 py-1.5 text-[14px]">“{j.phrase}” <span className="text-ink-2">· {j.sources}</span></span>
            ))}
          </div>
        </div>
      )}

      <div className="mx-3 mt-3 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-[17px] font-bold">Keepsakes</h2>
        {f.design.keepsakes.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {f.design.keepsakes.map((k) => (
              <span key={k} className="flex items-center gap-1.5 rounded-full border border-line/60 px-3 py-1.5 text-[14px]">
                <span className="text-[18px]">{PIN_EMOJI[k]}</span> {keepsakeLabel(k)}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-[14px] text-ink-2">Meet up in real life to earn pins for {f.first}&apos;s critter.</p>
        )}
      </div>

      <p className="px-6 pt-3 pb-6 text-center text-[12px] leading-snug text-ink-2">
        Muse built this from photos you&apos;re both tagged in, events you both went to and chats you opted in. Only you can see it.
        {f.memorySource !== "live" && " (Prototype: built from seeded mock data.)"}
      </p>
    </HangPage>
  );
}

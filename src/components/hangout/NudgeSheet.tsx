"use client";
// The nudge: why now, the old photo, one action. The user always writes their own message; nothing is auto-sent.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarHeart, ChevronDown, MessageCircle, Moon, Send } from "lucide-react";
import { Avatar, Button, Photo, Sheet, cx } from "@/components/ui";
import { api, refresh, useApi } from "@/lib/api";
import type { NudgeView } from "@/server/hangout/views";
import { prettyDate } from "./format";

const ACTION = {
  send_photo: { label: (f: string) => `Send ${f} this photo`, icon: Send },
  say_hi: { label: (f: string) => `Say hi to ${f}`, icon: MessageCircle },
  suggest_plan: { label: (f: string) => `Make a plan with ${f}`, icon: CalendarHeart },
} as const;

export function NudgeSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const router = useRouter();
  const { data: n } = useApi<NudgeView>(id ? `/api/hangout/nudges/${id}` : null);
  const [why, setWhy] = useState(false);
  const [busy, setBusy] = useState(false);

  const setStatus = async (status: "dismissed" | "rested") => {
    if (!n) return;
    setBusy(true);
    await api(`/api/hangout/nudges/${n.id}`, { method: "POST", json: { status } });
    await refresh("/api/hangout");
    setBusy(false);
    onClose();
  };
  const act = () => {
    if (!n) return;
    const q = new URLSearchParams({ nudge: n.id });
    if (n.action === "send_photo" && n.photoId) q.set("photo", n.photoId);
    if (n.action === "suggest_plan") q.set("plan", "1");
    router.push(`/friends/hangout/chat/${n.friend.id}?${q}`);
  };

  const A = n ? ACTION[n.action] : null;
  return (
    <Sheet open={!!id} onClose={onClose} title="From Muse">
      {!n ? (
        <div className="space-y-3 p-4">
          <div className="skeleton h-10 rounded-lg" />
          <div className="skeleton h-6 rounded" />
          <div className="skeleton h-52 rounded-xl" />
        </div>
      ) : (
        <div className="px-4 pt-3 pb-5">
          {n.trigger && (
            <div className="flex items-center gap-3 rounded-xl bg-[#f0f2f5] p-2.5">
              <Avatar src={n.friend.avatar} name={n.friend.name} size={36} />
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold">{n.headline}</div>
                <div className="truncate text-[13px] text-ink-2">{n.trigger.text}</div>
              </div>
              {n.trigger.imagePath && <Photo src={n.trigger.imagePath} className="h-11 w-11 rounded-lg object-cover" />}
            </div>
          )}

          <p className="mt-4 text-[19px] leading-snug font-semibold">{n.reason}</p>

          {n.photo && (
            <figure className="mt-3 overflow-hidden rounded-2xl border border-line/60">
              <Photo src={n.photo.imagePath} alt={n.photo.place} className="aspect-[4/3] w-full object-cover" />
              <figcaption className="px-3 py-2 text-[13px] text-ink-2">
                You & {n.friend.first} · {n.photo.place} · {prettyDate(n.photo.date)}
              </figcaption>
            </figure>
          )}

          {A && (
            <Button className="mt-4 w-full py-2.5" onClick={act}>
              <A.icon size={18} /> {A.label(n.friend.first)}
            </Button>
          )}
          <div className="mt-2 flex gap-2">
            <Button variant="secondary" className="flex-1" disabled={busy} onClick={() => setStatus("dismissed")}>Not now</Button>
            <Button variant="secondary" className="flex-1" disabled={busy} onClick={() => setStatus("rested")}>
              <Moon size={16} /> Let this one rest
            </Button>
          </div>
          <p className="mt-2 text-center text-[12px] text-ink-2">You write your own message. Nothing gets sent for you.</p>

          <button onClick={() => setWhy((w) => !w)} className="mt-3 flex w-full items-center justify-between rounded-xl px-1 py-2 text-[15px] font-semibold">
            Why this?
            <ChevronDown size={18} className={cx("transition", why && "rotate-180")} />
          </button>
          {why && (
            <div className="fadein rounded-xl bg-[#f7f8fa] p-3">
              <p className="text-[13px] text-ink-2">
                Muse connected {n.triggerLabel} to {n.evidence.length} thing{n.evidence.length === 1 ? "" : "s"} you two share:
              </p>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {n.evidence.filter((e) => e.kind === "photo").map((e) => (
                  <div key={e.id} className="overflow-hidden rounded-lg bg-white">
                    <Photo src={e.imagePath!} className="aspect-square w-full object-cover" />
                    <div className="truncate px-1.5 py-1 text-[11px] text-ink-2">{prettyDate(e.date, true)}</div>
                  </div>
                ))}
              </div>
              <div className="mt-2 space-y-1.5">
                {n.evidence.filter((e) => e.kind !== "photo").map((e) => (
                  <div key={e.id} className="rounded-lg bg-white px-2.5 py-2 text-[13px]">
                    <span className="font-semibold">{e.title}</span>
                    {e.text && <span className="text-ink">: {e.kind === "chat" ? `“${e.text}”` : e.text}</span>}
                    <span className="ml-1 text-ink-2">· {prettyDate(e.date, true)}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[12px] leading-snug text-ink-2">
                Muse only uses photos you&apos;re both tagged in, events you both went to and chats you opted in. It never guesses how anyone feels. Model: Muse Wonder.
              </p>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

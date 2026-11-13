"use client";
// Muse's plan for you, at the top of the Friends tab: after your group plays, Muse picks a real-world plan that fits
// the group and writes each person their own note (src/server/demo.ts). Renders nothing until there is one.
import Link from "next/link";
import { Photo } from "@/components/ui";
import { useApi } from "@/lib/api";
import { eventDate } from "@/lib/format";
import { museAvatarFor } from "@/lib/museAvatar";

type Note = { id: string; text: string; createdAt: string; event: { id: string; title: string; cover: string; startsAt: string; location: string; price?: string } | null };

export function MuseNote() {
  const { data } = useApi<{ note: Note | null }>("/api/demo/muse", { poll: 4000 });
  const note = data?.note;
  if (!note) return null;
  return (
    <div className="px-3 pt-3">
      <div className="overflow-hidden rounded-2xl bg-white shadow-[0_4px_18px_rgba(123,97,255,0.25)] ring-2 ring-[#b8a9ff]">
        <div className="flex items-start gap-3 px-3.5 pt-3.5" style={{ background: "linear-gradient(180deg, #f3efff, #fff)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={museAvatarFor("muse")} alt="" className="h-11 w-11 flex-none rounded-full" />
          <div className="min-w-0 flex-1 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-bold">Muse</span>
            </div>
            <p className="mt-0.5 text-[15px] leading-snug text-ink">{note.text}</p>
          </div>
        </div>
        {note.event && (
          <Link href={`/events/${note.event.id}`} className="flex items-center gap-3 border-t border-line/60 p-3 active:bg-hover">
            <Photo src={note.event.cover} className="h-16 w-16 flex-none rounded-xl object-cover" />
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold uppercase text-[#e41e3f]">{eventDate(note.event.startsAt)}</div>
              <div className="truncate text-[15px] font-semibold">{note.event.title}</div>
              <div className="truncate text-[13px] text-ink-2">{note.event.location}{note.event.price ? ` · ${note.event.price}` : ""}</div>
            </div>
            <span className="flex-none rounded-full bg-[#7B61FF] px-3 py-1.5 text-[13px] font-bold text-white">See plan</span>
          </Link>
        )}
      </div>
    </div>
  );
}

"use client";
// The daily game as a card in the thread. Polls the viewer's own view of the game, so "3 of 8 played" moves live
// across windows. The server decides what this viewer may see; a viewer outside the chat gets nothing.
import { useState } from "react";
import { Dices } from "lucide-react";
import { useApi } from "@/lib/api";
import type { GameView } from "@/lib/play/views";
import { GameSheet } from "./GameSheet";
import { Faces, ModeTag } from "./shared";
import { dayKey } from "@/lib/play/day";

export function GameChip({ id, onChanged }: { id: string; onChanged?: () => void }) {
  const { data: g, error } = useApi<GameView>(`/api/play/games/${id}`, { poll: 3000 });
  const [open, setOpen] = useState(false);
  if (!g) return error ? null : <div className="my-3 flex justify-center"><div className="h-36 w-[290px] animate-pulse rounded-2xl bg-[#f0f2f5]" /></div>;
  const started = Object.keys(g.mine).length > 0;
  const when = g.date === dayKey() ? "Today's game" : new Date(`${g.date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return (
    <div className="my-3 flex justify-center">
      <div className="w-[290px] overflow-hidden rounded-2xl border border-line/60 bg-white text-left text-ink">
        <div className="flex items-center gap-1.5 bg-[#e7f0fd] px-3 py-1.5 text-[11.5px] font-semibold text-[#0b5ed7]">
          <Dices size={13} /> <span className="truncate">{when} · {g.formatLabel} · {g.topicLabel}</span>
          <ModeTag mode={g.mode} className="ml-auto shrink-0" />
        </div>
        <div className="px-3 pt-2 text-[15px] font-bold leading-tight">{g.title}</div>
        {g.premise && <div className="px-3 pt-0.5 text-[12.5px] leading-snug text-ink-2">{g.premise}</div>}
        {g.iAmSubject && !g.done && <div className="px-3 pt-1 text-[12.5px] font-semibold text-amber-800">You&apos;re in the hot seat today</div>}
        <div className="flex items-center gap-2 px-3 py-2">
          <Faces people={g.players} size={20} max={4} />
          <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-2">{g.players.length ? `${g.players.length} of ${g.memberCount} played` : "Be the first to play"}</span>
          <button onClick={() => setOpen(true)} className={g.done ? "shrink-0 rounded-lg bg-[#e4e6eb] px-3 py-1.5 text-[13px] font-semibold" : "shrink-0 rounded-lg bg-messenger px-4 py-1.5 text-[13px] font-semibold text-white"}>
            {g.done ? "See results" : started ? "Continue" : "Play"}
          </button>
        </div>
      </div>
      <GameSheet id={id} open={open} onClose={() => setOpen(false)} onChanged={onChanged} />
    </div>
  );
}

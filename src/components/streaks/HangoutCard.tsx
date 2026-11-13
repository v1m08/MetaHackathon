"use client";
// Option 1 inline Cozy Room pinned at the top of Chats: zero extra pages, minimal text, 1 tap straight into chat.
import { useRouter } from "next/navigation";
import { Critter } from "@/components/hangout/Critter";
import { MuseHost } from "@/components/hangout/MuseHost";
import { Count } from "@/components/streaks/ui";
import { api, useApi } from "@/lib/api";
import { endsLabel, needsYou, STATUS } from "@/lib/streaks/copy";
import type { StreakCard, StreaksView } from "@/lib/streaks/views";

function useOpenFriend() {
  const router = useRouter();
  return async (c: StreakCard) => {
    const autoTray = c.status === "new" || c.status === "lost" || c.status === "atRisk";
    const qs = autoTray ? "?play=1" : "";
    if (c.conversationId) return router.push(`/messages/${c.conversationId}${qs}`);
    const dm = await api<{ id: string }>(`/api/conversations/with/${c.friendId}`, { method: "POST" });
    router.push(`/messages/${dm.id}${qs}`);
  };
}

export function HangoutCard() {
  const { data: v } = useApi<StreaksView>("/api/streaks", { poll: 4000 });
  const openFriend = useOpenFriend();
  const friends = v?.friends ?? [];
  const room = friends.filter((c) => c.status !== "new" && c.status !== "lost");
  const eggs = friends.filter((c) => c.status === "new");
  const napping = friends.filter((c) => c.status === "lost");
  const waiting = v ? needsYou(friends).length : 0;

  return (
    <section
      className="relative mx-3 mt-1 overflow-hidden rounded-3xl px-3 pt-2.5 pb-2.5 shadow-sm ring-1 ring-[#efd9bd]/60"
      style={{ background: "linear-gradient(#FFF4E4 0 64%, #F3D9BA 64%)" }}
    >
      {/* Cozy window */}
      <div className="pointer-events-none absolute top-2.5 right-3 h-9 w-12 overflow-hidden rounded-md border-[3px] border-white bg-gradient-to-b from-[#9fd3ff] to-[#dff0ff] shadow-xs" aria-hidden>
        <div className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-white" />
        <div className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-white" />
      </div>

      {/* Floor rug */}
      <div className="pointer-events-none absolute bottom-[64px] left-1/2 h-12 w-[88%] -translate-x-1/2 rounded-[50%] bg-[#F4B996]/40" aria-hidden />

      {/* Minimal 1-line header */}
      <div className="relative flex items-center gap-2 pr-14">
        <MuseHost size={26} image={v?.host.image} />
        <span className="whitespace-nowrap text-[15px] font-bold tracking-tight text-ink">Your Hangout</span>
        {!!waiting && (
          <span className="whitespace-nowrap rounded-full bg-messenger px-2 py-0.5 text-[11px] font-semibold text-white">
            {waiting} need{waiting === 1 ? "s" : ""} you
          </span>
        )}
      </div>

      {/* Single-row active critters */}
      <div className="relative mt-1 grid grid-cols-5 gap-1">
        {room.map((c) => (
          <button
            key={c.friendId}
            type="button"
            onClick={() => void openFriend(c)}
            className="flex flex-col items-center rounded-xl py-0.5 active:scale-95 transition-transform"
            title={`${c.first} · ${STATUS[c.status].label}`}
          >
            <div className="relative">
              <Critter design={c.design} state={c.state} size={58} showKeepsakes={false} label={`${c.first}'s critter`} />
              {c.status === "yourTurn" && (
                <span className="absolute top-1 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#FFF4E4] bg-messenger" />
              )}
            </div>
            <span className="-mt-1 max-w-full truncate text-[12px] font-semibold leading-tight">{c.first}</span>
            <Count c={c} className="mt-0.5 !px-1.5 !text-[10.5px]" />
          </button>
        ))}
        {!v && Array.from({ length: 5 }, (_, i) => <div key={i} className="skeleton mx-auto my-2 h-16 w-12 rounded-xl" />)}
      </div>

      {/* Compact bottom shelf: Egg Nest + Hammock */}
      {(eggs.length > 0 || napping.length > 0) && (
        <div className="relative mt-1.5 flex items-end justify-between px-1">
          {eggs.length > 0 ? (
            <div className="flex items-center gap-1.5">
              <div className="relative flex h-[52px] w-[72px] items-end justify-center">
                <svg viewBox="0 0 100 30" className="pointer-events-none absolute bottom-0 w-[72px]" aria-hidden>
                  <ellipse cx={50} cy={18} rx={46} ry={10} fill="#B98552" />
                  <path d="M10 16 Q32 8 54 15 T92 14" stroke="#8A5E35" strokeWidth={2} fill="none" />
                </svg>
                {eggs.map((c) => (
                  <button
                    key={c.friendId}
                    type="button"
                    onClick={() => void openFriend(c)}
                    className="relative -mb-0.5 active:scale-95 transition-transform"
                    title={`Tap to hatch a streak with ${c.first}`}
                  >
                    <Critter design={c.design} state="egg" size={46} label={`${c.first}'s egg`} />
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => void openFriend(eggs[0])} className="text-left leading-tight">
                <span className="block text-[11.5px] font-bold text-[#5E422B]">{eggs.map((c) => c.first).join(", ")}</span>
                <span className="block text-[10.5px] font-medium text-[#8A684C]">Tap to hatch</span>
              </button>
            </div>
          ) : (
            <div />
          )}

          {napping.length > 0 && (
            <button
              type="button"
              onClick={() => void openFriend(napping[0])}
              className="flex items-center gap-1.5 active:scale-95 transition-transform"
              title={`Tap to restart streak with ${napping[0].first}`}
            >
              <div className="text-right leading-tight">
                <span className="block text-[11.5px] font-bold text-[#5E422B]">{napping.map((c) => c.first).join(", ")}</span>
                <span className="block text-[10.5px] font-medium text-[#8A684C]">Napping · Wake</span>
              </div>
              <div className="relative h-[54px] w-[88px]">
                <svg viewBox="0 0 120 76" className="pointer-events-none absolute inset-0" aria-hidden>
                  <rect x={4} y={10} width={5} height={62} rx={2.5} fill="#A47148" />
                  <rect x={111} y={10} width={5} height={62} rx={2.5} fill="#A47148" />
                  <path d="M9 18 L20 26 M111 18 L100 26" stroke="#C8A27A" strokeWidth={2} />
                  <path d="M20 26 Q60 66 100 26" stroke="#5BC0EB" strokeWidth={10} fill="none" strokeLinecap="round" />
                  <path d="M20 26 Q60 66 100 26" stroke="#fff" strokeWidth={3} fill="none" strokeDasharray="6 6" opacity={0.7} />
                </svg>
                <div className="absolute inset-x-0 top-[2px] flex justify-center">
                  {napping.map((c) => (
                    <Critter key={c.friendId} design={c.design} state="resting" size={44} showKeepsakes={false} label={`${c.first} napping`} />
                  ))}
                </div>
              </div>
            </button>
          )}
        </div>
      )}
    </section>
  );
}

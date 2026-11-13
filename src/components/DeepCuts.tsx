"use client";
// Deep Cuts inside Messenger: a game card in the thread (live pixel cover), a full-screen player, and the
// games tray behind the composer's "+" button. The game itself runs on the Sidequest server (port 5180).
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { SceneView } from "../../sidequest/client/src/rarity/scene";
import { fmt, withScene, type PublicPack } from "../../sidequest/shared/rarity";

export const sqUrl = () => process.env.NEXT_PUBLIC_SIDEQUEST_URL || (typeof window === "undefined" ? "" : `${location.protocol}//${location.hostname}:5180`);
/** Messenger user → Sidequest player id (6-32 lowercase alphanumerics). */
export const sqPid = (userId: string) => `fbu${userId.toLowerCase().replace(/[^a-z0-9]/g, "")}`.padEnd(6, "0").slice(0, 32);

interface RoomInfo {
  id: string;
  pack: PublicPack;
  me: { done: number; finished: boolean; score: number } | null;
  board: { name: string; score: number; answered: number; me: boolean }[];
}
const meter = (p: PublicPack, points: number) => `${fmt(points * p.meter.perPoint)}${p.meter.unit}`;

function useRoom(roomId: string, userId: string) {
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`${sqUrl()}/api/x/${roomId}?me=${sqPid(userId)}`, { cache: "no-store" });
        if (r.status === 404) return alive && setMissing(true);
        const data = (await r.json()) as RoomInfo;
        if (alive) setRoom({ ...data, pack: withScene(data.pack) });
      } catch {
        /* game server down: keep the last state */
      }
    };
    void load();
    const t = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [roomId, userId]);
  return { room, missing };
}

/** Animated pixel world, used as the card's cover art. */
function Cover({ pack }: { pack: PublicPack }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const s = new SceneView(ref.current, pack, { gauge: false, px: 3 });
    s.setProgress(0, true);
    return () => s.destroy();
  }, [pack]);
  return <div ref={ref} className="absolute inset-0 overflow-hidden" aria-hidden="true" />;
}

const PIXEL = { fontFamily: '"Pixelify Sans", system-ui, sans-serif' };
const LABEL = { fontFamily: '"Silkscreen", "Pixelify Sans", monospace' };

export function GameCard({ roomId, userId, onOpen }: { roomId: string; userId: string; onOpen: (id: string) => void }) {
  const { room, missing } = useRoom(roomId, userId);
  if (missing) return <div className="rounded-2xl bg-[#f0f0f0] px-3 py-2 text-[13px] text-ink-2">This game has ended.</div>;
  const p = room?.pack;
  const leader = room?.board[0];
  const status = !room
    ? "Loading…"
    : room.me?.finished
      ? `You reached ${meter(room.pack, room.me.score)}${leader && !leader.me ? ` · ${leader.name} leads` : leader?.me && room.board.length > 1 ? " · you lead" : ""}`
      : leader
        ? `${leader.me ? "You lead" : `${leader.name} leads`} with ${meter(room.pack, leader.score)}`
        : "Be the first to play";
  const cta = room?.me?.finished ? "View" : room?.me?.done ? "Resume" : "Play";
  return (
    <button
      onClick={() => onOpen(roomId)}
      className="mb-1 block w-[248px] overflow-hidden rounded-[18px] text-left shadow-[0_1px_2px_rgba(0,0,0,0.15)] active:scale-[0.98] transition-transform"
      style={{ background: "#11131b" }}
      aria-label={`Open game ${p?.title ?? ""}`}
    >
      <div className="relative h-[156px]" style={{ background: p?.scene.start[1] ?? "#2a3142" }}>
        {p && <Cover pack={p} />}
        <div className="absolute inset-0 flex flex-col items-center justify-center px-3 text-center" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.35))" }}>
          {p && (
            <>
              <div className="text-[26px] leading-none" style={{ filter: "drop-shadow(2px 2px 0 rgba(0,0,0,.35))" }}>{p.host.emoji}</div>
              <div className="mt-1 text-[24px] font-bold leading-[0.95] text-white" style={{ ...PIXEL, textShadow: `2px 2px 0 ${p.palette.primary}, 4px 4px 0 rgba(0,0,0,.5)` }}>
                {p.title}
              </div>
            </>
          )}
        </div>
        <div className="absolute left-2 top-2 px-1.5 py-0.5 text-[9px] tracking-[0.14em] text-white" style={{ ...LABEL, background: "rgba(10,12,20,.75)" }}>
          DEEP CUTS
        </div>
      </div>
      <div className="flex items-center gap-2 px-3 py-2.5 text-white">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold leading-tight" style={PIXEL}>{status}</div>
          <div className="mt-0.5 truncate text-[10px] tracking-[0.08em] text-[#a9b0c4]" style={LABEL}>
            {p ? `${p.interest} · ${room!.board.length} played` : ""}
          </div>
        </div>
        <span className="px-2.5 py-1.5 text-[11px] font-bold tracking-[0.12em]" style={{ ...LABEL, background: p?.palette.primary ?? "#ffb020", color: "#111" }}>
          {cta.toUpperCase()}
        </span>
      </div>
    </button>
  );
}

export interface Finished {
  room: string;
  score: number;
  reached: string;
  icon: string;
  title: string;
  rank: number;
  players: number;
}

export function GamePlayer({ roomId, userId, name, onClose, onFinished }: { roomId: string; userId: string; name: string; onClose: () => void; onFinished: (f: Finished) => void }) {
  const src = `${sqUrl()}/x/${roomId}?embed=1&pid=${sqPid(userId)}&name=${encodeURIComponent(name)}`;
  useEffect(() => {
    const on = (e: MessageEvent) => {
      const d = e.data as { source?: string; type?: string } & Partial<Finished>;
      if (d?.source !== "deepcuts") return;
      if (d.type === "close") onClose();
      if (d.type === "finished") onFinished(d as Finished);
    };
    addEventListener("message", on);
    return () => removeEventListener("message", on);
  }, [onClose, onFinished]);
  return (
    <div className="fixed inset-0 z-[60] bg-black">
      <iframe src={src} title="Deep Cuts" allow="autoplay; clipboard-write" className="h-full w-full border-0" />
    </div>
  );
}

const SUGGESTIONS = ["Rock climbing", "F1", "Sourdough", "Scuba diving", "Dinosaurs", "Taylor Swift", "Coffee", "Space"];

export function GameTray({ onCreate, onClose }: { onCreate: (roomId: string, interest: string) => void; onClose: () => void }) {
  const [topic, setTopic] = useState("");
  const [ready, setReady] = useState<{ interest: string; title: string; emoji: string }[]>([]);
  const [building, setBuilding] = useState<string | null>(null);
  const [secs, setSecs] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch(`${sqUrl()}/api/x/topics`)
      .then((r) => r.json())
      .then(setReady)
      .catch(() => setError("Game server isn't running. Start it with: npm run sidequest"));
  }, []);
  useEffect(() => {
    if (!building) return;
    const t0 = Date.now();
    const t = setInterval(() => setSecs(Math.floor((Date.now() - t0) / 1000)), 500);
    return () => clearInterval(t);
  }, [building]);

  async function create(interest: string) {
    const i = interest.trim();
    if (!i || building) return;
    setBuilding(i);
    setError("");
    try {
      const r = await fetch(`${sqUrl()}/api/x/new`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ interest: i }) });
      const d = (await r.json()) as { id?: string; error?: string };
      if (!r.ok || !d.id) throw new Error(d.error ?? "Couldn't make that game");
      onCreate(d.id, i);
    } catch (e) {
      setError((e as Error).message);
      setBuilding(null);
    }
  }
  const readySet = new Set(ready.map((r) => r.interest.toLowerCase()));
  const chips = [...ready.map((r) => r.interest), ...SUGGESTIONS.filter((s) => !readySet.has(s.toLowerCase()))].slice(0, 10);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/40" onClick={onClose}>
      <div className="rounded-t-[22px] px-4 pb-6 pt-3 text-white" style={{ background: "#11131b" }} onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/25" />
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[22px] font-bold leading-none" style={{ ...PIXEL, textShadow: "2px 2px 0 #ff5d8f" }}>Deep Cuts</div>
            <div className="mt-1 text-[10px] tracking-[0.12em] text-[#a9b0c4]" style={LABEL}>NAME THE ANSWER NOBODY ELSE THINKS OF</div>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-white/70" aria-label="Close"><X size={20} /></button>
        </div>
        {building ? (
          <div className="py-8 text-center" style={PIXEL}>
            <div className="text-[20px] font-bold">Building {building}…</div>
            <div className="mt-2 text-[12px] tracking-[0.1em] text-[#a9b0c4]" style={LABEL}>
              {readySet.has(building.toLowerCase()) ? "ALMOST READY" : `${secs}S · NEW TOPICS TAKE ABOUT A MINUTE`}
            </div>
          </div>
        ) : (
          <>
            <form
              className="mt-4 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void create(topic);
              }}
            >
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                maxLength={60}
                placeholder="Pick a topic for the chat"
                className="min-w-0 flex-1 rounded-[10px] bg-black/50 px-3 py-3 text-[17px] text-white outline-none ring-2 ring-[#6ee7b7]/60 placeholder:text-white/35 focus:ring-[#6ee7b7]"
                style={PIXEL}
                autoFocus
              />
              <button type="submit" className="rounded-[10px] px-4 text-[12px] font-bold tracking-[0.12em] text-[#111]" style={{ ...LABEL, background: "#ffb020" }}>
                SEND
              </button>
            </form>
            <div className="mt-3 flex flex-wrap gap-2">
              {chips.map((c) => (
                <button key={c} onClick={() => create(c)} className="rounded-[8px] bg-white/10 px-2.5 py-1.5 text-[11px] tracking-[0.08em]" style={LABEL}>
                  {readySet.has(c.toLowerCase()) ? "⚡ " : ""}
                  {c.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="mt-2 text-[10px] tracking-[0.08em] text-[#a9b0c4]" style={LABEL}>⚡ READY INSTANTLY</div>
          </>
        )}
        {error && <div className="mt-3 text-[14px] text-[#ffb0a8]" style={PIXEL}>{error}</div>}
      </div>
    </div>
  );
}

"use client";
// Deep Cuts inside Messenger: a game card in the thread (live pixel cover), a full-screen player, and the
// games tray behind the composer's "+" button. The game itself runs on the Sidequest server (port 5180).
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { SceneView } from "../../sidequest/client/src/rarity/scene";
import { fmt, withScene, type PublicPack } from "../../sidequest/shared/rarity";
import type { Menu } from "../../sidequest/shared/kitchen";

/** A chat game reference: "<roomId>" is Deep Cuts, "k:<roomId>" is Order Up!. */
export type GameKind = "deepcuts" | "orderup";
export const kindOf = (ref: string): GameKind => (ref.startsWith("k:") ? "orderup" : "deepcuts");
const idOf = (ref: string) => ref.replace(/^k:/, "");

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


export function GameCard({ roomId, userId, onOpen }: { roomId: string; userId: string; onOpen: (ref: string) => void }) {
  return kindOf(roomId) === "orderup" ? <KitchenCard gameRef={roomId} userId={userId} onOpen={onOpen} /> : <DeepCutsCard roomId={roomId} userId={userId} onOpen={onOpen} />;
}

function DeepCutsCard({ roomId, userId, onOpen }: { roomId: string; userId: string; onOpen: (ref: string) => void }) {
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
              <div className="mt-1 text-[22px] font-extrabold leading-[1.05] tracking-[-0.01em] text-white" style={{ textShadow: `0 2px 0 ${p.palette.primary}, 0 3px 10px rgba(0,0,0,.55)` }}>
                {p.title}
              </div>
            </>
          )}
        </div>
        <div className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ background: "rgba(10,12,20,.6)", backdropFilter: "blur(4px)" }}>
          Deep Cuts
        </div>
      </div>
      <div className="flex items-center gap-2 px-3 py-2.5 text-white">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold leading-tight">{status}</div>
          <div className="mt-0.5 truncate text-[12px] text-[#a9b0c4]">
            {p ? `${p.interest} · ${room!.board.length} played` : ""}
          </div>
        </div>
        <span className="rounded-full px-3.5 py-1.5 text-[13px] font-bold" style={{ background: p?.palette.primary ?? "#ffb020", color: "#111" }}>
          {cta}
        </span>
      </div>
    </button>
  );
}

// ---------- Order Up! card ----------
/** The restaurant's storefront in pixel art: back wall, awning, name sign, customers at the counter, the signature dish. */
function KitchenCover({ menu: m, seed }: { menu: Menu; seed: string }) {
  const wall = useRef<HTMLCanvasElement>(null);
  const [art, setArt] = useState<{ people: string[]; dish: string[] } | null>(null);
  useEffect(() => {
    let alive = true;
    void import("../../sidequest/client/src/kitchen/pixel").then(({ drawWall, foodSprite, personSprite }) => {
      if (!alive) return;
      if (wall.current) drawWall(wall.current, m.theme, m.ingredients.map((i) => i.emoji));
      const base = [...seed].reduce((n, ch) => n * 31 + ch.charCodeAt(0), 7) % 997;
      const moods = ["happy", "wait", "happy"] as const;
      const signature = [...m.dishes].sort((a, b) => b.items.length - a.items.length)[0];
      const dish = signature.items.map((id) => m.ingredients.find((i) => i.id === id)?.emoji ?? "🍽️");
      setArt({ people: [0, 1, 2].map((k) => personSprite(base + k * 17, moods[k])), dish: dish.map((e) => foodSprite(e)) });
    });
    return () => {
      alive = false;
    };
  }, [m, seed]);
  const px = { imageRendering: "pixelated" as const };
  return (
    <>
      <canvas ref={wall} className="absolute inset-0 h-full w-full" style={px} aria-hidden="true" />
      {/* awning */}
      <div className="absolute inset-x-0 top-0 h-7" style={{ background: `repeating-linear-gradient(90deg, ${m.theme.primary} 0 16px, #fff8ef 16px 32px)` }} />
      <div className="absolute inset-x-0 top-7 h-2" style={{ background: `radial-gradient(circle at 8px 0, ${m.theme.primary} 7px, transparent 8px) 0 0 / 32px 8px, radial-gradient(circle at 24px 0, #fff8ef 7px, transparent 8px) 0 0 / 32px 8px` }} />
      {/* wooden name sign */}
      <div className="absolute left-1/2 top-[38px] -translate-x-1/2 whitespace-nowrap rounded-md px-3 py-1 text-[16px] font-extrabold text-white" style={{ background: "#5a3a24", border: "3px solid #8a5a3a", boxShadow: "0 3px 0 rgba(0,0,0,.25)", textShadow: "0 1px 0 rgba(0,0,0,.4)", maxWidth: "88%", overflow: "hidden", textOverflow: "ellipsis" }}>
        {m.name}
      </div>
      {/* customers waiting at the counter */}
      {art && (
        <div className="absolute inset-x-0 bottom-[14px] flex items-end justify-between px-4">
          <img src={art.people[0]} alt="" width={40} height={55} style={px} />
          <div className="mb-1 flex items-end gap-0.5 rounded-full px-2 pb-1 pt-0.5" style={{ background: "radial-gradient(ellipse at 50% 60%, #fff 55%, #dcdce2 100%)" }}>
            {art.dish.map((src, k) => (
              <img key={k} src={src} alt="" width={22} height={22} style={px} />
            ))}
          </div>
          <img src={art.people[1]} alt="" width={40} height={55} style={px} />
        </div>
      )}
      {/* counter */}
      <div className="absolute inset-x-0 bottom-0 h-[16px]" style={{ background: `repeating-linear-gradient(90deg, rgba(0,0,0,.14) 0 2px, transparent 2px 30px), linear-gradient(180deg, color-mix(in srgb, ${m.theme.counter} 65%, #fff) 0 4px, ${m.theme.counter} 4px)` }} />
      <div className="absolute left-2 top-[11px] rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ background: "rgba(20,12,8,.65)" }}>
        Order Up!
      </div>
    </>
  );
}
interface KitchenInfo {
  id: string;
  menu: Menu;
  board: { name: string; score: number; me: boolean }[];
  me: { best: number; plays: number } | null;
}
function KitchenCard({ gameRef, userId, onOpen }: { gameRef: string; userId: string; onOpen: (ref: string) => void }) {
  const [room, setRoom] = useState<KitchenInfo | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`${sqUrl()}/api/k/${idOf(gameRef)}?me=${sqPid(userId)}`, { cache: "no-store" });
        if (r.status === 404) return alive && setMissing(true);
        const d = (await r.json()) as KitchenInfo;
        if (alive) setRoom(d);
      } catch {
        /* server down */
      }
    };
    void load();
    const t = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [gameRef, userId]);
  if (missing) return <div className="rounded-2xl bg-[#f0f0f0] px-3 py-2 text-[13px] text-ink-2">This restaurant has closed.</div>;
  const m = room?.menu;
  const leader = room?.board[0];
  const usd = (n: number) => `$${n.toLocaleString("en-US")}`;
  const status = !room ? "Loading…" : room.me ? `Your best: ${usd(room.me.best)}${leader && !leader.me ? ` · ${leader.name} leads` : room.board.length > 1 ? " · you lead" : ""}` : leader ? `${leader.name} leads with ${usd(leader.score)}` : "Be the first to open";
  return (
    <button
      onClick={() => onOpen(gameRef)}
      className="mb-1 block w-[248px] overflow-hidden rounded-[18px] text-left shadow-[0_1px_2px_rgba(0,0,0,0.15)] transition-transform active:scale-[0.98]"
      style={{ background: "#1c140f" }}
      aria-label={`Open restaurant ${m?.name ?? ""}`}
    >
      <div className="relative h-[156px] overflow-hidden" style={{ background: m ? `linear-gradient(180deg, ${m.theme.wall}, ${m.theme.wall2})` : "#3a2a20" }}>
        {m && <KitchenCover menu={m} seed={room!.id} />}
      </div>
      <div className="flex items-center gap-2 px-3 py-2.5 text-white">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold leading-tight">{status}</div>
          <div className="mt-0.5 truncate text-[12px] text-[#c9b8a8]">{m ? `${m.interest} · ${room!.board.length} played` : ""}</div>
        </div>
        <span className="rounded-full px-3.5 py-1.5 text-[13px] font-bold text-white" style={{ background: m?.theme.primary ?? "#e8492f" }}>
          {room?.me ? "Again" : "Play"}
        </span>
      </div>
    </button>
  );
}

export interface Finished {
  /** Deep Cuts fields */
  room?: string;
  score?: number;
  reached?: string;
  icon?: string;
  title?: string;
  rank?: number;
  players?: number;
  /** Order Up! sends the chat line and card ref directly */
  text?: string;
  ref?: string;
}

/** Full-screen layer: inside the desktop phone mockup when there is one, otherwise over the whole screen. */
function Overlay({ children, className = "", onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.querySelector<HTMLElement>(".phone") ?? document.body), []);
  if (!host) return null;
  const inFrame = host !== document.body;
  return createPortal(
    <div className={`${inFrame ? "absolute" : "fixed"} inset-0 z-[60] ${className}`} onClick={onClick}>
      {children}
    </div>,
    host,
  );
}

export function GamePlayer({ roomId, userId, name, onClose, onFinished }: { roomId: string; userId: string; name: string; onClose: () => void; onFinished: (f: Finished) => void }) {
  const path = kindOf(roomId) === "orderup" ? `/k/${idOf(roomId)}` : `/x/${roomId}`;
  const src = `${sqUrl()}${path}?embed=1&pid=${sqPid(userId)}&name=${encodeURIComponent(name)}`;
  // the desktop dev bar floats over the bottom of the phone, right where games put their Play button
  useEffect(() => {
    document.body.classList.add("game-open");
    return () => document.body.classList.remove("game-open");
  }, []);
  useEffect(() => {
    const on = (e: MessageEvent) => {
      const d = e.data as { source?: string; type?: string } & Partial<Finished>;
      if (d?.source !== "deepcuts" && d?.source !== "orderup") return;
      if (d.type === "close") onClose();
      if (d.type === "finished") onFinished(d as Finished);
    };
    addEventListener("message", on);
    return () => removeEventListener("message", on);
  }, [onClose, onFinished]);
  return (
    <Overlay className="bg-black">
      <iframe src={src} title="Game" allow="autoplay; clipboard-write" className="h-full w-full border-0" />
    </Overlay>
  );
}

const GAMES: Record<GameKind, { name: string; blurb: string; emoji: string; api: string; prefix: string; placeholder: string; suggestions: string[]; accent: string }> = {
  deepcuts: { name: "Deep Cuts", blurb: "Name the answer nobody else thinks of", emoji: "🔎", api: "/api/x", prefix: "", placeholder: "Pick a topic for the chat", suggestions: ["Rock climbing", "F1", "Sourdough", "Scuba diving", "Dinosaurs", "Taylor Swift", "Coffee", "Space"], accent: "#ffb020" },
  orderup: { name: "Order Up!", blurb: "Run a restaurant. Serve fast, earn tips", emoji: "🍳", api: "/api/k", prefix: "k:", placeholder: "What kind of restaurant?", suggestions: ["Burgers", "Ramen", "Tacos", "Pizza", "Sushi", "Coffee shop", "Rock climbing", "Taylor Swift"], accent: "#e8492f" },
};

export function GameTray({ onCreate, onClose }: { onCreate: (ref: string, interest: string, game: GameKind) => void; onClose: () => void }) {
  const [game, setGame] = useState<GameKind>("deepcuts");
  const G = GAMES[game];
  const SUGGESTIONS = G.suggestions;
  const [topic, setTopic] = useState("");
  const [ready, setReady] = useState<{ interest: string; title: string; emoji: string }[]>([]);
  const [building, setBuilding] = useState<string | null>(null);
  const [secs, setSecs] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    setReady([]);
    fetch(`${sqUrl()}${G.api}/topics`)
      .then((r) => r.json())
      .then(setReady)
      .catch(() => setError("Game server isn't running. Start it with: npm run sidequest"));
  }, [G.api]);
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
      const r = await fetch(`${sqUrl()}${G.api}/new`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ interest: i }) });
      const d = (await r.json()) as { id?: string; error?: string };
      if (!r.ok || !d.id) throw new Error(d.error ?? "Couldn't make that game");
      onCreate(`${G.prefix}${d.id}`, i, game);
    } catch (e) {
      setError((e as Error).message);
      setBuilding(null);
    }
  }
  const readySet = new Set(ready.map((r) => r.interest.toLowerCase()));
  const chips = [...ready.map((r) => r.interest), ...SUGGESTIONS.filter((s) => !readySet.has(s.toLowerCase()))].slice(0, 10);

  return (
    <Overlay className="flex flex-col justify-end bg-black/40" onClick={onClose}>
      <div className="rounded-t-[22px] px-4 pb-6 pt-3 text-white" style={{ background: "#11131b" }} onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/25" />
        <div className="flex items-center justify-between">
          <div className="text-[20px] font-extrabold leading-none">Play a game</div>
          <button onClick={onClose} className="rounded-full p-1.5 text-white/70" aria-label="Close"><X size={20} /></button>
        </div>
        {!building && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(Object.keys(GAMES) as GameKind[]).map((k) => (
              <button
                key={k}
                onClick={() => setGame(k)}
                className="rounded-2xl px-3 py-2.5 text-left transition-colors"
                style={{ background: game === k ? "rgba(255,255,255,.14)" : "rgba(255,255,255,.05)", boxShadow: game === k ? `inset 0 0 0 2px ${GAMES[k].accent}` : "none" }}
              >
                <div className="text-[22px] leading-none">{GAMES[k].emoji}</div>
                <div className="mt-1.5 text-[15px] font-bold">{GAMES[k].name}</div>
                <div className="text-[12px] leading-snug text-[#a9b0c4]">{GAMES[k].blurb}</div>
              </button>
            ))}
          </div>
        )}
        {building ? (
          <div className="py-8 text-center">
            <div className="text-[20px] font-bold">Building {building}…</div>
            <div className="mt-2 text-[13px] text-[#a9b0c4]">
              {readySet.has(building.toLowerCase()) ? "Almost ready" : `${secs}s · new topics take ${game === "orderup" ? "about 20 seconds" : "about a minute"}`}
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
                placeholder={G.placeholder}
                className="min-w-0 flex-1 rounded-full bg-white/10 px-4 py-3 text-[16px] text-white outline-none ring-2 ring-transparent placeholder:text-white/40 focus:ring-[#6ee7b7]"
                autoFocus
              />
              <button type="submit" className="rounded-full px-5 text-[15px] font-bold" style={{ background: G.accent, color: game === "orderup" ? "#fff" : "#111" }}>
                Send
              </button>
            </form>
            <div className="mt-3 flex flex-wrap gap-2">
              {chips.map((c) => (
                <button key={c} onClick={() => create(c)} className="rounded-full bg-white/10 px-3 py-1.5 text-[14px] font-medium active:bg-white/20">
                  {readySet.has(c.toLowerCase()) ? "⚡ " : ""}
                  {c}
                </button>
              ))}
            </div>
            <div className="mt-2.5 text-[12px] text-[#a9b0c4]">⚡ ready instantly</div>
          </>
        )}
        {error && <div className="mt-3 text-[14px] text-[#ffb0a8]">{error}</div>}
      </div>
    </Overlay>
  );
}

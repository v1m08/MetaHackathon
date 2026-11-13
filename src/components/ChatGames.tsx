"use client";
// The chat games in Messenger (Deep Cuts, Order Up!, Ghost Run, Sketch Off): the game cards in the thread, the full-screen player,
// and the games tray behind the composer's "+" button. The games run on the Sidequest server (port 5180).
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { api } from "@/lib/api";
import { SceneView } from "../../sidequest/client/src/rarity/scene";
import { withScene, type PublicPack } from "../../sidequest/shared/rarity";
import type { Menu } from "../../sidequest/shared/kitchen";
import type { Course } from "../../sidequest/shared/run";
import type { Stroke } from "../../sidequest/shared/sketch";

/** A chat game reference: "<roomId>" is Deep Cuts, "k:<roomId>" is Order Up!. */
export type GameKind = "deepcuts" | "orderup" | "ghostrun" | "sketchoff";
/** Card refs: "<id>" Deep Cuts, "k:<id>" Order Up!, "r:<id>" Ghost Run, "s:<id>" Sketch Off. */
export const kindOf = (ref: string): GameKind => (ref.startsWith("k:") ? "orderup" : ref.startsWith("r:") ? "ghostrun" : ref.startsWith("s:") ? "sketchoff" : "deepcuts");
const idOf = (ref: string) => ref.replace(/^[krs]:/, "");

/** Where the game server lives. "same-origin" = proxied through this app (next.config.ts rewrites), used for the public demo tunnel. */
export const sqUrl = () => {
  const v = process.env.NEXT_PUBLIC_SIDEQUEST_URL;
  if (typeof window === "undefined") return v && v !== "same-origin" ? v : "";
  if (v === "same-origin") return location.origin;
  return v || `${location.protocol}//${location.hostname}:5180`;
};
/** Messenger user → Sidequest player id (6-32 lowercase alphanumerics). */
export const sqPid = (userId: string) => `fbu${userId.toLowerCase().replace(/[^a-z0-9]/g, "")}`.padEnd(6, "0").slice(0, 32);

interface RoomInfo {
  id: string;
  pack: PublicPack;
  me: { done: number; finished: boolean; score: number } | null;
  board: { name: string; score: number; answered: number; me: boolean }[];
  prompts: unknown[];
}

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
    const s = new SceneView(ref.current, pack, { gauge: false, px: 3, assetBase: sqUrl() });
    s.setProgress(0, true);
    return () => s.destroy();
  }, [pack]);
  return <div ref={ref} className="absolute inset-0 overflow-hidden" aria-hidden="true" />;
}


/** A game card's footer: a plain top-3 leaderboard (or a one-line nudge before anyone has played) and the button. */
type Standing = { name: string; me: boolean; value: string };
const MEDALS = ["🥇", "🥈", "🥉"];
function CardFooter({ rows, empty, cta, color, ctaText = "#111", muted = "#a9b0c4" }: { rows: Standing[] | null; empty: string; cta: string; color: string; ctaText?: string; muted?: string }) {
  const shown = rows?.slice(0, 3) ?? [];
  const more = (rows?.length ?? 0) - shown.length;
  return (
    <div className="flex items-center gap-2 px-3 py-2.5 text-white">
      <div className="min-w-0 flex-1">
        {!rows ? (
          <div className="text-[14px] font-semibold">Loading…</div>
        ) : !rows.length ? (
          <div className="text-[14px] font-semibold">{empty}</div>
        ) : (
          <ol className="space-y-0.5 text-[13px] leading-[18px]">
            {shown.map((r, k) => (
              <li key={k} className="flex items-center gap-1.5">
                <span className="w-4 flex-none text-center text-[12px]">{MEDALS[k]}</span>
                <span className={cx("min-w-0 flex-1 truncate", r.me ? "font-bold" : "font-medium")}>{r.me ? "You" : r.name}</span>
                <span className="flex-none tabular-nums" style={{ color: r.me ? "#fff" : muted }}>{r.value}</span>
              </li>
            ))}
            {more > 0 && <li className="pl-[22px] text-[12px]" style={{ color: muted }}>+{more} more</li>}
          </ol>
        )}
      </div>
      <span className="flex-none self-center rounded-full px-3.5 py-1.5 text-[13px] font-bold" style={{ background: color, color: ctaText }}>
        {cta}
      </span>
    </div>
  );
}
const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

export function GameCard({ roomId, userId, onOpen }: { roomId: string; userId: string; onOpen: (ref: string) => void }) {
  const kind = kindOf(roomId);
  if (kind === "orderup") return <KitchenCard gameRef={roomId} userId={userId} onOpen={onOpen} />;
  if (kind === "ghostrun") return <RunCard gameRef={roomId} userId={userId} onOpen={onOpen} />;
  if (kind === "sketchoff") return <SketchCard gameRef={roomId} userId={userId} onOpen={onOpen} />;
  return <DeepCutsCard roomId={roomId} userId={userId} onOpen={onOpen} />;
}

function DeepCutsCard({ roomId, userId, onOpen }: { roomId: string; userId: string; onOpen: (ref: string) => void }) {
  const { room, missing } = useRoom(roomId, userId);
  if (missing) return <div className="rounded-2xl bg-[#f0f0f0] px-3 py-2 text-[13px] text-ink-2">This game has ended.</div>;
  const p = room?.pack;
  // Plain points here: the in-game meter ("2,380 OVO", "1,140 Elo") is flavor that means nothing in the chat.
  const n = room?.prompts?.length || 7;
  const rows = room ? room.board.map((b) => ({ name: b.name, me: b.me, value: b.answered < n ? `${b.score} pts · ${b.answered}/${n}` : `${b.score} pts` })) : null;
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
      <CardFooter rows={rows} empty="Be the first to play" cta={cta} color={p?.palette.primary ?? "#ffb020"} />
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
  const usd = (n: number) => `$${n.toLocaleString("en-US")}`;
  const rows = room ? room.board.map((b) => ({ name: b.name, me: b.me, value: `${usd(b.score)} tips` })) : null;
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
      <CardFooter rows={rows} empty="Be the first to open" cta={room?.me ? "Again" : "Play"} color={m?.theme.primary ?? "#e8492f"} ctaText="#fff" muted="#c9b8a8" />
    </button>
  );
}

// ---------- Ghost Run + Sketch Off cards ----------
/** Polls a game room for its card. */
function usePoll<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (r.status === 404) return alive && setMissing(true);
        const d = (await r.json()) as T;
        if (alive) setData(d);
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
  }, [url]);
  return { data, missing };
}
function CardShell({ label, onOpen, cover, rows, empty, cta, color }: { label: string; onOpen: () => void; cover: React.ReactNode; rows: Standing[] | null; empty: string; cta: string; color: string }) {
  return (
    <button onClick={onOpen} className="mb-1 block w-[248px] overflow-hidden rounded-[18px] text-left shadow-[0_1px_2px_rgba(0,0,0,0.15)] transition-transform active:scale-[0.98]" style={{ background: "#11131b" }} aria-label={label}>
      <div className="relative h-[156px] overflow-hidden">{cover}</div>
      <CardFooter rows={rows} empty={empty} cta={cta} color={color} />
    </button>
  );
}
const badge = (text: string) => (
  <div className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ background: "rgba(10,12,20,.6)", backdropFilter: "blur(4px)" }}>{text}</div>
);

interface RunInfo {
  course: Course;
  board: { name: string; time: number; me: boolean }[];
  me: { best: number | null } | null;
}
function RunCover({ course }: { course: Course }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const up = course.scene.kind !== "ocean" && course.scene.kind !== "dig";
    const pack = { interest: course.interest, title: course.title, tagline: course.tagline, scene: course.scene, avatar: course.avatar, verb: "Go", host: { name: "", emoji: "", intro: "" }, meter: { label: "", unit: "m", perPoint: 1, up, icon: "" }, tiers: ["", "", "", "", "", ""], palette: { bg: course.scene.start[0], bg2: course.scene.start[1], card: "#232838", primary: course.palette.primary, accent: course.palette.accent, text: "#fff" }, font: "Rubik", prompts: [] } as unknown as PublicPack;
    const s = new SceneView(ref.current, pack, { gauge: false, px: 3 });
    s.setProgress(0, true);
    return () => s.destroy();
  }, [course]);
  return <div ref={ref} className="absolute inset-0 overflow-hidden" aria-hidden="true" />;
}
function RunCard({ gameRef, userId, onOpen }: { gameRef: string; userId: string; onOpen: (ref: string) => void }) {
  const { data: room, missing } = usePoll<RunInfo>(`${sqUrl()}/api/r/${idOf(gameRef)}?me=${sqPid(userId)}`);
  if (missing) return <div className="rounded-2xl bg-[#f0f0f0] px-3 py-2 text-[13px] text-ink-2">This race has ended.</div>;
  const c = room?.course;
  const t = (n: number) => `${n.toFixed(2)}s`;
  const rows = room ? room.board.map((b) => ({ name: b.name, me: b.me, value: t(b.time) })) : null;
  return (
    <CardShell
      label={`Open race ${c?.title ?? ""}`}
      onOpen={() => onOpen(gameRef)}
      color={c?.palette.primary ?? "#ff5d3a"}
      cta={room?.me?.best ? "Again" : "Race"}
      rows={rows}
      empty="Set the time to beat"
      cover={
        <>
          <div className="absolute inset-0" style={{ background: c?.scene.start[1] ?? "#2a3142" }} />
          {c && <RunCover course={c} />}
          {c && (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-3 text-center" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.35))" }}>
              <div className="text-[26px] leading-none">{c.avatar}</div>
              <div className="mt-1 text-[22px] font-extrabold leading-[1.05] text-white" style={{ textShadow: `0 2px 0 ${c.palette.primary}, 0 3px 10px rgba(0,0,0,.55)` }}>{c.title}</div>
            </div>
          )}
          {badge("Ghost Run")}
        </>
      }
    />
  );
}

interface SketchInfo {
  pack: { title: string; interest: string; host: { emoji: string }; palette: { wall: string; wall2: string; primary: string; accent: string } };
  me: { drew: boolean; score: number } | null;
  board: { name: string; score: number; me: boolean }[];
  drawings: { id: string; artist: string; own: boolean; strokes: Stroke[]; guessed?: unknown }[];
}
function SketchThumb({ strokes }: { strokes: Stroke[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    void import("../../sidequest/client/src/sketch/draw").then(({ renderStrokes }) => ref.current && renderStrokes(ref.current.getContext("2d")!, strokes, 1, "#fffdf8"));
  }, [strokes]);
  return <canvas ref={ref} width={96} height={96} className="h-full w-full" style={{ imageRendering: "pixelated" }} />;
}
function SketchCard({ gameRef, userId, onOpen }: { gameRef: string; userId: string; onOpen: (ref: string) => void }) {
  const { data: room, missing } = usePoll<SketchInfo>(`${sqUrl()}/api/s/${idOf(gameRef)}?me=${sqPid(userId)}`);
  if (missing) return <div className="rounded-2xl bg-[#f0f0f0] px-3 py-2 text-[13px] text-ink-2">This game has ended.</div>;
  const p = room?.pack;
  const latest = room?.drawings.at(-1);
  const waiting = room ? room.drawings.filter((d) => !d.own && !d.guessed).length : 0;
  const rows = room ? room.board.map((b) => ({ name: b.name, me: b.me, value: `${b.score} pts` })) : null;
  return (
    <CardShell
      label={`Open drawing game ${p?.title ?? ""}`}
      onOpen={() => onOpen(gameRef)}
      color={p?.palette.accent ?? "#2f6fd1"}
      cta={!room?.me?.drew ? "Draw" : waiting ? "Guess" : "View"}
      rows={rows}
      empty={latest ? `${latest.artist} drew something. Your turn` : "Be the first to draw"}
      cover={
        <div className="absolute inset-0 flex items-center gap-3 px-3" style={{ background: p ? `linear-gradient(180deg, ${p.palette.wall}, ${p.palette.wall2})` : "#e6d3bd" }}>
          <div className="h-[118px] w-[118px] flex-none rounded-md bg-[#fffdf8] p-1" style={{ boxShadow: "0 0 0 4px #8a5a3a, 0 6px 12px rgba(0,0,0,.3)" }}>
            {latest ? <SketchThumb strokes={latest.strokes} /> : <div className="grid h-full place-items-center text-[40px]">🎨</div>}
          </div>
          {p && (
            <div className="min-w-0">
              <div className="text-[24px] leading-none">{p.host.emoji}</div>
              <div className="mt-1 text-[19px] font-extrabold leading-[1.05] text-white" style={{ textShadow: `0 2px 0 ${p.palette.primary}, 0 3px 10px rgba(0,0,0,.45)` }}>{p.title}</div>
            </div>
          )}
          {badge("Sketch Off")}
        </div>
      }
    />
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
function Overlay({ children, className = "", onClick, fitKeyboard = false }: { children: React.ReactNode; className?: string; onClick?: () => void; fitKeyboard?: boolean }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.querySelector<HTMLElement>(".phone") ?? document.body), []);
  const inFrame = !!host && host !== document.body;
  const vv = useVisibleViewport(fitKeyboard && !!host && !inFrame);
  if (!host) return null;
  return createPortal(
    <div className={`${inFrame ? "absolute" : "fixed"} inset-0 z-[60] ${className}`} style={vv ? { top: vv.top, height: vv.height, bottom: "auto" } : undefined} onClick={onClick}>
      {children}
    </div>,
    host,
  );
}

/** The part of the screen the on-screen keyboard isn't covering. On iOS the keyboard doesn't resize the page, it
 *  slides it up, so a full-screen game ends up half behind the keyboard; sizing to this keeps it above. */
function useVisibleViewport(on: boolean) {
  const [box, setBox] = useState<{ top: number; height: number } | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!on || !vv) return;
    const fit = () => setBox({ top: vv.offsetTop, height: vv.height });
    fit();
    vv.addEventListener("resize", fit);
    vv.addEventListener("scroll", fit);
    return () => {
      vv.removeEventListener("resize", fit);
      vv.removeEventListener("scroll", fit);
    };
  }, [on]);
  return box;
}

export function GamePlayer({ roomId, userId, name, onClose, onFinished }: { roomId: string; userId: string; name: string; onClose: () => void; onFinished: (f: Finished) => void }) {
  const path = { orderup: "/k/", ghostrun: "/r/", sketchoff: "/s/", deepcuts: "/x/" }[kindOf(roomId)] + idOf(roomId);
  const src = `${sqUrl()}${path}?embed=1&pid=${sqPid(userId)}&name=${encodeURIComponent(name)}`;
  // the desktop dev bar floats over the bottom of the phone, right where games put their Play button
  useEffect(() => {
    document.body.classList.add("game-open");
    return () => document.body.classList.remove("game-open");
  }, []);
  useEffect(() => {
    const on = (e: MessageEvent) => {
      const d = e.data as { source?: string; type?: string } & Partial<Finished>;
      if (!["deepcuts", "orderup", "ghostrun", "sketchoff"].includes(String(d?.source))) return;
      if (d.type === "close") onClose();
      if (d.type === "finished") onFinished(d as Finished);
    };
    addEventListener("message", on);
    return () => removeEventListener("message", on);
  }, [onClose, onFinished]);
  return (
    <Overlay className="bg-black" fitKeyboard>
      <iframe src={src} title="Game" allow="autoplay; clipboard-write" className="h-full w-full border-0" />
    </Overlay>
  );
}

export const GAMES: Record<GameKind, { name: string; blurb: string; emoji: string; api: string; prefix: string; accent: string; wait: string }> = {
  deepcuts: { name: "Deep Cuts", blurb: "name the answer nobody else thinks of", emoji: "🔎", api: "/api/x", prefix: "", accent: "#ffb020", wait: "about a minute" },
  orderup: { name: "Order Up!", blurb: "run the restaurant, serve fast, earn tips", emoji: "🍳", api: "/api/k", prefix: "k:", accent: "#e8492f", wait: "about 20 seconds" },
  ghostrun: { name: "Ghost Run", blurb: "race your friends' ghosts to the finish", emoji: "👻", api: "/api/r", prefix: "r:", accent: "#ff5d3a", wait: "about 15 seconds" },
  sketchoff: { name: "Sketch Off", blurb: "draw it, friends and the AI guess it", emoji: "🎨", api: "/api/s", prefix: "s:", accent: "#2f6fd1", wait: "about 15 seconds" },
};

/** Food and cooking topics become a restaurant (Order Up!). */
const FOOD =
  /\b(food|foods|foodie|cook|cooking|cooks|chef|chefs|kitchen|restaurant|restaurants|diner|cafe|café|bistro|bakery|bake|baking|baker|bread|sourdough|pastry|pastries|cake|cakes|cupcake|cookie|cookies|dessert|desserts|ice cream|recipe|recipes|cuisine|meal|meals|brunch|breakfast|lunch|dinner|snack|snacks|street food|bbq|barbecue|grill|grilling|burger|burgers|pizza|pizzas|pasta|noodle|noodles|ramen|pho|sushi|taco|tacos|burrito|curry|dumpling|dumplings|dim sum|sandwich|sandwiches|steak|salad|soup|fries|wings|donut|donuts|doughnut|pancake|pancakes|waffle|waffles|coffee|espresso|latte|tea|boba|smoothie|cheese|chocolate|candy|vegan|vegetarian|seafood|bagel|bagels|croissant|kebab|falafel)\b/i;
/** Sports, vehicles and outdoor activities become a race (Ghost Run). */
const MOTION =
  /\b(f1|formula ?1|formula one|racing|race|races|nascar|motorsport|rally|karting|kart|cars?|driving|motorcycles?|bikes?|biking|cycling|bmx|skate|skating|skateboard(ing)?|snowboard(ing)?|ski|skiing|surf|surfing|swim|swimming|running|marathon|sprint|track and field|parkour|climb|climbing|bouldering|mountaineering|hiking|hike|trail|rowing|kayak(ing)?|sailing|horse ?riding|equestrian|soccer|football|basketball|tennis|hockey|rugby|lacrosse|volleyball|baseball|cricket|golf|olympics|athletics|triathlon|spacex|rockets?|planes?|aviation|flying|trains?|boats?)\b/i;
/** Visual, drawable worlds become a drawing game (Sketch Off). */
const VISUAL =
  /\b(animals?|pets?|dogs?|cats?|birds?|ocean|sea life|marine|dinosaurs?|bugs?|insects?|zoo|wildlife|nature|plants?|flowers?|gardening|space|planets?|astronomy|movies?|films?|cinema|cartoons?|anime|disney|pixar|art|drawing|painting|fashion|outfits?|architecture|buildings?|monsters?|fantasy|mythology|pirates?|robots?|halloween|christmas|holidays?|emoji)\b/i;
export const gameFor = (topic: string): GameKind => (FOOD.test(topic) ? "orderup" : MOTION.test(topic) ? "ghostrun" : VISUAL.test(topic) ? "sketchoff" : "deepcuts");

const SUGGESTIONS = ["Rock climbing", "F1", "Skiing", "Animals", "Space", "Taylor Swift", "Ramen", "Burgers"];

export function GameTray({ conversationId, onCreate, onClose }: { conversationId?: string; onCreate: (ref: string, interest: string, game: GameKind) => void; onClose: () => void }) {
  const [topic, setTopic] = useState("");
  const [ready, setReady] = useState<{ interest: string; game: GameKind }[]>([]);
  const [building, setBuilding] = useState<{ topic: string; game: GameKind } | null>(null);
  const [smart, setSmart] = useState<{ forChat: { chip: string; reason: string }[]; discover: { chip: string; reason: string }[] } | null>(null);
  const [secs, setSecs] = useState(0);
  const [error, setError] = useState("");
  const [choice, setChoice] = useState<GameKind | "auto">("auto");
  const pick = (topic: string): GameKind => (choice === "auto" ? gameFor(topic) : choice);
  useEffect(() => {
    // topics either game can start instantly
    Promise.all(
      (Object.keys(GAMES) as GameKind[]).map((g) =>
        fetch(`${sqUrl()}${GAMES[g].api}/topics`)
          .then((r) => r.json() as Promise<{ interest: string }[]>)
          .then((list) => list.map((t) => ({ interest: t.interest, game: g }))),
      ),
    )
      .then((lists) => setReady(lists.flat()))
      .catch(() => setError("Game server isn't running. Start it with: npm run sidequest"));
  }, []);
  useEffect(() => {
    if (!conversationId) return;
    const g = choice === "orderup" ? "orderup" : "deepcuts";
    api<{ forChat: { chip: string; reason: string }[]; discover: { chip: string; reason: string }[] }>(`/api/context/tray?conversationId=${encodeURIComponent(conversationId)}&game=${g}`)
      .then(setSmart)
      .catch(() => setSmart(null));
  }, [conversationId, choice]);
  useEffect(() => {
    if (!building) return;
    const t0 = Date.now();
    const t = setInterval(() => setSecs(Math.floor((Date.now() - t0) / 1000)), 500);
    return () => clearInterval(t);
  }, [building]);

  async function create(interest: string) {
    const i = interest.trim();
    if (!i || building) return;
    const game = pick(i);
    const G = GAMES[game];
    setBuilding({ topic: i, game });
    setError("");
    try {
      const r = await fetch(`${sqUrl()}${G.api}/new`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ interest: i }) });
      const d = (await r.json()) as { id?: string; error?: string };
      if (!r.ok || !d.id) throw new Error(d.error ?? "Couldn't make that game");
      onCreate(`${G.prefix}${d.id}`, i, game);
    } catch (e) {
      const msg = (e as Error).message;
      setError(/failed to fetch|load failed|networkerror/i.test(msg) ? "Couldn't reach the game server. Make sure npm run sidequest is running, then try again." : msg);
      setBuilding(null);
    }
  }
  // instant topics for the chosen game (or each topic's own game on Auto)
  const readyHere = ready.filter((r) => (choice === "auto" ? gameFor(r.interest) === r.game : r.game === choice));
  const readySet = new Set(readyHere.map((r) => r.interest.toLowerCase()));
  const suggestions = choice === "auto" ? SUGGESTIONS : SUGGESTIONS.filter((s) => gameFor(s) === choice);
  const smartChips = smart ? [...smart.forChat, ...smart.discover].slice(0, 5) : [];
  const smartSet = new Set(smartChips.map((s) => s.chip.toLowerCase()));
  const chips = [...readyHere.map((r) => r.interest), ...suggestions.filter((s) => !readySet.has(s.toLowerCase()))]
    .filter((c) => !smartSet.has(c.toLowerCase()))
    .slice(0, 8);
  const picked = choice !== "auto" ? GAMES[choice] : topic.trim() ? GAMES[gameFor(topic)] : null;

  return (
    <Overlay className="flex flex-col justify-end bg-black/40" onClick={onClose}>
      <div className="rounded-t-[22px] px-4 pb-6 pt-3 text-white" style={{ background: "#11131b" }} onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/25" />
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[20px] font-extrabold leading-none">Play a game</div>
            <div className="mt-1 text-[13px] text-[#a9b0c4]">Pick a topic. We'll make a game about it for the chat.</div>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-white/70" aria-label="Close"><X size={20} /></button>
        </div>
        {building ? (
          <div className="py-8 text-center">
            <div className="text-[34px] leading-none">{GAMES[building.game].emoji}</div>
            <div className="mt-2 text-[20px] font-bold">Making {GAMES[building.game].name}: {building.topic}…</div>
            <div className="mt-2 text-[13px] text-[#a9b0c4]">
              {readySet.has(building.topic.toLowerCase()) ? "Almost ready" : `${secs}s · new topics take ${GAMES[building.game].wait}`}
            </div>
          </div>
        ) : (
          <>
            <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="radiogroup" aria-label="Game">
              {(["auto", ...(Object.keys(GAMES) as GameKind[])] as const).map((k) => {
                const on = choice === k;
                const g = k === "auto" ? null : GAMES[k];
                return (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={(e) => {
                      setChoice(k);
                      e.currentTarget.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
                    }}
                    className="shrink-0 rounded-full px-3 py-1.5 text-[14px] font-semibold transition-colors"
                    style={on ? { background: g?.accent ?? "#ffffff", color: g && g.name !== "Deep Cuts" ? "#fff" : "#111" } : { background: "rgba(255,255,255,0.08)", color: "#d6dbe8" }}
                  >
                    {g ? `${g.emoji} ${g.name}` : "✨ Auto"}
                  </button>
                );
              })}
            </div>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void create(topic);
              }}
            >
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                maxLength={60}
                placeholder="Pick a topic"
                className="min-w-0 flex-1 rounded-full bg-white/10 px-4 py-3 text-[16px] text-white outline-none ring-2 ring-transparent placeholder:text-white/40 focus:ring-[#6ee7b7]"
                autoFocus
              />
              <button type="submit" className="rounded-full px-5 text-[15px] font-bold" style={{ background: picked?.accent ?? "#ffb020", color: picked && picked.name !== "Deep Cuts" ? "#fff" : "#111" }}>
                Play
              </button>
            </form>
            <div className="mt-2 min-h-[18px] px-1 text-[13px] text-[#a9b0c4]">
              {picked ? (
                <>
                  {picked.emoji} <b className="font-semibold text-white">{picked.name}</b>: {picked.blurb}
                </>
              ) : (
                "Auto picks the game from your topic: food opens a restaurant, sports a race, visual topics a drawing game, anything else trivia."
              )}
            </div>
            {smartChips.length > 0 && (
              <div className="mt-3">
                <div className="mb-1.5 text-[11.5px] font-semibold text-[#6ee7b7]">Picked for this chat</div>
                <div className="flex flex-wrap gap-1.5">
                  {smartChips.map((s) => (
                    <button
                      key={s.chip}
                      onClick={() => create(s.chip)}
                      title={s.reason}
                      className="rounded-full bg-[#6ee7b7]/15 px-3 py-1 text-[13px] font-medium text-[#a7f3d0] ring-1 ring-[#6ee7b7]/30 active:bg-[#6ee7b7]/25"
                    >
                      {readySet.has(s.chip.toLowerCase()) ? "⚡ " : ""}
                      {s.chip}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {chips.map((c) => (
                <button key={c} onClick={() => create(c)} className="rounded-full bg-white/10 px-3 py-1.5 text-[14px] font-medium active:bg-white/20">
                  {GAMES[pick(c)].emoji} {c}
                  {readySet.has(c.toLowerCase()) ? " ⚡" : ""}
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

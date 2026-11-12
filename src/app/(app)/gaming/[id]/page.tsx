"use client";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Shell } from "@/components/Shell";
import { Avatar, Button, cx } from "@/components/ui";
import { api, useApi } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { Game } from "@/types";

type Card = { id: string; name: string; avatar: string };
type G = Omit<Game, "leaderboard"> & { leaderboard: { userId: string; score: number; user: Card; isFriend: boolean }[] };

/** Tap Dash: 10 rounds, tap the lit tile; score = avg reaction ms (lower is better). */
function TapDash({ onDone }: { onDone: (score: number) => void }) {
  const [lit, setLit] = useState<number | null>(null);
  const [round, setRound] = useState(0);
  const [times, setTimes] = useState<number[]>([]);
  const [started, setStarted] = useState(false);
  const litAt = useRef(0);
  const ROUNDS = 10;
  useEffect(() => {
    if (!started || round >= ROUNDS) return;
    const t = setTimeout(() => {
      setLit(Math.floor(Math.random() * 9));
      litAt.current = performance.now();
    }, 500 + Math.random() * 1200);
    return () => clearTimeout(t);
  }, [started, round]);
  useEffect(() => {
    if (round === ROUNDS && times.length === ROUNDS) onDone(Math.round(times.reduce((a, b) => a + b, 0) / ROUNDS));
  }, [round, times, onDone]);
  const tap = (i: number) => {
    if (lit === null) return;
    if (i !== lit) { setTimes([...times, 600]); } else setTimes([...times, performance.now() - litAt.current]);
    setLit(null);
    setRound(round + 1);
  };
  if (!started) return <Button className="w-full py-3 text-[17px]" onClick={() => setStarted(true)}>Start · 10 rounds</Button>;
  return (
    <div>
      <div className="mb-2 flex justify-between text-[13px] text-ink-2"><span>Round {Math.min(round + 1, ROUNDS)}/{ROUNDS}</span><span>{times.length ? `last ${Math.round(times.at(-1)!)}ms` : "wait for it…"}</span></div>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 9 }).map((_, i) => (
          <button key={i} onPointerDown={() => tap(i)} className={cx("aspect-square rounded-xl transition", lit === i ? "bg-yellow-400 shadow-lg scale-105" : "bg-[#e4e6eb]")} />
        ))}
      </div>
    </div>
  );
}

/** Word Rush: 45s, type words from 9 letters; score = total letters used. */
function WordRush({ onDone }: { onDone: (score: number) => void }) {
  const LETTERS = "AUSTINERL".split("");
  const [words, setWords] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [left, setLeft] = useState(45);
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (!started) return;
    if (left <= 0) { onDone(words.reduce((n, w) => n + w.length * 10, 0)); return; }
    const t = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(t);
  }, [started, left, words, onDone]);
  const submit = () => {
    const w = input.toUpperCase().trim();
    const pool = [...LETTERS];
    const ok = w.length >= 3 && [...w].every((ch) => { const i = pool.indexOf(ch); if (i < 0) return false; pool.splice(i, 1); return true; });
    if (ok && !words.includes(w)) setWords([...words, w]);
    setInput("");
  };
  if (!started) return <Button className="w-full py-3 text-[17px]" onClick={() => setStarted(true)}>Start · 45 seconds</Button>;
  return (
    <div>
      <div className="mb-2 flex justify-between text-[13px] text-ink-2"><span>{left}s</span><span>{words.length} words</span></div>
      <div className="flex justify-center gap-1">{LETTERS.map((l, i) => <span key={i} className="flex h-9 w-9 items-center justify-center rounded-md bg-fb text-[18px] font-bold text-white">{l}</span>)}</div>
      <div className="mt-3 flex gap-2">
        <input autoFocus value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} className="flex-1 rounded-lg border border-line px-3 py-2 text-[16px] uppercase outline-none" placeholder="Type a word" />
        <Button onClick={submit}>Enter</Button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">{words.map((w) => <span key={w} className="rounded bg-[#e7f3ff] px-2 py-0.5 text-[13px] font-semibold text-fb">{w}</span>)}</div>
    </div>
  );
}

export default function GamePage() {
  const { id } = useParams<{ id: string }>();
  const { userId } = useSession();
  const all = useApi<G[]>("/api/games", { poll: 4000 });
  const game = all.data?.find((x) => x.id === id);
  const [result, setResult] = useState<number | null>(null);
  const [key, setKey] = useState(0);
  if (!game) return <Shell back title="Game"><div className="skeleton h-64" /></Shell>;
  const lowerIsBetter = game.id === "gm_tapdash";
  const done = async (score: number) => {
    setResult(score);
    await api(`/api/games/${game.id}/score`, { method: "POST", json: { score, lowerIsBetter } });
    all.mutate();
  };
  return (
    <Shell back title={game.name} tabs={false}>
      <div className="bg-white px-4 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-fb to-purple-600 text-[36px]">{game.icon}</span>
          <div><div className="text-[20px] font-bold">{game.name}</div><div className="text-[13px] text-ink-2">{game.genre} · {game.players}</div></div>
        </div>
        <p className="mt-3 text-[15px] text-ink-2">{game.description}</p>
        <div className="mt-4 rounded-xl bg-[#f0f2f5] p-4">
          {game.playable ? (
            result === null ? (
              game.id === "gm_tapdash" ? <TapDash key={key} onDone={done} /> : <WordRush key={key} onDone={done} />
            ) : (
              <div className="text-center">
                <div className="text-[13px] font-semibold text-ink-2 uppercase">Your score</div>
                <div className="text-[44px] font-extrabold">{result}{lowerIsBetter && <span className="text-[18px] font-semibold text-ink-2">ms</span>}</div>
                <Button className="mt-2" onClick={() => { setResult(null); setKey(key + 1); }}>Play again</Button>
              </div>
            )
          ) : (
            <div className="py-6 text-center text-ink-2">This game is a placeholder. Hook your feature in here.</div>
          )}
        </div>
      </div>
      <div className="mt-2 bg-white px-4 py-3">
        <h2 className="text-[17px] font-bold">Friends leaderboard</h2>
        <div className="mt-2 divide-y divide-line/40">
          {game.leaderboard.map((e, i) => (
            <div key={e.userId} className={cx("flex items-center gap-3 py-2", e.userId === userId && "rounded-lg bg-[#e7f3ff] px-2")}>
              <span className="w-6 text-center text-[15px] font-bold text-ink-2">{i + 1}</span>
              <Avatar src={e.user.avatar} name={e.user.name} size={36} />
              <span className="flex-1 text-[15px] font-semibold">{e.user.name}{e.userId === userId && " (you)"}</span>
              <span className="text-[15px] font-bold">{e.score.toLocaleString()}{lowerIsBetter && "ms"}</span>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}

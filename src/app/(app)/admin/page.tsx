"use client";
// Demo admin: drop today's game into the judges' chat (Muse notifies every judge), and reset to the starter data between runs.
import { useState } from "react";
import { mutate } from "swr";
import { Gamepad2, RotateCcw } from "lucide-react";
import { Shell } from "@/components/Shell";
import { api } from "@/lib/api";

type Drop = { ref: string; title: string; source: string; notified: { userId: string; text: string }[] };

function DropGame() {
  const [topic, setTopic] = useState("tacos");
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const [result, setResult] = useState<Drop | null>(null);
  const [error, setError] = useState("");
  const drop = async () => {
    setState("busy");
    setError("");
    try {
      const r = await api<Drop>("/api/demo/drop", { method: "POST", json: { topic } });
      setResult(r);
      setState("idle");
      await mutate(() => true, undefined, { revalidate: true });
    } catch (e) {
      setError((e as Error).message);
      setState("error");
    }
  };
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="text-[16px] font-semibold">Drop today&apos;s game</div>
      <p className="mt-1 text-[14px] text-ink-2">
        Opens an Order Up! restaurant in the judges&apos; chat (Sunday cookout 🔥) as Tyler. Muse writes each judge a personal nudge that pops up on their phone. tacos, burgers and ramen open instantly; any other topic takes about 20 seconds.
      </p>
      <div className="mt-3 flex gap-2">
        <input value={topic} onChange={(e) => setTopic(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2 text-[15px]" placeholder="Topic" />
        <button onClick={drop} disabled={state === "busy" || !topic.trim()} className="flex items-center gap-2 rounded-lg bg-fb px-4 py-2 text-[15px] font-semibold text-white disabled:opacity-60">
          <Gamepad2 size={18} /> {state === "busy" ? "Dropping…" : "Drop"}
        </button>
      </div>
      {result && (
        <div className="mt-3 space-y-1 text-[13.5px]">
          <div className="font-medium text-[#1a7f37]">
            Dropped {result.title}. Notified {result.notified.length} people ({result.source === "muse" ? "written by Muse" : "template, Muse unavailable"}):
          </div>
          {result.notified.map((n) => (
            <div key={n.userId} className="text-ink-2">
              <b className="text-ink">{n.userId}</b>: {n.text}
            </div>
          ))}
        </div>
      )}
      {state === "error" && <p className="mt-2 text-[14px] font-medium text-[#e41e3f]">Couldn&apos;t drop the game: {error}</p>}
    </div>
  );
}

export default function AdminPage() {
  const [state, setState] = useState<"idle" | "confirm" | "busy" | "done" | "error">("idle");
  const reset = async () => {
    setState("busy");
    try {
      await api("/api/admin/reset", { method: "POST" });
      await mutate(() => true, undefined, { revalidate: true });
      setState("done");
    } catch {
      setState("error");
    }
  };
  return (
    <Shell back title="Demo admin" tabs={false}>
      <div className="space-y-3 p-4">
        <DropGame />
        <div className="rounded-xl border border-line bg-white p-4">
          <div className="text-[16px] font-semibold">Reset to starter data</div>
          <p className="mt-1 text-[14px] text-ink-2">
            Puts every chat, post, friend request and notification back to how it was at launch. Game cards posted in chats disappear. Everyone&apos;s phone picks it up on the next refresh.
          </p>
          {state === "confirm" ? (
            <div className="mt-3 flex gap-2">
              <button onClick={reset} className="flex-1 rounded-lg bg-[#e41e3f] py-2.5 text-[15px] font-semibold text-white">Yes, reset everything</button>
              <button onClick={() => setState("idle")} className="flex-1 rounded-lg bg-[#e4e6eb] py-2.5 text-[15px] font-semibold">Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => setState("confirm")}
              disabled={state === "busy"}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#e4e6eb] py-2.5 text-[15px] font-semibold disabled:opacity-60"
            >
              <RotateCcw size={18} /> {state === "busy" ? "Resetting…" : "Reset demo"}
            </button>
          )}
          {state === "done" && <p className="mt-2 text-[14px] font-medium text-[#1a7f37]">Done. Everything is back to the starter data.</p>}
          {state === "error" && <p className="mt-2 text-[14px] font-medium text-[#e41e3f]">Couldn&apos;t reset. Is the app server running?</p>}
        </div>
      </div>
    </Shell>
  );
}

"use client";
// Demo admin: put every chat, post and notification back to the starter data (between demo runs).
import { useState } from "react";
import { mutate } from "swr";
import { RotateCcw } from "lucide-react";
import { Shell } from "@/components/Shell";
import { api } from "@/lib/api";

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

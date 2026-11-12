"use client";
// After an Event or Group meetup: privately pick who you'd want to see again. Mutual picks reveal; one-way picks never do.
import { useEffect, useState } from "react";
import { Check, Egg, Lock } from "lucide-react";
import { Avatar, Button, Sheet, cx } from "@/components/ui";
import { api, refresh, useApi } from "@/lib/api";

type SeeAgain = { gathering: { id: string; name: string; place: string; date: string }; people: { id: string; name: string; avatar: string }[]; myPicks: string[]; submitted: boolean; matches: string[] };

export function SeeAgainSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, mutate } = useApi<SeeAgain>(open ? "/api/hangout/see-again" : null, { poll: open ? 2000 : 0 });
  const [picks, setPicks] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data && !data.submitted) setPicks((p) => (p.length ? p : data.myPicks));
  }, [data]);

  const submit = async () => {
    setBusy(true);
    await mutate(await api<SeeAgain>("/api/hangout/see-again", { method: "POST", json: { picks } }), { revalidate: false });
    refresh("/api/hangout");
    setBusy(false);
  };
  const toggle = (id: string) => setPicks((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const matchNames = data?.people.filter((p) => data.matches.includes(p.id)).map((p) => p.name.split(" ")[0]) ?? [];

  return (
    <Sheet open={open} onClose={onClose} title="See again?">
      {!data ? (
        <div className="skeleton m-4 h-40 rounded-xl" />
      ) : data.submitted ? (
        <div className="px-6 py-8 text-center">
          {matchNames.length ? (
            <>
              <div className="pop mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF6E5] text-[#E0A23B]"><Egg size={34} /></div>
              <p className="mt-3 text-[19px] font-bold">You and {matchNames.join(" and ")} both picked each other!</p>
              <p className="mt-1 text-[15px] text-ink-2">There&apos;s an egg in your Hangout. Say hi to hatch it.</p>
            </>
          ) : (
            <>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e7f3ff] text-fb"><Lock size={26} /></div>
              <p className="mt-3 text-[18px] font-bold">Got it. Your picks stay private.</p>
              <p className="mt-1 text-[15px] text-ink-2">If someone you picked picks you too, we&apos;ll let you both know.</p>
            </>
          )}
          <Button variant="secondary" className="mt-5 w-full" onClick={onClose}>Done</Button>
        </div>
      ) : (
        <div className="px-4 pt-3 pb-5">
          <p className="text-[15px]">
            You were at <b>{data.gathering.name}</b> · {data.gathering.place}. Anyone you&apos;d want to see again?
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-ink-2"><Lock size={13} /> Private. They only find out if they pick you too.</p>
          <div className="mt-3 divide-y divide-line/50">
            {data.people.map((p) => {
              const on = picks.includes(p.id);
              return (
                <button key={p.id} onClick={() => toggle(p.id)} className="flex w-full items-center gap-3 py-2.5 text-left">
                  <Avatar src={p.avatar} name={p.name} size={44} />
                  <span className="flex-1 text-[16px] font-semibold">{p.name}</span>
                  <span className={cx("flex h-8 items-center gap-1 rounded-full px-3 text-[14px] font-semibold transition", on ? "bg-fb text-white" : "bg-[#e4e6eb] text-ink")}>
                    {on && <Check size={15} />} {on ? "Picked" : "See again"}
                  </span>
                </button>
              );
            })}
          </div>
          <Button className="mt-4 w-full py-2.5" disabled={busy} onClick={submit}>{picks.length ? `Done · ${picks.length} picked` : "Skip for now"}</Button>
        </div>
      )}
    </Sheet>
  );
}

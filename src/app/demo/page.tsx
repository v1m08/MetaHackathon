// Judge landing page for the Austin "Sunday cookout" demo (/demo; the SF cast demo is /demo/sf): scan one QR code, pick a person, land on Facebook as them. When the presenter
// drops today's game (/admin), Muse pops a notification on every judge's phone that opens the game in the group chat.
// Thread and players can be overridden: /demo?thread=c_volleyball&players=jordan,devon,tyler,nina,grace
import { users } from "@/data/users";

const DEFAULT_THREAD = "c_judges";
const DEFAULT_PLAYERS = ["jordan", "devon", "tyler", "nina", "grace"];

export default async function DemoPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const thread = sp.thread || DEFAULT_THREAD;
  const ids = sp.players ? sp.players.split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_PLAYERS;
  const people = ids.map((id) => users.find((u) => u.id === id)).filter((u): u is (typeof users)[number] => !!u);

  return (
    <main className="mx-auto min-h-dvh max-w-md bg-white px-4 py-8 text-[#050505]">
      <h1 className="text-2xl font-bold">Pick who you are</h1>
      <p className="mt-1 text-[15px] text-[#65676b]">Everyone picks a different person. You&apos;re all in one group chat, Sunday cookout 🔥.</p>
      <p className="mt-2 text-[15px] text-[#65676b]">Keep Facebook open. When today&apos;s game drops, Muse will ping you: tap it to play, then close the game to see what Muse suggests for your group.</p>
      <ul className="mt-6 space-y-3">
        {people.map((u) => (
          <li key={u.id}>
            <a href={thread === DEFAULT_THREAD ? `/feed?as=${u.id}` : `/messages/${thread}?as=${u.id}`} className="flex items-center gap-3 rounded-xl border border-[#e4e6eb] p-3 active:bg-[#f0f2f5]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u.avatar} alt="" className="h-12 w-12 rounded-full object-cover" />
              <span className="text-[17px] font-semibold">{u.name}</span>
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}

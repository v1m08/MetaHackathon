// Judge picker for the SF cast demo (/demo/sf; the Austin cookout demo is /demo): scan one QR code, tap your number, land on your profile as that person.
import { DEMO_CAST, demoUsers } from "@/data/demo";
import { DEMO_IDS } from "@/lib/demo";
import { MUSE_COLORS, museAvatarFor } from "@/lib/museAvatar";

export default function DemoPage() {
  const people = DEMO_IDS.map((id) => demoUsers.find((u) => u.id === id)!);
  return (
    <main className="mx-auto min-h-dvh max-w-md bg-[#f6f4ff] px-4 pb-10 pt-8 text-[#050505]">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={museAvatarFor("muse")} alt="" className="h-14 w-14 rounded-2xl" />
        <div>
          <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.01em]">Pick your number</h1>
          <p className="text-[15px] text-[#65676b]">You&apos;ll play as that person.</p>
        </div>
      </div>
      <ul className="mt-6 space-y-3">
        {people.map((u, k) => {
          const col = MUSE_COLORS[u.id];
          return (
            <li key={u.id}>
              <a href={`/profile/${u.id}?as=${u.id}`} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-[0_1px_3px_rgba(0,0,0,0.08)] active:scale-[0.98] transition-transform">
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full text-[22px] font-extrabold text-white" style={{ background: `linear-gradient(135deg, ${col.from}, ${col.to})` }}>
                  {k + 1}
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u.avatar} alt="" className="h-14 w-14 flex-none rounded-full" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[18px] font-bold leading-tight">{u.name}</span>
                  <span className="block truncate text-[14px] text-[#65676b]">
                    {[DEMO_CAST[u.id].hood.replace(/^the /, ""), u.location.replace(", CA", "")].filter((x, i, a) => a.indexOf(x) === i).join(" · ")}
                  </span>
                </span>
                <span className="flex-none text-[22px] text-[#b0b3b8]">›</span>
              </a>
            </li>
          );
        })}
      </ul>
      <p className="mt-6 text-center text-[13px] text-[#65676b]">Everyone picks a different number. A guide at the top of the screen walks you through.</p>
    </main>
  );
}

"use client";
import { useRouter } from "next/navigation";
import { Check, ExternalLink } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Avatar, cx } from "@/components/ui";
import { useApi } from "@/lib/api";
import { useSession } from "@/lib/session";
import { mutate } from "swr";
import type { User } from "@/types";

export default function SwitchPage() {
  const { userId, setUserId } = useSession();
  const router = useRouter();
  const { data: users } = useApi<User[]>("/api/users");
  const pick = async (id: string) => {
    setUserId(id);
    await mutate(() => true, undefined, { revalidate: true });
    router.push("/");
  };
  return (
    <Shell back title="Switch account" tabs={false}>
      <div className="px-4 py-3 text-[13px] text-ink-2">
        Identity is per browser tab. To demo two people at once, open a second window at <code className="rounded bg-[#e4e6eb] px-1">/?as=&lt;id&gt;</code> or use the ↗ button.
      </div>
      <div className="divide-y divide-line/60 bg-white">
        {users?.map((u) => (
          <div key={u.id} className={cx("flex items-center gap-3 px-4 py-2.5", u.id === userId && "bg-[#e7f3ff]")}>
            <button onClick={() => pick(u.id)} className="flex flex-1 items-center gap-3 text-left">
              <Avatar src={u.avatar} name={u.name} size={48} />
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold">{u.name} <span className="font-normal text-ink-2">· {u.age}</span></div>
                <div className="truncate text-[13px] text-ink-2">{u.work ?? u.school}</div>
              </div>
              {u.id === userId && <Check size={20} className="text-fb" />}
            </button>
            <a href={`/?as=${u.id}`} target="_blank" rel="noreferrer" className="rounded-full p-2 text-ink-2 hover:bg-hover" title="Open in a new window as this user">
              <ExternalLink size={18} />
            </a>
          </div>
        ))}
      </div>
    </Shell>
  );
}

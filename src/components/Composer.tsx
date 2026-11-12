"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown, Globe, Image as ImageIcon, MapPin, Smile, Sparkles, Users, X } from "lucide-react";
import { api, refresh } from "@/lib/api";
import { photoUrl } from "@/lib/img";
import { useMe } from "./Shell";
import { Avatar, Button, Photo, cx } from "./ui";

/** The "What's on your mind?" card at the top of Feed / Group / Profile. */
export function ComposerCard({ groupId, placeholder }: { groupId?: string; placeholder?: string }) {
  const { data: me } = useMe();
  const href = groupId ? `/compose?group=${groupId}` : "/compose";
  return (
    <div className="mb-2 bg-white px-4 py-2.5">
      <div className="flex items-center gap-2.5">
        {me && (
          <Link href={`/profile/${me.id}`}>
            <Avatar src={me.avatar} name={me.name} size={40} />
          </Link>
        )}
        <Link href={href} className="flex-1 rounded-full border border-line/80 px-4 py-2 text-[15px] text-ink-2 hover:bg-hover">
          {placeholder ?? "What's on your mind?"}
        </Link>
        <Link href={href + (href.includes("?") ? "&" : "?") + "photo=1"} className="p-1 text-green-600">
          <ImageIcon size={26} />
        </Link>
      </div>
    </div>
  );
}

const FEELINGS = ["happy", "blessed", "excited", "tired", "grateful", "hungry", "motivated", "nostalgic", "stressed", "proud"];
const SAMPLE_PHOTOS = ["sunset-river", "coffee-table", "concert-crowd", "trail-morning", "taco-plate", "study-desk", "city-night", "friends-laughing"];

/** Full composer screen. groupId scopes the post to a group. */
export function ComposerScreen({ groupId, groupName }: { groupId?: string; groupName?: string }) {
  const router = useRouter();
  const { data: me } = useMe();
  const [text, setText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [feeling, setFeeling] = useState<string | undefined>();
  const [location, setLocation] = useState<string | undefined>();
  const [audience, setAudience] = useState<"friends" | "public">(groupId ? "public" : "friends");
  const [panel, setPanel] = useState<"photo" | "feeling" | "ai" | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiIdeas, setAiIdeas] = useState<string[]>([]);

  async function post() {
    if (!text.trim() && !images.length) return;
    setBusy(true);
    await api("/api/posts", { method: "POST", json: { text, images, feeling, location, groupId, audience } });
    await Promise.all([refresh("/api/feed"), refresh("/api/groups"), refresh("/api/users")]);
    router.replace(groupId ? `/groups/${groupId}` : "/");
  }

  async function helpWrite(tone: string) {
    setAiBusy(true);
    try {
      const r = await api<{ suggestions: string[] }>("/api/ai/compose", { method: "POST", json: { draft: text, tone, groupId } });
      setAiIdeas(r.suggestions);
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-white">
      <header className="safe-top sticky top-0 z-10 border-b border-line/60 bg-white">
        <div className="flex h-14 items-center justify-between px-3">
          <button onClick={() => router.back()} className="rounded-full p-2 hover:bg-hover" aria-label="Close">
            <X size={22} />
          </button>
          <span className="text-[17px] font-bold">{groupId ? "Create post" : "Create post"}</span>
          <Button onClick={post} disabled={busy || (!text.trim() && !images.length)} className="px-4 py-1.5">
            Post
          </Button>
        </div>
      </header>

      <div className="flex-1 px-4 pt-3">
        <div className="flex items-center gap-2.5">
          {me && <Avatar src={me.avatar} name={me.name} size={40} />}
          <div>
            <div className="text-[15px] font-semibold">
              {me?.name}
              {feeling && <span className="font-normal text-ink-2"> is feeling {feeling}</span>}
              {location && <span className="font-normal text-ink-2"> at <b className="font-semibold text-ink">{location}</b></span>}
            </div>
            {groupId ? (
              <div className="mt-0.5 inline-flex items-center gap-1 rounded-md bg-[#e4e6eb] px-2 py-0.5 text-[12px] font-semibold"><Users size={12} /> {groupName ?? "Group"}</div>
            ) : (
              <button onClick={() => setAudience(audience === "friends" ? "public" : "friends")} className="mt-0.5 inline-flex items-center gap-1 rounded-md bg-[#e4e6eb] px-2 py-0.5 text-[12px] font-semibold">
                {audience === "friends" ? <Users size={12} /> : <Globe size={12} />} {audience === "friends" ? "Friends" : "Public"} <ChevronDown size={12} />
              </button>
            )}
          </div>
        </div>
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={groupId ? "Write something…" : "What's on your mind?"}
          className="mt-3 min-h-[160px] w-full resize-none text-[20px] leading-snug outline-none placeholder:text-ink-2"
        />
        {images.length > 0 && (
          <div className="grid grid-cols-2 gap-1">
            {images.map((src) => (
              <div key={src} className="relative">
                <Photo src={src} className="h-40 w-full rounded-lg object-cover" />
                <button onClick={() => setImages(images.filter((i) => i !== src))} className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {aiIdeas.length > 0 && (
          <div className="mt-3 space-y-2 rounded-xl bg-[#f0f2f5] p-3">
            <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-2"><Sparkles size={14} className="text-fb" /> Suggestions</div>
            {aiIdeas.map((s, i) => (
              <button key={i} onClick={() => setText(s)} className="block w-full rounded-lg bg-white px-3 py-2 text-left text-[14px] leading-snug hover:bg-[#e7f3ff]">
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {panel === "photo" && (
        <div className="border-t border-line/60 p-3">
          <div className="mb-2 text-[13px] font-semibold text-ink-2">Camera roll</div>
          <div className="grid grid-cols-4 gap-1">
            {SAMPLE_PHOTOS.map((s) => {
              const src = photoUrl(s, 600, 600);
              const on = images.includes(src);
              return (
                <button key={s} onClick={() => setImages(on ? images.filter((i) => i !== src) : [...images, src])} className={cx("relative aspect-square overflow-hidden rounded-md", on && "ring-2 ring-fb")}>
                  <Photo src={src} className="h-full w-full object-cover" />
                  {on && <span className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-fb text-[11px] font-bold text-white">{images.indexOf(src) + 1}</span>}
                </button>
              );
            })}
          </div>
          <input
            placeholder="…or paste an image URL and press Enter"
            className="mt-2 w-full rounded-lg bg-[#f0f2f5] px-3 py-2 text-[13px] outline-none"
            onKeyDown={(e) => {
              const v = (e.target as HTMLInputElement).value.trim();
              if (e.key === "Enter" && v) {
                setImages([...images, v]);
                (e.target as HTMLInputElement).value = "";
              }
            }}
          />
        </div>
      )}
      {panel === "feeling" && (
        <div className="border-t border-line/60 p-3">
          <div className="mb-2 text-[13px] font-semibold text-ink-2">How are you feeling?</div>
          <div className="flex flex-wrap gap-2">
            {FEELINGS.map((f) => (
              <button key={f} onClick={() => setFeeling(feeling === f ? undefined : f)} className={cx("rounded-full px-3 py-1.5 text-[14px] font-medium", feeling === f ? "bg-[#e7f3ff] text-fb" : "bg-[#f0f2f5]")}>
                {f}
              </button>
            ))}
          </div>
          <input value={location ?? ""} onChange={(e) => setLocation(e.target.value || undefined)} placeholder="Add a location" className="mt-3 w-full rounded-lg bg-[#f0f2f5] px-3 py-2 text-[14px] outline-none" />
        </div>
      )}
      {panel === "ai" && (
        <div className="border-t border-line/60 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-ink-2"><Sparkles size={14} className="text-fb" /> Help me write {text ? "(rewrites your draft)" : "(suggests ideas from your recent activity)"}</div>
          <div className="flex flex-wrap gap-2">
            {["casual", "funny", "hype", "heartfelt", "shorter"].map((t) => (
              <button key={t} disabled={aiBusy} onClick={() => helpWrite(t)} className="rounded-full bg-[#e7f3ff] px-3 py-1.5 text-[14px] font-semibold text-fb disabled:opacity-50">
                {aiBusy ? "…" : t}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="sticky bottom-0 flex items-center justify-around border-t border-line/60 bg-white py-1">
        <button onClick={() => setPanel(panel === "photo" ? null : "photo")} className={cx("flex items-center gap-1.5 rounded-lg px-3 py-2 text-[14px] font-semibold", panel === "photo" ? "bg-hover" : "")}>
          <ImageIcon size={22} className="text-green-600" /> Photo
        </button>
        <button onClick={() => setPanel(panel === "feeling" ? null : "feeling")} className={cx("flex items-center gap-1.5 rounded-lg px-3 py-2 text-[14px] font-semibold", panel === "feeling" ? "bg-hover" : "")}>
          <Smile size={22} className="text-yellow-500" /> Feeling
        </button>
        <button onClick={() => setPanel(panel === "feeling" ? null : "feeling")} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[14px] font-semibold">
          <MapPin size={22} className="text-red-500" /> Check in
        </button>
        <button onClick={() => setPanel(panel === "ai" ? null : "ai")} className={cx("flex items-center gap-1.5 rounded-lg px-3 py-2 text-[14px] font-semibold", panel === "ai" ? "bg-hover" : "")}>
          <Sparkles size={22} className="text-fb" /> AI
        </button>
      </div>
    </div>
  );
}

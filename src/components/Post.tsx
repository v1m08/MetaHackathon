"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Globe, MessageCircle, MoreHorizontal, Send, Share2, ThumbsUp, Users } from "lucide-react";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { useSession } from "@/lib/session";
import type { HydratedComment, HydratedPost } from "@/server/db";
import type { ReactionType } from "@/types";
import { Avatar, Photo, Sheet, cx } from "./ui";

export const REACTIONS: { type: ReactionType; emoji: string; label: string; color: string }[] = [
  { type: "like", emoji: "👍", label: "Like", color: "text-fb" },
  { type: "love", emoji: "❤️", label: "Love", color: "text-[#f33e58]" },
  { type: "care", emoji: "🥰", label: "Care", color: "text-[#f7b125]" },
  { type: "haha", emoji: "😆", label: "Haha", color: "text-[#f7b125]" },
  { type: "wow", emoji: "😮", label: "Wow", color: "text-[#f7b125]" },
  { type: "sad", emoji: "😢", label: "Sad", color: "text-[#f7b125]" },
  { type: "angry", emoji: "😡", label: "Angry", color: "text-[#e9710f]" },
];

export function ImageGrid({ images, onOpen }: { images: string[]; onOpen?: (i: number) => void }) {
  if (!images.length) return null;
  const n = images.length;
  if (n === 1) return <Photo src={images[0]} className="max-h-[480px] w-full cursor-pointer object-cover" />;
  return (
    <div className={cx("grid gap-0.5", n === 2 ? "grid-cols-2" : "grid-cols-2")}>
      {images.slice(0, 4).map((src, i) => (
        <div key={i} className={cx("relative", n === 3 && i === 0 && "col-span-2")} onClick={() => onOpen?.(i)}>
          <Photo src={src} className={cx("w-full object-cover", n === 3 && i === 0 ? "h-64" : "h-48")} />
          {i === 3 && n > 4 && <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-2xl font-bold text-white">+{n - 4}</div>}
        </div>
      ))}
    </div>
  );
}

function ReactionSummary({ post }: { post: HydratedPost }) {
  const present = REACTIONS.filter((r) => (post.reactions[r.type]?.length ?? 0) > 0)
    .sort((a, b) => (post.reactions[b.type]?.length ?? 0) - (post.reactions[a.type]?.length ?? 0))
    .slice(0, 3);
  if (!post.reactionCount && !post.commentCount && !post.shares) return null;
  return (
    <div className="flex items-center justify-between px-4 py-2 text-[15px] text-ink-2">
      <span className="flex items-center gap-1.5">
        {present.length > 0 && (
          <span className="flex -space-x-1">
            {present.map((r) => (
              <span key={r.type} className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-white text-[12px] shadow-sm">
                {r.emoji}
              </span>
            ))}
          </span>
        )}
        {post.reactionCount > 0 && <span>{post.reactionCount}</span>}
      </span>
      <span className="flex gap-3">
        {post.commentCount > 0 && <span>{post.commentCount} comments</span>}
        {post.shares > 0 && <span>{post.shares} shares</span>}
      </span>
    </div>
  );
}

export function PostCard({ post, onChange, compact }: { post: HydratedPost; onChange?: (p: HydratedPost) => void; compact?: boolean }) {
  const { userId } = useSession();
  const [local, setLocal] = useState<HydratedPost | null>(null);
  useEffect(() => setLocal(null), [post]);
  const [comments, setComments] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [picker, setPicker] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const p = local && local.id === post.id ? local : post;

  const mine = REACTIONS.find((r) => p.reactions[r.type]?.includes(userId));

  async function react(type: ReactionType) {
    setPicker(false);
    // optimistic
    const next = structuredClone(p);
    for (const r of REACTIONS) next.reactions[r.type] = (next.reactions[r.type] ?? []).filter((id) => id !== userId);
    if (mine?.type !== type) next.reactions[type] = [...(next.reactions[type] ?? []), userId];
    next.reactionCount = Object.values(next.reactions).reduce((n, a) => n + (a?.length ?? 0), 0);
    setLocal(next);
    const saved = await api<HydratedPost>(`/api/posts/${p.id}/react`, { method: "POST", json: { type } });
    setLocal(saved);
    onChange?.(saved);
  }

  const startHold = () => {
    holdTimer.current = setTimeout(() => setPicker(true), 420);
  };
  const endHold = (tap: boolean) => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (tap && !picker) react(mine?.type ?? "like");
  };

  const long = p.text.length > 280 && !expanded;
  const text = long ? p.text.slice(0, 260).trimEnd() + "…" : p.text;

  return (
    <article className="relative mb-2 bg-white">
      <header className="flex items-start gap-2.5 px-4 pt-3 pb-2">
        <Link href={`/profile/${p.author.id}`}>
          <Avatar src={p.author.avatar} name={p.author.name} size={40} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] leading-tight">
            <Link href={`/profile/${p.author.id}`} className="font-semibold hover:underline">
              {p.author.name}
            </Link>
            {p.group && !compact && (
              <>
                <span className="text-ink-2"> ▸ </span>
                <Link href={`/groups/${p.group.id}`} className="font-semibold hover:underline">
                  {p.group.name}
                </Link>
              </>
            )}
            {p.feeling && <span className="text-ink-2"> is {p.feeling}</span>}
            {p.tagged && p.tagged.length > 0 && (
              <span className="text-ink-2">
                {" "}is with <b className="font-semibold text-ink">{p.tagged[0].name}</b>
                {p.tagged.length > 1 && <> and {p.tagged.length - 1} others</>}
              </span>
            )}
            {p.location && <span className="text-ink-2"> at <b className="font-semibold text-ink">{p.location}</b></span>}
          </div>
          <div className="flex items-center gap-1 text-[13px] text-ink-2">
            <span>{timeAgo(p.createdAt)}</span>
            <span>·</span>
            {p.group ? <Users size={12} /> : p.audience === "public" ? <Globe size={12} /> : <Users size={12} />}
          </div>
        </div>
        <button className="rounded-full p-1.5 text-ink-2 hover:bg-hover" aria-label="More">
          <MoreHorizontal size={20} />
        </button>
      </header>

      {p.text && (
        <div className="px-4 pb-3 text-[15px] leading-[1.35] whitespace-pre-wrap">
          {text}
          {long && (
            <button className="ml-1 font-semibold text-ink-2" onClick={() => setExpanded(true)}>
              See more
            </button>
          )}
        </div>
      )}
      {p.images && <ImageGrid images={p.images} />}

      <ReactionSummary post={p} />

      <div className="relative mx-4 flex border-t border-line/60">
        {picker && (
          <div className="pop absolute -top-14 left-0 z-10 flex gap-1 rounded-full bg-white px-2 py-1.5 shadow-lg ring-1 ring-black/5" onMouseLeave={() => setPicker(false)}>
            {REACTIONS.map((r) => (
              <button key={r.type} onClick={() => react(r.type)} className="text-[28px] transition hover:-translate-y-1.5 hover:scale-125" aria-label={r.label}>
                {r.emoji}
              </button>
            ))}
          </div>
        )}
        <button
          className={cx("flex flex-1 items-center justify-center gap-2 py-2.5 text-[15px] font-semibold select-none", mine ? mine.color : "text-ink-2")}
          onPointerDown={startHold}
          onPointerUp={() => endHold(true)}
          onPointerLeave={() => endHold(false)}
          onContextMenu={(e) => e.preventDefault()}
        >
          {mine ? <span className="text-[18px] leading-none">{mine.emoji}</span> : <ThumbsUp size={19} />}
          {mine?.label ?? "Like"}
        </button>
        <button className="flex flex-1 items-center justify-center gap-2 py-2.5 text-[15px] font-semibold text-ink-2" onClick={() => setComments(true)}>
          <MessageCircle size={19} /> Comment
        </button>
        <button
          className="flex flex-1 items-center justify-center gap-2 py-2.5 text-[15px] font-semibold text-ink-2"
          onClick={() => {
            setToast("Shared to your story");
            setTimeout(() => setToast(null), 1500);
          }}
        >
          <Share2 size={19} /> Share
        </button>
      </div>
      {toast && <div className="pop absolute bottom-14 left-1/2 -translate-x-1/2 rounded-full bg-black/80 px-3 py-1.5 text-[13px] text-white">{toast}</div>}

      <CommentsSheet
        open={comments}
        onClose={() => setComments(false)}
        post={p}
        onChange={(np) => {
          setLocal(np);
          onChange?.(np);
        }}
      />
    </article>
  );
}

function CommentRow({ c, onReply }: { c: HydratedComment; onReply: (c: HydratedComment) => void }) {
  return (
    <div className="flex gap-2 px-4 py-1.5">
      <Link href={`/profile/${c.author.id}`}>
        <Avatar src={c.author.avatar} name={c.author.name} size={32} />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="inline-block max-w-full rounded-2xl bg-[#f0f2f5] px-3 py-2">
          <div className="text-[13px] font-semibold">{c.author.name}</div>
          <div className="text-[15px] leading-snug">{c.text}</div>
        </div>
        <div className="mt-0.5 flex gap-4 pl-3 text-[12px] font-semibold text-ink-2">
          <span>{timeAgo(c.createdAt)}</span>
          <button>Like</button>
          <button onClick={() => onReply(c)}>Reply</button>
          {c.likes.length > 0 && <span className="ml-auto flex items-center gap-1 font-normal">{c.likes.length} 👍</span>}
        </div>
        {c.replies?.map((r) => (
          <div key={r.id} className="mt-1 flex gap-2">
            <Avatar src={r.author.avatar} name={r.author.name} size={24} />
            <div>
              <div className="inline-block rounded-2xl bg-[#f0f2f5] px-3 py-1.5">
                <div className="text-[12px] font-semibold">{r.author.name}</div>
                <div className="text-[14px] leading-snug">{r.text}</div>
              </div>
              <div className="pl-3 text-[12px] font-semibold text-ink-2">{timeAgo(r.createdAt)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CommentsSheet({ open, onClose, post, onChange }: { open: boolean; onClose: () => void; post: HydratedPost; onChange: (p: HydratedPost) => void }) {
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<HydratedComment | null>(null);
  const [busy, setBusy] = useState(false);
  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    const np = await api<HydratedPost>(`/api/posts/${post.id}/comments`, { method: "POST", json: { text, parentId: replyTo?.id } });
    onChange(np);
    setText("");
    setReplyTo(null);
    setBusy(false);
  }
  return (
    <Sheet open={open} onClose={onClose} title={`${post.commentCount} comments`} full>
      <div className="flex h-full flex-col">
        <div className="flex-1 py-2">
          {post.comments.length === 0 && <div className="py-12 text-center text-[15px] text-ink-2">No comments yet. Be the first.</div>}
          {post.comments.map((c) => (
            <CommentRow key={c.id} c={c} onReply={setReplyTo} />
          ))}
        </div>
        <div className="sticky bottom-0 border-t border-line/60 bg-white p-2">
          {replyTo && (
            <div className="flex items-center justify-between px-2 pb-1 text-[12px] text-ink-2">
              <span>Replying to {replyTo.author.name}</span>
              <button onClick={() => setReplyTo(null)} className="font-semibold">Cancel</button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Write a comment…" className="flex-1 rounded-full bg-[#f0f2f5] px-4 py-2.5 text-[15px] outline-none" />
            <button onClick={send} disabled={busy || !text.trim()} className="p-2 text-fb disabled:opacity-40" aria-label="Send">
              <Send size={22} />
            </button>
          </div>
        </div>
      </div>
    </Sheet>
  );
}

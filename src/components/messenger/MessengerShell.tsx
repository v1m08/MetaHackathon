"use client";
// Messenger chrome: the blue wordmark header (or back + title on inner pages). The app opens on Messenger (`/` is
// Chats); the Facebook button leads back to the feed.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Facebook, PenSquare } from "lucide-react";
import { cx } from "@/components/ui";

function Header({ title, back }: { title?: string; back?: boolean }) {
  const router = useRouter();
  return (
    <header className="safe-top sticky top-0 z-40 bg-white">
      <div className="flex h-14 items-center justify-between px-3">
        {back ? (
          <span className="flex min-w-0 items-center gap-1">
            <button onClick={() => router.back()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-messenger hover:bg-hover" aria-label="Back">
              <ArrowLeft size={22} />
            </button>
            <span className="truncate text-[17px] font-bold">{title}</span>
          </span>
        ) : (
          <span className="pl-1 text-[26px] font-extrabold tracking-[-0.03em] text-messenger select-none">messenger</span>
        )}
        <div className="flex items-center gap-2">
          <Link href="/feed" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e4e6eb] text-fb" aria-label="Facebook">
            <Facebook size={19} />
          </Link>
          <Link href="/messages" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e4e6eb]" aria-label="New message">
            <PenSquare size={18} />
          </Link>
        </div>
      </div>
    </header>
  );
}

/** A Messenger page: header (wordmark, or back + title) + scrollable content. */
export function MessengerShell({ children, title, back, className }: { children: React.ReactNode; title?: string; back?: boolean; className?: string }) {
  return (
    <div className="flex min-h-full flex-col bg-white">
      <Header title={title} back={back} />
      <main className={cx("flex-1 safe-bottom", className)}>{children}</main>
    </div>
  );
}

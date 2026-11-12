"use client";
// Small shared primitives. Keep these dumb; surfaces compose them.
import Link from "next/link";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

const palette = ["#1877f2", "#e4405f", "#8b5cf6", "#f59e0b", "#10b981", "#0ea5e9", "#ef4444", "#14b8a6"];
export function Avatar({ src, name, size = 40, ring, online, className }: { src?: string; name: string; size?: number; ring?: boolean; online?: boolean; className?: string }) {
  const [broken, setBroken] = useState(false);
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const color = palette[name.charCodeAt(0) % palette.length];
  return (
    <span className={cx("relative inline-block shrink-0", className)} style={{ width: size, height: size }}>
      <span className={cx("block h-full w-full overflow-hidden rounded-full bg-gray-200", ring && "ring-[3px] ring-fb ring-offset-2 ring-offset-white")}>
        {src && !broken ? (
          <img src={src} alt={name} className="h-full w-full object-cover" onError={() => setBroken(true)} loading="lazy" />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-semibold text-white" style={{ background: color, fontSize: size * 0.38 }}>
            {initials}
          </span>
        )}
      </span>
      {online && <span className="absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-white bg-green-500" />}
    </span>
  );
}

export function Photo({ src, alt = "", className, style }: { src: string; alt?: string; className?: string; style?: React.CSSProperties }) {
  const [broken, setBroken] = useState(false);
  if (broken) return <div className={cx("bg-gradient-to-br from-gray-300 to-gray-400", className)} style={style} />;
  return <img src={src} alt={alt} className={className} style={style} onError={() => setBroken(true)} loading="lazy" />;
}

export function Button({ variant = "primary", className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const base = "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[15px] font-semibold transition active:scale-[.98] disabled:opacity-50";
  const v = {
    primary: "bg-fb text-white hover:bg-fb-dark",
    secondary: "bg-[#e4e6eb] text-ink hover:bg-[#d8dadf]",
    ghost: "text-ink-2 hover:bg-hover",
    danger: "bg-red-500 text-white",
  }[variant];
  return <button className={cx(base, v, className)} {...props} />;
}

export function Card({ className, children, onClick }: { className?: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <div className={cx("bg-white", className)} onClick={onClick}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, action, href }: { children: React.ReactNode; action?: string; href?: string }) {
  return (
    <div className="flex items-center justify-between px-4 pt-3 pb-2">
      <h2 className="text-[17px] font-bold">{children}</h2>
      {action && (href ? <Link href={href} className="text-[15px] font-medium text-fb">{action}</Link> : <span className="text-[15px] font-medium text-fb">{action}</span>)}
    </div>
  );
}

export function Pill({ active, children, onClick }: { active?: boolean; children: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={cx("shrink-0 rounded-full px-3.5 py-1.5 text-[15px] font-semibold transition", active ? "bg-[#e7f3ff] text-fb" : "bg-[#e4e6eb] text-ink hover:bg-[#d8dadf]")}>
      {children}
    </button>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton rounded", className)} />;
}

export function PostSkeleton() {
  return (
    <div className="mb-2 bg-white p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-3 w-1/5" />
        </div>
      </div>
      <Skeleton className="mt-4 h-3 w-full" />
      <Skeleton className="mt-2 h-3 w-5/6" />
      <Skeleton className="mt-4 h-52 w-full" />
    </div>
  );
}

/** Bottom sheet. Rendered inside the phone viewport so it respects the frame. */
export function Sheet({ open, onClose, title, children, full }: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode; full?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-[60] flex flex-col justify-end">
      <div className="fadein absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={cx("slideup relative flex flex-col overflow-hidden rounded-t-2xl bg-white", full ? "h-[92%]" : "max-h-[85%]")}>
        <div className="flex items-center justify-between border-b border-line/60 px-4 py-3">
          <span className="w-8" />
          <span className="text-[17px] font-bold">{title}</span>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e4e6eb]">
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function Empty({ icon, title, body }: { icon?: React.ReactNode; title: string; body?: string }) {
  return (
    <div className="flex flex-col items-center px-8 py-16 text-center">
      {icon && <div className="mb-3 text-ink-2">{icon}</div>}
      <div className="text-[17px] font-semibold">{title}</div>
      {body && <div className="mt-1 text-[15px] text-ink-2">{body}</div>}
    </div>
  );
}

/** Renders **bold** segments from notification text. */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return <>{parts.map((p, i) => (p.startsWith("**") ? <b key={i} className="font-semibold">{p.slice(2, -2)}</b> : <span key={i}>{p}</span>))}</>;
}

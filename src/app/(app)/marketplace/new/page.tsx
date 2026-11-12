"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Button } from "@/components/ui";
import { api, refresh } from "@/lib/api";

export default function NewListingPage() {
  const router = useRouter();
  const [f, setF] = useState({ title: "", price: "", category: "Furniture", condition: "Good", description: "", images: "" });
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const input = "w-full rounded-lg border border-line/80 px-3 py-2.5 text-[15px] outline-none focus:border-fb";

  async function submit() {
    setBusy(true);
    const l = await api<{ id: string }>("/api/marketplace", { method: "POST", json: { ...f, price: Number(f.price || 0), images: f.images ? [f.images] : undefined } });
    await refresh("/api/marketplace");
    router.replace(`/marketplace/${l.id}`);
  }
  async function draft() {
    setAiBusy(true);
    try {
      const r = await api<{ title: string; description: string; price: number; category: string }>("/api/ai/listing", { method: "POST", json: { hint: f.title || f.description } });
      setF({ ...f, title: r.title, description: r.description, price: String(r.price), category: r.category });
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <Shell back title="New listing" tabs={false}>
      <div className="space-y-3 bg-white px-4 py-4">
        <div className="rounded-xl bg-[#e7f3ff] p-3 text-[14px]">
          <div className="flex items-center gap-1.5 font-semibold text-fb"><Sparkles size={15} /> Draft with AI</div>
          <div className="mt-0.5 text-ink-2">Type a few words in the title (e.g. &quot;old road bike, scratched&quot;) and let AI write the listing.</div>
          <Button variant="secondary" className="mt-2" onClick={draft} disabled={aiBusy}>{aiBusy ? "Drafting…" : "Draft listing"}</Button>
        </div>
        <input className={input} placeholder="Title" value={f.title} onChange={set("title")} />
        <input className={input} placeholder="Price" type="number" value={f.price} onChange={set("price")} />
        <select className={input} value={f.category} onChange={set("category")}>
          {["Furniture", "Electronics", "Bikes", "Sporting Goods", "Clothing", "Plants", "Books", "Tickets", "Musical Instruments", "Misc"].map((c) => <option key={c}>{c}</option>)}
        </select>
        <select className={input} value={f.condition} onChange={set("condition")}>
          {["New", "Like new", "Good", "Fair"].map((c) => <option key={c}>{c}</option>)}
        </select>
        <textarea className={input + " min-h-[120px]"} placeholder="Description" value={f.description} onChange={set("description")} />
        <input className={input} placeholder="Image URL (optional, a placeholder is used otherwise)" value={f.images} onChange={set("images")} />
        <Button className="w-full" onClick={submit} disabled={busy || !f.title}>Publish</Button>
      </div>
    </Shell>
  );
}

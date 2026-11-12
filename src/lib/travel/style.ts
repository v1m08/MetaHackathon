// "Your travel style": Muse reads ONLY the user's own content (their posts, their Reels, what they liked and saved,
// their stated interests) and proposes a few lines, each tied to the evidence it came from. Code verifies every
// evidence id is the user's own content and that the quoted evidence really appears there; lines that fail are
// dropped. The user edits or deletes lines; nothing is learned silently. Other agents never see this raw: they get
// `styleConclusions()`, the edited lines only, no evidence, no ids.
import { ai } from "@/lib/ai";
import { db, getUser } from "@/server/db";
import type { ID } from "@/types";
import { travelStore, type StyleLine, type TravelStyle } from "./store";

interface OwnItem { id: string; kind: "post" | "reel" | "liked reel" | "saved reel" | "reaction" | "interest" | "bio"; text: string }

/** The user's own content and own actions, and nothing else. */
export function ownContent(userId: ID): OwnItem[] {
  const me = getUser(userId);
  if (!me) return [];
  const d = db();
  const items: OwnItem[] = [];
  items.push({ id: `bio:${userId}`, kind: "bio", text: me.bio });
  me.interests.forEach((t, i) => items.push({ id: `interest:${i}`, kind: "interest", text: t }));
  d.posts.filter((p) => p.authorId === userId && !p.groupId).slice(0, 25).forEach((p) => items.push({ id: p.id, kind: "post", text: `${p.text}${p.location ? ` (at ${p.location})` : ""}${p.feeling ? ` (feeling ${p.feeling})` : ""}` }));
  d.reels.filter((r) => r.authorId === userId).slice(0, 10).forEach((r) => items.push({ id: r.id, kind: "reel", text: r.caption }));
  d.reels.filter((r) => r.savedBy.includes(userId) && r.authorId !== userId).slice(0, 12).forEach((r) => items.push({ id: r.id, kind: "saved reel", text: r.caption }));
  d.reels.filter((r) => r.likes.includes(userId) && !r.savedBy.includes(userId) && r.authorId !== userId).slice(0, 12).forEach((r) => items.push({ id: r.id, kind: "liked reel", text: r.caption }));
  d.posts.filter((p) => p.authorId !== userId && (Object.values(p.reactions).some((ids) => ids?.includes(userId)) || p.comments.some((c) => c.authorId === userId))).slice(0, 12).forEach((p) => {
    const mine = p.comments.find((c) => c.authorId === userId);
    items.push({ id: p.id, kind: "reaction", text: mine ? `you commented "${mine.text}" on: ${p.text.slice(0, 160)}` : `you reacted to: ${p.text.slice(0, 160)}` });
  });
  return items;
}

const SCHEMA = {
  type: "object",
  properties: {
    lines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string", description: "2-3 words, e.g. 'Food-first', 'Early riser', 'Low-key evenings', 'Up for anything'." },
          text: { type: "string", description: "One sentence, second person, about how they travel. Only what the evidence supports." },
          evidence: { type: "string", description: "A short phrase copied word for word from ONE of the items (max 12 words)." },
          sourceIds: { type: "array", items: { type: "string" }, description: "Ids of the items this line rests on (1-3). Must come from the list." },
        },
        required: ["label", "text", "evidence", "sourceIds"],
      },
    },
  },
  required: ["lines"],
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
/** Does the quote appear in the item text (exact after normalisation, or ≥70% of its words in order-insensitive overlap)? */
function quoteIn(quote: string, text: string) {
  const q = norm(quote), t = norm(text);
  if (!q) return false;
  if (t.includes(q)) return true;
  const qw = q.split(" ").filter((w) => w.length > 2);
  if (qw.length < 2) return false;
  const hit = qw.filter((w) => t.includes(w)).length;
  return hit / qw.length >= 0.7;
}

export const getStyle = (userId: ID) => travelStore().styles.get(userId) ?? null;

export async function inferTravelStyle(userId: ID): Promise<TravelStyle> {
  const me = getUser(userId);
  if (!me) throw Object.assign(new Error("unknown user"), { status: 404 });
  const items = ownContent(userId);
  const byId = new Map(items.map((i) => [i.id, i]));
  const list = items.map((i) => `[${i.id}] (${i.kind}) ${i.text}`).join("\n");
  const { data, trace } = await ai.json<{ lines: Omit<StyleLine, "id">[] }>(
    `Here is everything ${me.name.split(" ")[0]} has posted, saved, liked or written about themselves on this app. Propose 4-6 "travel style" lines: how this person likes to travel (pace, mornings vs nights, food, outdoors, social vs low-key, budget, what they photograph). Each line must rest on specific items and quote one of them exactly. If the evidence is thin, write fewer lines. Never guess about relationships, health, money problems or anything that isn't about travelling.\n\nITEMS\n${list}`,
    { task: "travel.style", userId, schema: SCHEMA, maxTokens: 1500, temperature: 0.4, cache: false, mock: () => ({ lines: [{ label: "Food-first", text: "(mock) you plan days around meals.", evidence: items.find((i) => /food|taco|cook/i.test(i.text))?.text.slice(0, 40) ?? me.bio.slice(0, 30), sourceIds: [items.find((i) => /food|taco|cook/i.test(i.text))?.id ?? items[0].id] }] }) },
  );
  const lines: StyleLine[] = [];
  const dropped: string[] = [];
  for (const [i, l] of (data.lines ?? []).entries()) {
    const ids = (Array.isArray(l.sourceIds) ? l.sourceIds : []).filter((id) => byId.has(id)).slice(0, 3);
    const src = ids.map((id) => byId.get(id)!);
    const quoted = src.find((s) => quoteIn(l.evidence ?? "", s.text)) ?? items.find((s) => quoteIn(l.evidence ?? "", s.text));
    if (!ids.length || !quoted || !l.text || !l.label) { dropped.push(l.label ?? `line ${i}`); continue; }
    if (!ids.includes(quoted.id)) ids.unshift(quoted.id);
    lines.push({ id: `sl_${Date.now().toString(36)}${i}`, label: String(l.label).slice(0, 32), text: String(l.text).slice(0, 220), evidence: `${quoted.kind}: "${String(l.evidence).slice(0, 120)}"`, sourceIds: ids });
  }
  const style: TravelStyle = { userId, lines: lines.slice(0, 6), generatedAt: new Date().toISOString(), mode: trace.mode + (dropped.length ? ` · dropped ${dropped.length} unsupported` : ""), costUsd: trace.costUsd ?? 0, model: trace.model, consideredIds: items.map((i) => i.id) };
  travelStore().styles.set(userId, style);
  return style;
}

export function editStyle(userId: ID, patch: { lines?: { id: string; text?: string; label?: string }[]; remove?: string[] }) {
  const s = getStyle(userId);
  if (!s) throw Object.assign(new Error("no travel style yet"), { status: 404 });
  if (patch.remove?.length) s.lines = s.lines.filter((l) => !patch.remove!.includes(l.id));
  for (const p of patch.lines ?? []) {
    const l = s.lines.find((x) => x.id === p.id);
    if (!l) continue;
    if (typeof p.text === "string") l.text = p.text.slice(0, 220);
    if (typeof p.label === "string") l.label = p.label.slice(0, 32);
    l.edited = true;
  }
  return s;
}
export function clearStyle(userId: ID) { travelStore().styles.delete(userId); }

/** What another agent is allowed to know: the lines as the user left them. No evidence, no ids, no raw content. */
export function styleConclusions(userId: ID): string[] {
  const s = getStyle(userId);
  return s ? s.lines.map((l) => `${l.label}: ${l.text}`) : [];
}

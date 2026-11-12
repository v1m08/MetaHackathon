// Availability from real signals, not a seeded calendar. For one person, as seen by one requester, over a few
// dates: code gathers what the requester could already read (the person's event RSVPs, their visible posts, and
// the requester's OWN conversations with that person; never anyone's chats with third parties), Muse extracts
// dated statements the person made about themselves, with quotes, and code makes the final call per date.
// Confirmation never comes from inference: it comes from asking ("Around Dec 4–6?") and reading the reply.
import { cityById } from "@/data/cities";
import { weekendDates, weekendLabel } from "@/data/travel";
import { ai } from "@/lib/ai";
import { db, getUser } from "@/server/db";
import type { ID } from "@/types";
import { travelStore, type Availability, type DayAvailability, type DayStatus } from "./store";
import { datesBetween } from "./tools";
import { canSeePost } from "./visibility";

interface Signal { id: string; kind: "rsvp" | "post" | "chat" | "reply"; when: string; text: string; /** code-known dates (RSVPs) */ dates?: string[]; away?: boolean; eventCity?: string }

const fmtDay = (d: string) => new Date(d + "T12:00:00").toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric" });

/** Everything the requester is allowed to read that could say where this person will be. */
/** `context` = the trip's city: an RSVP there is "present", not "away". */
export function gatherSignals(requesterId: ID, personId: ID, dates: string[], context?: string): Signal[] {
  const person = getUser(personId);
  if (!person) return [];
  const d = db();
  const out: Signal[] = [];
  // 1. RSVPs: code knows the dates. Away from home city = busy; in town = a mild "around" signal.
  for (const e of d.events) {
    if (!e.going.includes(personId)) continue;
    const evDates = datesBetween(e.startsAt.slice(0, 10), (e.endsAt ?? e.startsAt).slice(0, 10)).filter((x) => dates.includes(x));
    if (!evDates.length) continue;
    const away = !!e.city && !!person.city && e.city !== person.city && e.city !== context;
    out.push({ id: e.id, kind: "rsvp", when: e.startsAt, text: `RSVP'd going: ${e.title} (${e.location}${e.city ? `, ${cityById(e.city)?.name ?? e.city}` : ""}) on ${fmtDay(e.startsAt.slice(0, 10))}`, dates: evDates, away, eventCity: e.city });
  }
  // 2. The person's own posts the requester can see (home feed rules), newest first, recent only.
  const cutoff = Date.now() - 45 * 86_400_000;
  for (const p of d.posts) {
    if (p.authorId !== personId || new Date(p.createdAt).getTime() < cutoff) continue;
    if (!canSeePost(requesterId, p)) continue;
    out.push({ id: p.id, kind: "post", when: p.createdAt, text: p.text });
  }
  // 3. Conversations the requester is IN with this person (DMs and group chats they share). Only the person's own
  //    lines are evidence about the person; the requester's lines give context (e.g. the question that was asked).
  for (const c of d.conversations) {
    if (!c.participantIds.includes(requesterId) || !c.participantIds.includes(personId)) continue;
    const msgs = c.messages.filter((m) => m.status !== "draft" && !m.system && m.text).slice(-40);
    msgs.forEach((m, i) => {
      if (m.senderId === personId) {
        const prev = msgs[i - 1];
        const isReply = prev && prev.senderId === requesterId && /around|free|busy|weekend|visit|stay|crash|couch/i.test(prev.text);
        out.push({ id: m.id, kind: isReply ? "reply" : "chat", when: m.createdAt, text: isReply ? `(replying to ${requesterId === "maya" ? "you" : "the requester"}: "${prev.text.slice(0, 120)}") ${m.text}` : m.text });
      }
    });
  }
  return out.sort((a, b) => b.when.localeCompare(a.when)).slice(0, 40);
}

const SCHEMA = {
  type: "object",
  properties: {
    statements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          sourceId: { type: "string" },
          quote: { type: "string", description: "Copied word for word from that source, max 20 words." },
          dates: { type: "array", items: { type: "string" }, description: "YYYY-MM-DD dates from the candidate list this statement covers." },
          status: { type: "string", enum: ["busy", "away", "free"] },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          why: { type: "string", description: "Six words max." },
        },
        required: ["sourceId", "quote", "dates", "status", "confidence", "why"],
      },
    },
  },
  required: ["statements"],
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const quoteIn = (q: string, t: string) => { const a = norm(q), b = norm(t); if (!a) return false; if (b.includes(a)) return true; const w = a.split(" ").filter((x) => x.length > 2); return w.length >= 2 && w.filter((x) => b.includes(x)).length / w.length >= 0.7; };

const sigKey = (sigs: Signal[]) => `${sigs.length}:${sigs.map((s) => s.id).join(",").length}:${sigs[0]?.id ?? ""}`;

/** Code-only quick status (no model): RSVPs and anything already inferred. Used by wide scans; "unknown" is honest. */
export function quickStatus(requesterId: ID, personId: ID, start: string, end: string, context?: string): Availability["overall"] {
  const cached = travelStore().availability.get(`${requesterId}|${personId}|${start}|${context ?? ""}`) ?? travelStore().availability.get(`${requesterId}|${personId}|${start}|`);
  if (cached) return cached.overall;
  const dates = datesBetween(start, end);
  const rs = gatherSignals(requesterId, personId, dates, context).filter((s) => s.kind === "rsvp");
  if (rs.some((s) => s.away)) return "busy";
  return "unknown";
}

export async function inferAvailability(requesterId: ID, personId: ID, start: string, end: string, opts: { force?: boolean; context?: string } = {}): Promise<Availability> {
  const person = getUser(personId);
  if (!person) throw Object.assign(new Error("unknown person"), { status: 404 });
  const dates = datesBetween(start, end);
  const sigs = gatherSignals(requesterId, personId, dates, opts.context);
  const key = sigKey(sigs) + (opts.context ?? "");
  const storeKey = `${requesterId}|${personId}|${start}|${opts.context ?? ""}`;
  const cached = travelStore().availability.get(storeKey);
  if (cached && cached.key === key && !opts.force) return cached;

  const byId = new Map(sigs.map((s) => [s.id, s]));
  const days: Record<string, DayAvailability> = Object.fromEntries(dates.map((d) => [d, { date: d, status: "unknown" as DayStatus, confidence: "low" as const }]));
  const set = (d: string, next: DayAvailability) => {
    const cur = days[d];
    const rank: Record<DayStatus, number> = { busy: 3, confirmed_free: 2, likely_free: 1, unknown: 0 };
    if (!cur || rank[next.status] > rank[cur.status]) days[d] = next;
  };
  // RSVPs: decided by code.
  for (const s of sigs.filter((x) => x.kind === "rsvp")) {
    for (const d of s.dates ?? []) set(d, s.away ? { date: d, status: "busy", reason: `away: ${s.text.replace(/^RSVP'd going: /, "")}`, quote: s.text, source: { kind: "rsvp", id: s.id }, confidence: "high" } : { date: d, status: "likely_free", reason: `${s.eventCity && s.eventCity !== person.city ? "going there too" : "in town"}: ${s.text.replace(/^RSVP'd going: /, "").split(" (")[0]}`, quote: s.text, source: { kind: "rsvp", id: s.id }, confidence: "medium" });
  }
  let mode = "code";
  let costUsd = 0;
  const textual = sigs.filter((x) => x.kind !== "rsvp");
  if (textual.length) {
    const weekends = Array.from({ length: 8 }, (_, i) => `${weekendLabel(i + 1)} = ${weekendDates(i + 1).join(", ")}`).join("; ");
    const { data, trace } = await ai.json<{ statements: { sourceId: string; quote: string; dates: string[]; status: "busy" | "away" | "free"; confidence: "high" | "medium" | "low"; why: string }[] }>(
      `Does ${person.name.split(" ")[0]} say anything about where they will be on these dates: ${dates.map((d) => `${d} (${fmtDay(d)})`).join(", ")}?\nOnly use statements ${person.name.split(" ")[0]} made about THEMSELVES. Ignore other people's plans. "away"/"busy" = not available to host or travel that date; "free" = they say they are around/free/off.${opts.context ? ` The plan in question is a trip to ${cityById(opts.context)?.name ?? opts.context}: if they say they will BE in ${cityById(opts.context)?.name ?? opts.context} (going there, driving there), that is "free" for this purpose, not away.` : ""} Map phrases like "${weekendLabel(2)}" or "thanksgiving weekend" to the candidate dates using this calendar: ${weekends}. Today is ${new Date().toISOString().slice(0, 10)}. If nothing applies, return an empty list.\n\nSOURCES\n${textual.map((s) => `[${s.id}] (${s.kind}, ${new Date(s.when).toLocaleDateString("en-US", { month: "short", day: "numeric" })}) ${s.text}`).join("\n")}`,
      { task: "travel.availability", userId: requesterId, schema: SCHEMA, model: ai.models.fast(), maxTokens: 1500, temperature: 0, mock: () => ({ statements: [] }) },
    );
    mode = trace.mode;
    costUsd = trace.costUsd ?? 0;
    for (const st of data.statements ?? []) {
      const src = byId.get(st.sourceId);
      if (!src || src.kind === "rsvp") continue; // unknown source: drop
      if (!quoteIn(st.quote, src.text)) continue; // quote not in source: drop
      const ds = (Array.isArray(st.dates) ? st.dates : []).filter((d) => dates.includes(d));
      if (!ds.length) continue;
      for (const d of ds) {
        const ctxName = opts.context ? (cityById(opts.context)?.name ?? opts.context).toLowerCase() : "";
        const thereAnyway = !!ctxName && (norm(st.quote).includes(norm(ctxName)) || norm(st.why).includes(norm(ctxName))) && st.status === "away"; // "I'll be in Dallas" is presence for a Dallas trip
        if (st.status === "free" || thereAnyway) set(d, { date: d, status: src.kind === "reply" && st.confidence === "high" ? "confirmed_free" : "likely_free", reason: thereAnyway ? `there that weekend: ${st.why}` : st.why, quote: st.quote, source: { kind: src.kind, id: src.id }, confidence: st.confidence });
        else if (st.confidence !== "low") set(d, { date: d, status: "busy", reason: st.why, quote: st.quote, source: { kind: src.kind, id: src.id }, confidence: st.confidence });
      }
    }
  }
  const list = dates.map((d) => days[d]);
  const overall: Availability["overall"] = list.some((x) => x.status === "busy") ? "busy" : list.every((x) => x.status === "confirmed_free") ? "confirmed" : list.every((x) => x.status === "confirmed_free" || x.status === "likely_free") ? "likely_free" : "unknown";
  const busyDay = list.find((x) => x.status === "busy");
  const summary = overall === "busy" ? `busy ${fmtDay(busyDay!.date)}: ${busyDay!.reason}` : overall === "confirmed" ? `confirmed free (they said so)` : overall === "likely_free" ? `likely free: ${list.find((x) => x.reason)?.reason ?? "no conflicts seen"}` : `unknown: nothing in what you can see says either way`;
  const result: Availability = { personId, requesterId, dates, days: list, overall, summary, mode, costUsd, signalCount: sigs.length, computedAt: new Date().toISOString(), key };
  travelStore().availability.set(storeKey, result);
  return result;
}

/** Several people at once, bounded concurrency. */
export async function inferMany(requesterId: ID, personIds: ID[], start: string, end: string, context?: string) {
  const ids = [...new Set(personIds)].slice(0, 8);
  const out: Availability[] = [];
  for (let i = 0; i < ids.length; i += 4) out.push(...(await Promise.all(ids.slice(i, i + 4).map((id) => inferAvailability(requesterId, id, start, end, { context })))));
  return out;
}

export const LABEL: Record<Availability["overall"], string> = { confirmed: "Confirmed", likely_free: "Likely free", busy: "Busy", unknown: "Unknown → we'll ask" };

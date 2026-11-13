// Writes one game for one chat. Code picks the topic, format, subject and inventory (select.ts); the model writes
// the title, premise and rounds from this chat's own evidence; code then decides what is allowed on screen:
//   - every evidence id must be in the chat's index; a Receipts quote must really be in its source line, and what
//     is shown is cut from the SOURCE's own characters, never the model's string
//   - Receipts options and the right answer are built by code (the model never decides who said it); the title
//     and premise may not name an author either
//   - Lineup options are members chosen by code from what the whole chat can see (never from anyone's scores);
//     negative prompts, titles and premises are refused
//   - Hot Seat may cite only the subject's own lines and may not leak the answer in the question
//   - Wager options are real inventory supplied by code; the model only adds a short pitch, shown apart from the
//     item's own date/price line, and refused if it states a number, price, time or head-count code did not supply.
//     Code's own pitch never says who saved a listing (saves are private)
//   - length caps, the BANNED word list, taxonomy topics only
// One retry with the refusal reasons, then a template game built from store data (also what AI_MODE=mock returns).
// A format code already knows this chat cannot support is never sent to the model.
import { ai } from "@/lib/ai";
import { BANNED } from "@/lib/reconnect/whynow";
import { getConversation } from "@/server/db";
import type { ID } from "@/types";
import { buildContext, quoteIn, type ChatContext } from "./context";
import { quotable, selectGame, type Selection } from "./select";
import { dayKey, FORMAT_LABEL, GROUP_ONLY, pid, type EvidenceItem, type Format, type Option, type PlayGame, type Round, type RoundKind } from "./store";
import { isTopic, topic as topicOf, TOPIC_IDS, type TopicId } from "./taxonomy";

export interface Draft { title?: string; premise?: string; rounds?: DraftRound[] }
export interface DraftRound { prompt?: string; options?: { label?: string; topic?: string; refId?: string; pitch?: string }[]; answerIndex?: number; evidenceIds?: string[]; evidenceId?: string; quote?: string }

export const MIN_ROUNDS: Record<Format, number> = { split: 2, blend: 2, receipts: 3, lineup: 1, hotseat: 2, wager: 1 };
const MAX_ROUNDS: Record<Format, number> = { split: 3, blend: 3, receipts: 4, lineup: 2, hotseat: 3, wager: 1 };
const KIND: Record<Format, RoundKind> = { split: "split", blend: "pick", receipts: "pick", lineup: "rank", hotseat: "pick", wager: "points" };
const CAP = { title: 60, premise: 140, prompt: 160, label: 60, quote: 140, pitch: 90 };
/** Lineup ranks people, so the prompt (and the title and premise that frame it) has to be something nobody minds coming last in. */
export const NEGATIVE = /\b(wors[et]|least|ugl\w+|dumb\w*|stupid\w*|annoying|laz(?:y|ier|iest)|boring|broke|cheap\w*|fail\w*|los(?:e|es|ing|t|ers?)|weak\w*|slow\w*|bad|terrible|hat(?:e|es|ed)|awkward|gross|flak\w+|cring\w+|clueless|useless|quit\w*|bail\w*|late|hungover|drunk\w*|dump(?:ed|s)?|unreliable|mess(?:y|ier|iest)|sloppy|peaked|hott\w+|never|can'?t|cannot|forg[eo]t\w*|embarrass\w*|toxic|creep\w*|desperate)\b/i;
/** Words in a model-written Wager pitch that state a price, a time or who is already in. Code says those, from the item itself. */
const PITCH_FACT = /\b(free|tonight|today|tomorrow|sold out|\d\s*(?:am|pm)|noon|midnight|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|(?:mon|tues|wednes|thurs|fri|satur|sun)day)\b/gi;
const PITCH_COUNT = /\b(all|every|everyone|everybody|each|half|most|majority|both|none|nobody|no one|couple|dozens?|two|three|four|five|six|seven|eight|nine|ten|already|sav(?:e|ed|es|ing)|watching|rsvp\w*|signed up)\b/i;

// ---------- small helpers ----------
const str = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");
const cap1 = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const names = (s: string, first: string) => !!first && new RegExp(`\\b${esc(first)}\\b`, "i").test(s);
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
/** Deterministic shuffle: the same seed always gives the same order. */
function shuffle<T>(list: T[], seed: string): T[] {
  let a = hash(seed) || 1;
  const rnd = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
/** A readable cut of a line: whole words, at most n characters. */
function snip(text: string, n: number) {
  const s = str(text).replace(/["“”]/g, "'");
  if (s.length <= n) return s;
  const cut = s.slice(0, n - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), Math.floor(n / 2))).replace(/[\s,;:.!?-]+$/, "")}…`;
}
/** The same cut without the ellipsis, so it stays a literal substring of the source (Receipts). */
function cutQuote(text: string, n: number) {
  const s = str(text);
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), Math.floor(n / 2))).trim();
}
const firstOf = (ctx: ChatContext, id?: ID) => ctx.members.find((m) => m.id === id)?.first ?? "";
const label = (t: TopicId) => topicOf(t).label;
/** Case-insensitive position of `needle` in `hay`, in `hay`'s own indices (−1 when lower-casing would shift them). */
const spanAt = (hay: string, needle: string) => { const h = hay.toLowerCase(), n = needle.toLowerCase(); return h.length === hay.length && n.length === needle.length ? h.indexOf(n) : hay.indexOf(needle); };

type Item = Selection["items"][number];
/** Code's own one-line Wager pitch, from counts it holds. Never for a listing: who saved one is private. */
function codePitch(it: Item, ctx: ChatContext): string {
  if (it.kind === "listing") return "";
  const n = it.membersIn.length;
  const verb = it.kind === "event" ? "going" : "in";
  if (n === 0) return ctx.members.length === 2 ? "New to both of you" : `New to all ${ctx.members.length} of you`;
  return n === 1 ? `${firstOf(ctx, it.membersIn[0])} is already ${verb}` : `${n} of you already ${verb}`;
}
/** Why a model-written pitch may not be shown, if it states something only code may state. */
function pitchClaim(p: string, it: Item): string | undefined {
  const own = `${it.title} ${it.sub}`.toLowerCase();
  const ownNumbers = new Set(own.match(/\d+/g) ?? []);
  if ((p.match(/\d+/g) ?? []).some((n) => !ownNumbers.has(n)) || (p.includes("$") && !own.includes("$"))) return "states a number or price code did not supply";
  const fact = (p.match(PITCH_FACT) ?? []).find((w) => !own.includes(w.toLowerCase()));
  if (fact) return `states a time or price code did not supply ("${fact}")`;
  const count = p.match(PITCH_COUNT)?.[0];
  return count ? `makes a head-count or attendance claim ("${count}")` : undefined;
}

/** Titles and premises code can stand behind when the model's are missing or refused. */
function fallbackCopy(sel: Selection, ctx: ChatContext): { title: string; premise: string; prompt: string } {
  const l = label(sel.topic);
  const bare = l.replace(/^the /, ""); // "The outdoors split", not "The the outdoors split"
  const who = firstOf(ctx, sel.subjectId) || "someone";
  const n = ctx.members.length;
  const copy: Record<Format, { title: string; premise: string; prompt: string }> = {
    split: { title: `The ${bare} split`, premise: `Pick a side, then call how the ${n === 2 ? "two" : n} of you will split.`, prompt: "" },
    blend: { title: `Build the chat's Saturday`, premise: `One slot each, made from what this chat keeps talking about. See what you build together.`, prompt: "" },
    receipts: { title: `Receipts: who said it?`, premise: `Real lines from this chat and your posts. Match each one to whoever said it.`, prompt: "Who said it?" },
    lineup: { title: `The ${bare} lineup`, premise: `Rank the chat. The result is everyone's order combined.`, prompt: "" },
    hotseat: { title: `Hot Seat: ${who}`, premise: `How well does the chat know ${who}? ${who} gets the final say.`, prompt: "" },
    wager: { title: `10 points on ${l}`, premise: `Three real things you could do. Spread 10 points on what this chat would actually show up for.`, prompt: "Spread 10 points: what would this chat actually do?" },
  };
  return copy[sel.format];
}

// ---------- validation: code decides ----------
type Built = { prompt: string; quote?: string; options: Omit<Option, "id">[]; answerAt?: number; evidenceIds: string[] };

export function validateDraft(sel: Selection, draft: Draft, ctx: ChatContext): { title: string; premise: string; rounds: Round[]; dropped: string[]; evidence: EvidenceItem[] } {
  const dropped: string[] = [];
  const fb = fallbackCopy(sel, ctx);
  const text = (v: unknown, max: number, what: string): string | null => {
    const s = str(v);
    if (!s) { dropped.push(`${what}: missing`); return null; }
    if (s.length > max) { dropped.push(`${what}: over ${max} characters`); return null; }
    const b = s.match(BANNED);
    if (b) { dropped.push(`${what}: banned word "${b[0]}"`); return null; }
    return s;
  };
  const cite = (ids: unknown, what: string): string[] => {
    const out: string[] = [];
    for (const raw of Array.isArray(ids) ? ids : []) {
      const id = String(raw);
      if (!ctx.byId.has(id)) dropped.push(`${what}: evidence id "${id.slice(0, 40)}" is not in this chat's index`);
      else if (!out.includes(id)) out.push(id);
    }
    return out;
  };
  const options = (list: DraftRound["options"], what: string, max: number): Omit<Option, "id">[] => {
    const out: Omit<Option, "id">[] = [];
    (Array.isArray(list) ? list : []).forEach((o, i) => {
      const l = text(o?.label, CAP.label, `${what} option ${i + 1}`);
      if (!l) return;
      if (out.some((x) => x.label.toLowerCase() === l.toLowerCase())) { dropped.push(`${what} option ${i + 1}: duplicate label`); return; }
      if (o?.topic !== undefined && !isTopic(o.topic)) dropped.push(`${what} option ${i + 1}: topic "${String(o.topic).slice(0, 30)}" is not in the taxonomy, using ${sel.topic}`);
      out.push({ label: l, topic: isTopic(o?.topic) ? o.topic : sel.topic });
    });
    return out.slice(0, max);
  };
  const drop = (what: string, why: string) => { dropped.push(`${what} dropped: ${why}`); return null; };

  // Lineup: the title and premise frame what the ranking means, so they are held to the same rule as the prompts.
  const positive = (v: string | null, what: string) => {
    const neg = v && sel.format === "lineup" ? v.match(NEGATIVE) : null;
    if (neg) dropped.push(`${what}: Lineup copy must be positive ("${neg[0]}")`);
    return neg ? null : v;
  };
  let title = positive(text(draft?.title, CAP.title, "title"), "title") ?? fb.title;
  let premise = positive(text(draft?.premise, CAP.premise, "premise"), "premise") ?? fb.premise;
  const raw = Array.isArray(draft?.rounds) ? draft.rounds.filter((r) => r && typeof r === "object") : [];
  const rounds: Round[] = [];
  const extra: EvidenceItem[] = []; // Wager inventory, cited as evidence
  const usedQuotes = new Set<string>();
  const quotables = new Map(quotable(ctx).map((e) => [e.id, e]));
  const memberIds = ctx.members.map((m) => m.id);

  const build: Record<Exclude<Format, "wager">, (r: DraftRound, what: string, rid: string) => Built | null> = {
    split(r, what) {
      const prompt = text(r.prompt, CAP.prompt, `${what} prompt`);
      if (!prompt) return drop(what, "no usable prompt");
      const opts = options(r.options, what, 9);
      if (opts.length !== 2) return drop(what, `a Split needs exactly 2 usable options, got ${opts.length}`);
      const evidenceIds = cite(r.evidenceIds, what);
      if (!evidenceIds.length) return drop(what, "cites nothing from this chat");
      return { prompt, options: opts, evidenceIds };
    },
    blend(r, what) {
      const prompt = text(r.prompt, CAP.prompt, `${what} prompt`);
      if (!prompt) return drop(what, "no usable prompt");
      const opts = options(r.options, what, 4);
      if (opts.length < 3) return drop(what, `a Blend slot needs 3-4 usable options, got ${opts.length}`);
      const evidenceIds = cite(r.evidenceIds, what);
      if (!evidenceIds.length) return drop(what, "cites nothing from this chat");
      return { prompt, options: opts, evidenceIds };
    },
    receipts(r, what, rid) {
      const id = str(r.evidenceId) || str(r.evidenceIds?.[0]);
      const src = quotables.get(id);
      if (!src) return drop(what, ctx.byId.has(id) ? `"${id}" is not a quotable line (a member's message or post, 20-170 characters)` : `evidence id "${id.slice(0, 40)}" is not in this chat's index`);
      if (!src.by || !memberIds.includes(src.by)) return drop(what, "the line is not by a member of this chat");
      if (usedQuotes.has(id)) return drop(what, `"${id}" is already used in another round`);
      const said = text(r.quote, 400, `${what} quote`);
      if (!said) return drop(what, "no quote");
      if (!quoteIn(said, src.text)) return drop(what, `the quote is not in the source line "${id}"`);
      // The model's string only gets the round through the gate. What is shown is the source's own characters: the
      // exact span when the model copied it, otherwise the source line itself, so nothing invented can be attributed.
      const line = str(src.text);
      const lit = spanAt(line, said);
      const quote = cutQuote(lit >= 0 ? line.slice(lit, lit + said.length) : line, CAP.quote);
      const banned = quote.match(BANNED);
      if (banned) return drop(what, `banned word "${banned[0]}" in the source line`);
      if (quote.length < 12) return drop(what, "the quote is too short to recognise");
      const author = firstOf(ctx, src.by);
      if (names(quote, author)) return drop(what, "the quote names its author");
      const prompt = r.prompt === undefined || str(r.prompt) === "" ? fb.prompt : text(r.prompt, CAP.prompt, `${what} prompt`);
      if (!prompt) return drop(what, "no usable prompt");
      if (names(prompt, author)) return drop(what, "the prompt names the author");
      // Code builds the options and the answer. Seeded by round id + source id so the answer's position isn't the same every day.
      const others = shuffle(memberIds.filter((m) => m !== src.by), `${rid}:${id}:others`).slice(0, 3);
      const order = shuffle([src.by, ...others], `${rid}:${id}`);
      usedQuotes.add(id);
      return { prompt, quote, options: order.map((u) => ({ label: firstOf(ctx, u), userId: u })), answerAt: order.indexOf(src.by), evidenceIds: [id] };
    },
    lineup(r, what, rid) {
      const prompt = text(r.prompt, CAP.prompt, `${what} prompt`);
      if (!prompt) return drop(what, "no usable prompt");
      const neg = prompt.match(NEGATIVE);
      if (neg) return drop(what, `Lineup prompts must be positive ("${neg[0]}")`);
      if (ctx.members.length < 3) return drop(what, "a Lineup needs three or more people");
      // Code picks who is ranked: the members with the most lines on the topic that the whole chat can already see.
      // Never by affinity, which would show who scores outside the top five. Then shuffled, so the order says nothing either.
      const seen = (u: ID) => ctx.evidence.filter((e) => e.by === u && e.topics.includes(sel.topic)).length;
      const top = shuffle(memberIds, `${ctx.conversationId}:${sel.topic}:pool`).map((u) => ({ u, n: seen(u) })).sort((x, y) => y.n - x.n).slice(0, 5).map((x) => x.u);
      return { prompt, options: shuffle(top, `${rid}:${sel.topic}`).map((u) => ({ label: firstOf(ctx, u), userId: u, topic: sel.topic })), evidenceIds: cite(r.evidenceIds, what) };
    },
    hotseat(r, what) {
      const subject = sel.subjectId;
      if (!subject || !memberIds.includes(subject)) return drop(what, "no Hot Seat subject in this chat");
      if (ctx.members.length < 3) return drop(what, "a Hot Seat needs three or more people");
      const prompt = text(r.prompt, CAP.prompt, `${what} prompt`);
      if (!prompt) return drop(what, "no usable prompt");
      const all = Array.isArray(r.options) ? r.options : [];
      const ai = r.answerIndex;
      if (typeof ai !== "number" || !Number.isInteger(ai) || ai < 0 || ai >= all.length) return drop(what, "answerIndex does not point at an option");
      const answerLabel = str(all[ai]?.label);
      const opts = options(all, what, 9);
      const answer = opts.find((o) => o.label.toLowerCase() === answerLabel.toLowerCase());
      if (!answer) return drop(what, "the answer option was refused");
      const three = [...opts.filter((o) => o !== answer).slice(0, 2), answer];
      if (three.length !== 3) return drop(what, `Hot Seat needs 3 usable options, got ${opts.length}`);
      const kept = opts.filter((o) => three.includes(o)); // original order
      if (prompt.toLowerCase().includes(answer.label.toLowerCase())) return drop(what, "the question gives away the answer");
      const evidenceIds = cite(r.evidenceIds, what);
      if (!evidenceIds.length) return drop(what, "cites nothing from this chat");
      const foreign = evidenceIds.find((id) => ctx.byId.get(id)?.by !== subject);
      if (foreign) return drop(what, `"${foreign}" is not by the subject`);
      return { prompt, options: kept, answerAt: kept.indexOf(answer), evidenceIds };
    },
  };

  if (sel.format === "wager") {
    const r = raw[0] ?? {};
    const pitches = new Map<string, string>();
    (Array.isArray(r.options) ? r.options : []).forEach((o, i) => {
      const ref = str(o?.refId);
      if (!sel.items.some((it) => it.id === ref)) { dropped.push(`wager pitch ${i + 1}: "${ref.slice(0, 40)}" is not one of the items code supplied`); return; }
      if (str(o?.pitch) === "") return;
      const p = text(o?.pitch, CAP.pitch, `wager pitch for ${ref}`);
      if (!p || pitches.has(ref)) return;
      const it = sel.items.find((x) => x.id === ref)!;
      // Code's own pitch is counted from the store. Anything else may add colour, not facts.
      const claim = p === codePitch(it, ctx) ? undefined : pitchClaim(p, it);
      if (claim) dropped.push(`wager pitch for ${ref}: ${claim}`);
      else pitches.set(ref, p);
    });
    if (raw.length > 1) dropped.push(`a Wager has exactly 1 round, ignored ${raw.length - 1} more`);
    if (sel.items.length < 2) dropped.push(`wager dropped: only ${sel.items.length} real item(s) to choose between`);
    else {
      const prompt = (str(r.prompt) ? text(r.prompt, CAP.prompt, "wager prompt") : null) ?? fb.prompt;
      const opts: Option[] = sel.items.map((it, i) => ({ id: `r1${"abcdefgh"[i]}`, label: it.title.slice(0, 80), sub: it.sub, ...(pitches.has(it.id) ? { pitch: pitches.get(it.id) } : {}), topic: it.topics.includes(sel.topic) ? sel.topic : it.topics[0] ?? sel.topic, ref: { kind: it.kind, id: it.id } }));
      for (const it of sel.items) extra.push({ id: it.id, kind: it.kind, text: `${it.title} · ${it.sub}`, topics: it.topics });
      rounds.push({ id: "r1", kind: "points", prompt, options: opts, evidenceIds: [...sel.items.map((it) => it.id), ...cite(r.evidenceIds, "wager")] });
    }
  } else {
    const fmt = sel.format;
    raw.forEach((r, i) => {
      if (rounds.length >= MAX_ROUNDS[fmt]) return;
      const rid = `r${rounds.length + 1}`;
      const b = build[fmt](r, `round ${i + 1}`, rid);
      if (!b) return;
      const opts: Option[] = b.options.map((o, j) => ({ id: `${rid}${"abcdefgh"[j]}`, ...o }));
      rounds.push({ id: rid, kind: KIND[fmt], prompt: b.prompt, ...(b.quote ? { quote: b.quote } : {}), options: opts, ...(b.answerAt !== undefined ? { answer: opts[b.answerAt].id } : {}), evidenceIds: b.evidenceIds });
    });
    if (!raw.length) dropped.push("no rounds in the draft");
  }
  // Receipts: the title and premise are on screen before anyone answers, so they may not name who said a line.
  if (sel.format === "receipts") {
    const authors = rounds.map((r) => r.options.find((o) => o.id === r.answer)?.label ?? "");
    if (authors.some((a) => names(title, a))) { dropped.push("title: names the author of a quoted line"); title = fb.title; }
    if (authors.some((a) => names(premise, a))) { dropped.push("premise: names the author of a quoted line"); premise = fb.premise; }
  }

  const cited = [...new Set(rounds.flatMap((r) => r.evidenceIds))];
  const evidence = cited.map((id) => ctx.byId.get(id) ?? extra.find((e) => e.id === id)).filter((e): e is EvidenceItem => !!e);
  return { title, premise, rounds, dropped, evidence };
}

// ---------- the template game: built from store data alone ----------
/** What AI_MODE=mock returns and what a failed draft falls back to. Offers a couple of spare rounds; validateDraft keeps the first that pass. */
export function mockDraft(sel: Selection, ctx: ChatContext): Draft {
  const fb = fallbackCopy(sel, ctx);
  const t = sel.topic;
  const l = label(t);
  const ok = (e: EvidenceItem) => !BANNED.test(e.text);
  const lines = ctx.evidence.filter((e) => e.kind !== "interest" && e.by && e.text.length >= 12 && ok(e));
  const onTopic = <T extends EvidenceItem>(list: T[]) => [...list.filter((e) => e.topics.includes(t)), ...list.filter((e) => !e.topics.includes(t))];
  const pool = onTopic(lines.length ? lines : ctx.evidence.filter(ok));
  const lead = (e: EvidenceItem, n = 64) => {
    const who = firstOf(ctx, e.by) || "Someone";
    return e.kind === "interest" ? `${who} lists '${snip(e.text, n)}' on their profile.` : e.kind === "message" ? `${who} said '${snip(e.text, n)}' in here.` : `${who} posted '${snip(e.text, n)}'.`;
  };
  // The chat's other topics, by how much material there is on each.
  const count = (x: TopicId) => ctx.evidence.filter((e) => e.topics.includes(x)).length;
  const alts = TOPIC_IDS.filter((x) => x !== t).map((x, i) => ({ x, i, n: count(x) })).sort((a, b) => b.n - a.n || a.i - b.i).map((a) => a.x);
  const about = (x: TopicId) => ctx.evidence.find((e) => e.topics.includes(x) && ok(e));
  const ids = (...es: (EvidenceItem | undefined)[]) => [...new Set(es.filter((e): e is EvidenceItem => !!e).map((e) => e.id))];
  const at = <T,>(list: T[], i: number) => list[i % list.length];

  if (sel.format === "split") {
    const frames: ((a: string) => { tail: string; a: string; b: string })[] = [
      (a) => ({ tail: "Next free evening, this chat is…", a: `${cap1(l)}, obviously`, b: `${cap1(a)} instead` }),
      (a) => ({ tail: "If the chat could only keep one:", a: `Keep ${l}`, b: `Keep ${a}` }),
      (a) => ({ tail: "Last-minute plan, everyone's free:", a: `${cap1(l)} it is`, b: `Talk us into ${a}` }),
      (a) => ({ tail: "One Saturday, one plan:", a: `A full day of ${l}`, b: `A full day of ${a}` }),
    ];
    const rounds = pool.length ? frames.map((f, i) => {
      const e = at(pool, i), alt = at(alts, i), x = f(label(alt));
      return { prompt: `${lead(e)} ${x.tail}`, options: [{ label: x.a, topic: t }, { label: x.b, topic: alt }], evidenceIds: ids(e, about(alt)) };
    }) : [];
    return { title: fb.title, premise: fb.premise, rounds };
  }

  if (sel.format === "blend") {
    const four = [t, ...alts.slice(0, 3)];
    const slots: { prompt: string; make: (x: string) => string }[] = [
      { prompt: "The chat's Saturday, slot 1: how does the morning start?", make: (x) => `Start with ${x}` },
      { prompt: "Slot 2: the afternoon is wide open. Fill it.", make: (x) => `${cap1(x)} all afternoon` },
      { prompt: "Slot 3: how does the night end?", make: (x) => `End on ${x}` },
      { prompt: "Bonus slot: Sunday, if anyone is still standing.", make: (x) => `One more round of ${x}` },
    ];
    const rounds = slots.map((s, i) => {
      const order = [...four.slice(i % 4), ...four.slice(0, i % 4)];
      return { prompt: s.prompt, options: order.map((x) => ({ label: s.make(label(x)), topic: x })), evidenceIds: ids(at(pool, i), ...order.map(about)).slice(0, 4) };
    });
    return { title: fb.title, premise: fb.premise, rounds: pool.length ? rounds : [] };
  }

  if (sel.format === "receipts") {
    const q = onTopic(quotable(ctx).filter((e) => ok(e) && !names(e.text, firstOf(ctx, e.by))));
    // Spread across authors first, so it isn't one person four times.
    const picked: EvidenceItem[] = [];
    for (let pass = 0; picked.length < 6 && pass < 6; pass++) for (const m of ctx.members) { const e = q.filter((x) => x.by === m.id && !picked.includes(x))[0]; if (e && picked.length < 6) picked.push(e); }
    return { title: `Receipts: ${l} edition`, premise: fb.premise, rounds: picked.map((e) => ({ evidenceId: e.id, quote: cutQuote(e.text, CAP.quote), prompt: e.kind === "message" ? "Who said this in the chat?" : "Who posted this?" })) };
  }

  if (sel.format === "lineup") {
    const safe = pool.filter((e) => e.topics.includes(t) && !NEGATIVE.test(e.text)); // lead with a line only when it is about the topic
    const tails = [`Rank the chat: who's first to show up for ${l}?`, `Who gets everyone else out the door for ${l}?`, `Who has the most ${l} stories?`];
    return { title: fb.title, premise: fb.premise, rounds: tails.map((tail, i) => { const e = safe.length ? at(safe, i) : undefined; return { prompt: e ? `${lead(e, 56)} ${tail}` : tail, evidenceIds: ids(e) }; }) };
  }

  if (sel.format === "hotseat") {
    const subject = sel.subjectId;
    const who = firstOf(ctx, subject);
    const mine = onTopic(lines.filter((e) => e.by === subject));
    const theirs = lines.filter((e) => e.by !== subject);
    const place = (answer: string, wrong: string[], seed: string) => { const i = hash(seed) % 3; const o = [...wrong.slice(0, 2)]; o.splice(i, 0, answer); return { options: o.map((x) => ({ label: x, topic: t })), answerIndex: i }; };
    const wrote = (e: EvidenceItem | undefined, n: number): DraftRound | null => {
      if (!e) return null;
      const wrong = shuffle(theirs, `${e.id}:${n}`).map((x) => snip(x.text, 56)).filter((x, i, a) => a.indexOf(x) === i).slice(0, 2);
      return wrong.length < 2 ? null : { prompt: n ? `And this one: which line is ${who}'s?` : `Which of these did ${who} actually write?`, ...place(snip(e.text, 56), wrong, e.id), evidenceIds: [e.id] };
    };
    const interests = ctx.evidence.filter((e) => e.kind === "interest" && ok(e));
    const own = interests.filter((e) => e.by === subject);
    const ownSet = new Set(own.map((e) => e.text.toLowerCase()));
    const otherInterests = [...new Set(interests.filter((e) => e.by !== subject && !ownSet.has(e.text.toLowerCase())).map((e) => snip(e.text, 56)))];
    const pickOwn = own.find((e) => e.topics.includes(t)) ?? own[0];
    const interest: DraftRound | null = pickOwn && otherInterests.length >= 2 ? { prompt: `Which of these is on ${who}'s profile as an interest?`, ...place(snip(pickOwn.text, 56), shuffle(otherInterests, pickOwn.id), pickOwn.id), evidenceIds: [pickOwn.id] } : null;
    const bySubject = ctx.evidence.filter((e) => e.by === subject && ok(e));
    const tally = TOPIC_IDS.map((x, i) => ({ x, i, n: bySubject.filter((e) => e.topics.includes(x)).length })).sort((a, b) => b.n - a.n || a.i - b.i);
    const never = tally.filter((x) => x.n === 0).map((x) => cap1(label(x.x)));
    const most: DraftRound | null = tally[0]?.n && never.length >= 2 ? { prompt: `Going by what ${who} posts and says in here, which comes up most?`, ...place(cap1(label(tally[0].x)), shuffle(never, `${subject}:${t}`), `${subject}:most`), evidenceIds: bySubject.filter((e) => e.topics.includes(tally[0].x)).slice(0, 3).map((e) => e.id) } : null;
    const rounds = [wrote(mine[0], 0), interest, most, wrote(mine[1], 1), wrote(mine[2], 2)].filter((r): r is DraftRound => !!r);
    return { title: fb.title, premise: fb.premise, rounds: subject ? rounds : [] };
  }

  // wager: code supplies the items; the template only adds a true one-line pitch (none for a listing).
  const e = pool[0];
  return { title: fb.title, premise: fb.premise, rounds: [{ prompt: fb.prompt, options: sel.items.map((it) => ({ refId: it.id, pitch: codePitch(it, ctx) })), evidenceIds: ids(e?.topics.includes(t) ? e : undefined) }] };
}

// ---------- the model call ----------
const SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "Max 60 characters. Sounds like this chat, not like an app." },
    premise: { type: "string", description: "One line, max 140 characters, telling the chat what today's game is." },
    rounds: {
      type: "array",
      items: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Max 160 characters." },
          options: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string", description: "Max 60 characters." },
                topic: { type: "string", enum: TOPIC_IDS, description: "Taxonomy id this option is about." },
                refId: { type: "string", description: "Wager only: the id of one of the ITEMS." },
                pitch: { type: "string", description: "Wager only: max 90 characters on why this chat would go for it." },
              },
            },
          },
          answerIndex: { type: "integer", description: "Hot Seat only: index of the option the evidence supports." },
          evidenceIds: { type: "array", items: { type: "string" }, description: "Ids from the EVIDENCE list that this round is built on." },
          evidenceId: { type: "string", description: "Receipts only: the id of the one line being quoted." },
          quote: { type: "string", description: "Receipts only: words copied exactly from that line, max 140 characters." },
        },
      },
    },
  },
  required: ["title", "premise", "rounds"],
};

const RULES: Record<Format, (sel: Selection, ctx: ChatContext) => string> = {
  split: () => `SPLIT. Write 3 rounds. Each round is a dilemma only this chat would argue about, with exactly 2 options. Each option has a label and a topic (taxonomy id). Each round needs evidenceIds: at least one id from EVIDENCE that the dilemma comes from.`,
  blend: () => `BLEND. The chat builds one thing together (their Saturday, a potluck, a playlist, a road trip: pick what fits the evidence). Write 3 rounds, each one slot of that thing, with 3-4 options drawn from what members actually like. Each option has a label and a topic (taxonomy id). Each round needs evidenceIds (at least one). There are no right answers.`,
  receipts: () => `RECEIPTS. Write 4 rounds. Each round is { evidenceId, quote, prompt }: pick one line from EVIDENCE, copy the recognisable part of it word for word into quote (max 140 characters, no paraphrasing), and write a short prompt such as a question about who said it. Use four different lines from at least two different people. Never put an author's name in the title, the premise, the quote or the prompt. Do NOT write options or an answer; code adds the names.`,
  lineup: () => `LINEUP. Write 2 rounds. Each round is only a prompt asking the chat to rank its members on something drawn from their history (for example who lasts longest at the 6am run). Prompts, the title and the premise must be positive and flattering to be first in; nothing anyone would mind being last in. Add evidenceIds for the lines the prompt comes from. Do NOT write options; code adds the members.`,
  hotseat: (sel, ctx) => `HOT SEAT. The subject is ${firstOf(ctx, sel.subjectId)} (${sel.subjectId}). Write 3 rounds. Each round is a question about ${firstOf(ctx, sel.subjectId)} with exactly 3 short text options and answerIndex pointing at the one the evidence supports. evidenceIds may ONLY be lines by ${firstOf(ctx, sel.subjectId)}. The question must not contain or give away the answer. The two wrong options must be plausible for this chat.`,
  wager: (sel) => `WAGER. Code has already chosen the three real things below; you may not add, rename or reorder them. Write the title, the premise, and exactly 1 round with a prompt and one option per item: { refId, pitch }, where pitch (max 90 characters) says why THIS chat would actually go, using the evidence. A pitch is colour only: no numbers, prices, days or times, and nothing about who is already going, in, or has saved it (code shows those).\nITEMS:\n${sel.items.map((i) => `- refId=${i.id} (${i.kind}) ${i.title} · ${i.sub}`).join("\n")}`,
};

function buildPrompt(sel: Selection, ctx: ChatContext, repair?: string[]) {
  const c = getConversation(ctx.conversationId);
  const who = (id?: ID) => firstOf(ctx, id) || "member";
  const base = sel.format === "receipts" ? quotable(ctx) : ctx.evidence;
  const rank = (e: EvidenceItem) => (sel.format === "hotseat" && e.by === sel.subjectId ? 0 : 2) + (e.topics.includes(sel.topic) ? 0 : 1) + (e.kind === "interest" ? 0.5 : 0);
  const list = base.map((e, i) => ({ e, i })).sort((a, b) => rank(a.e) - rank(b.e) || b.i - a.i).slice(0, 40).map(({ e }) => `[${e.id}] (${e.kind}, by ${who(e.by)}) ${e.text.slice(0, 200)}`).join("\n");
  return `You are writing today's game for one ${ctx.isGroup ? `group chat${c?.name ? ` called "${c.name}"` : ""}` : "direct message thread"} on Facebook Messenger.

MEMBERS: ${ctx.members.map((m) => `${m.first} (${m.id})`).join(", ")}
TODAY'S TOPIC (chosen by code): ${sel.topic} — ${label(sel.topic)}
TAXONOMY IDS (the only values allowed for an option's topic): ${TOPIC_IDS.join(", ")}

EVIDENCE (everything every member of this chat can already see; cite by id, and only these ids):
${list || "(nothing)"}

FORMAT RULES
${RULES[sel.format](sel, ctx)}

The game must be unmistakably about THIS chat: its inside jokes, the places it names, the real lines people wrote. Someone from another chat should not be able to play it. Never write generic trivia or anything that could be sent to any group. Keep it warm and playful: no health or mood words, no guilt, nothing that makes fun of a member. Title max 60 characters, premise max 140, prompts max 160, option labels max 60.${repair?.length ? `\n\nYour previous draft was refused by the checks. Fix these and return the whole game again:\n${repair.slice(0, 12).map((r) => `- ${r}`).join("\n")}` : ""}`;
}

/** Build context, pick the game in code, let the model write it, check it. One retry, then the template. Does not save. */
export async function generateGame(conversationId: ID, force: { topic?: TopicId; format?: Format } = {}): Promise<PlayGame> {
  const ctx = buildContext(conversationId);
  let sel = selectGame(ctx, force);
  let why = sel.why;
  const userId = ctx.members[0]?.id;
  const notes: string[] = [];
  let mode = "mock";
  let costUsd = 0;
  const ask = async (repair?: string[]) => {
    const { data, trace } = await ai.json<Draft>(buildPrompt(sel, ctx, repair), { task: "play.generate", userId, schema: SCHEMA, schemaName: "game", temperature: 0.8, maxTokens: 1800, cache: false, mock: () => mockDraft(sel, ctx) });
    mode = trace.mode;
    costUsd += trace.costUsd ?? 0;
    return validateDraft(sel, data ?? {}, ctx);
  };
  const enough = (v: { rounds: Round[] }) => v.rounds.length >= MIN_ROUNDS[sel.format];

  // What code already knows validation will refuse whatever the model writes (a forced format on a chat that can't
  // support it): don't spend a call on it. The template / Split fallback below takes over.
  const hopeless = (GROUP_ONLY.includes(sel.format) && ctx.members.length < 3) || (sel.format === "hotseat" && !sel.subjectId) || (sel.format === "wager" && sel.items.length < 2);
  let out: ReturnType<typeof validateDraft> | undefined;
  if (!hopeless) {
    try {
      out = await ask();
      if (!enough(out) && mode !== "mock") {
        notes.push(...out.dropped.map((d) => `first draft · ${d}`));
        out = await ask([...out.dropped, `only ${out.rounds.length} round(s) passed; ${MIN_ROUNDS[sel.format]} or more are needed`]);
      }
    } catch (err) {
      notes.push(`model error: ${(err as Error).message.slice(0, 80)}`);
      out = undefined;
    }
  }
  if (!out || !enough(out)) {
    // The template, from store data (in mock mode the draft already was the template).
    if (!out || mode !== "mock") {
      if (out) notes.push(...out.dropped.map((d) => `refused draft · ${d}`));
      out = validateDraft(sel, mockDraft(sel, ctx), ctx);
    }
    // If this chat can't support the format even then, a Split always can.
    if (!enough(out) && sel.format !== "split") {
      notes.push(...out.dropped, `${FORMAT_LABEL[sel.format]} has too little to go on in this chat; switched to Split`);
      why += ` · ${FORMAT_LABEL[sel.format]} had too little to go on here, so Split`;
      sel = selectGame(ctx, { topic: sel.topic, format: "split" });
      out = validateDraft(sel, mockDraft(sel, ctx), ctx);
    }
    mode = `${mode} · fallback`;
  }
  return {
    id: pid("pg"),
    conversationId,
    date: dayKey(),
    format: sel.format,
    topic: sel.topic,
    title: out.title,
    premise: out.premise,
    rounds: out.rounds,
    subjectId: sel.format === "hotseat" ? sel.subjectId : undefined,
    evidence: out.evidence,
    mode,
    costUsd,
    dropped: [...notes, ...out.dropped],
    why,
    createdAt: new Date().toISOString(),
  };
}

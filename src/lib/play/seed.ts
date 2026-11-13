// Turns the literal history in src/data/play.ts into stored games, answers and play events, dated relative to now.
// Code enforces here: no seeded game is dated today; cited lines are looked up in the chat's own context
// (buildContext), so a seeded game can only cite what every member of that chat can see; a chat or member that
// no longer exists is skipped. The store is passed in (never playStore()) because store.ts calls this lazily.
import { seedGames, seedUnlocks, type SeedGame } from "@/data/play";
import { getConversation } from "@/server/db";
import type { ID, Message } from "@/types";
import { buildContext, type ChatContext } from "./context";
import type { Choice, EvidenceItem, PlayEvent, PlayGame, PlayStore, Unlock } from "./store";

const DAY = 864e5;
const MIN = 60e3;
/** Daily drop for seeded days: 14:00 UTC, morning in Austin. Every scripted finish lands the same UTC day. */
const DROP_HOUR_UTC = 14;
const iso = (t: number) => new Date(t).toISOString();

function cite(key: string, ctx: ChatContext): EvidenceItem | undefined {
  const direct = ctx.byId.get(key);
  if (direct) return direct;
  const inv = ctx.inventory.find((i) => i.id === key);
  if (inv) return { id: inv.id, kind: inv.kind, text: inv.title, topics: inv.topics };
  const cut = key.indexOf("|");
  if (cut < 0) return undefined;
  const by = key.slice(0, cut), start = key.slice(cut + 1);
  return ctx.evidence.find((e) => e.by === by && e.text.startsWith(start));
}

function toGame(sg: SeedGame, ctx: ChatContext, now: number): PlayGame {
  const date = iso(now - sg.day * DAY).slice(0, 10);
  const evidence = new Map<string, EvidenceItem>();
  const rounds = sg.rounds.map(({ cites = [], ...r }) => {
    const found = cites.map((k) => cite(k, ctx)).filter((e): e is EvidenceItem => !!e);
    for (const e of found) evidence.set(e.id, e);
    return { ...r, evidenceIds: found.map((e) => e.id) };
  });
  return {
    id: sg.id, conversationId: sg.conversationId, date, format: sg.format, topic: sg.topic, title: sg.title, premise: sg.premise,
    rounds, subjectId: sg.subjectId, evidence: [...evidence.values()], mode: "seed", costUsd: 0, dropped: [],
    createdAt: `${date}T${String(DROP_HOUR_UTC).padStart(2, "0")}:00:00.000Z`,
  };
}

/** A scripted finish must not sit within 30 minutes before one of that member's real chat messages, or the
 *  score would read the message as a reply to the game. Move it just past the message instead. */
function clearOfReplies(t: number, userId: ID, messages: Message[]) {
  const mine = messages.filter((m) => m.senderId === userId && !m.system && m.status !== "draft").map((m) => new Date(m.createdAt).getTime()).sort((a, b) => a - b);
  for (const mt of mine) if (mt > t && mt - t <= 30 * MIN) t = mt + MIN;
  return t;
}

export function seedPlay(s: PlayStore, now = Date.now()) {
  const contexts = new Map<ID, ChatContext>();
  const events: PlayEvent[] = [];
  let n = 0;
  const push = (e: Omit<PlayEvent, "id" | "at">, t: number) => events.push({ id: `pe_seed_${(n++).toString(36)}`, at: iso(t), ...e });

  for (const sg of seedGames) {
    const c = getConversation(sg.conversationId);
    if (!c || sg.day < 1) continue;
    const ctx = contexts.get(c.id) ?? buildContext(c.id);
    contexts.set(c.id, ctx);
    const game = toGame(sg, ctx, now);
    s.games.set(game.id, game);
    s.byDay.set(`${game.conversationId}|${game.date}`, game.id);
    const t0 = new Date(game.createdAt).getTime();
    const base = { gameId: game.id, conversationId: c.id };
    const byUser = new Map<ID, Record<string, Choice>>();

    for (const [userId, play] of Object.entries(sg.plays)) {
      if (!c.participantIds.includes(userId)) continue;
      const finished = play.a.length >= game.rounds.length;
      const done = finished ? clearOfReplies(t0 + play.h * 3600e3, userId, c.messages) : t0 + play.h * 3600e3;
      const mine: Record<string, Choice> = {};
      const secs = play.a.map((_, i) => 4 + ((userId.length * 7 + i * 5 + sg.day * 3) % 9)); // 4–12s a round
      let t = done - secs.reduce((a, b) => a + b, 0) * 1000 - 3000;
      push({ ...base, userId, kind: "open" }, t);
      play.a.forEach((choice, i) => {
        const r = game.rounds[i];
        if (!r) return;
        t += secs[i] * 1000;
        mine[r.id] = choice;
        push({ ...base, userId, roundId: r.id, kind: "answer", choice, topic: game.topic, ms: secs[i] * 1000 }, t);
      });
      byUser.set(userId, mine);
      if (!finished) continue;
      push({ ...base, userId, kind: "complete" }, done);
      if (play.react) push({ ...base, userId, kind: "react", choice: play.react }, done + 2 * MIN);
    }
    s.answers.set(game.id, byUser);
  }
  s.events.push(...events.sort((a, b) => a.at.localeCompare(b.at)));

  for (const { day, ...su } of seedUnlocks) {
    const c = getConversation(su.conversationId);
    const item = c && (contexts.get(c.id) ?? buildContext(c.id)).inventory.find((i) => i.id === su.refId);
    if (!c || !item) continue; // the real thing is gone or not visible to everyone: no card
    const createdAt = `${iso(now - day * DAY).slice(0, 10)}T22:00:00.000Z`;
    const messageId = `m_seed_${su.id}`;
    const u: Unlock = { ...su, title: item.title, sub: item.sub, image: item.image, createdAt, messageId };
    s.unlocks.set(u.id, u);
    // The card in the thread, slotted in by time so the chat still reads in order.
    if (!c.messages.some((m) => m.id === messageId)) {
      const msg: Message = { id: messageId, senderId: c.participantIds[0], text: `Unlocked for this chat · ${item.title}`, createdAt, system: true, attachment: { type: "unlock", ref: u.id }, readBy: [...c.participantIds] };
      const at = c.messages.findIndex((m) => m.createdAt > createdAt);
      c.messages.splice(at < 0 ? c.messages.length : at, 0, msg);
    }
  }
}

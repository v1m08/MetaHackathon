// What the chat sees after playing: how everyone answered, and how well each player read the room.
// Performance is for the result card only. It never feeds affinity or recommendations.
// Code enforces: only finished players are counted or named. A tap someone can still change is nobody else's to see.
import type { ID } from "@/types";
import { answersFor, completedBy, type Choice, type PlayGame, type Round } from "./store";

export interface RoundResult {
  roundId: string;
  /** Votes (pick / split), Borda points (rank) or wagered points (points) per option. */
  totals: Record<string, number>;
  who: Record<string, ID[]>;
  /** Option ids ordered best-first. */
  order: string[];
  /** The right answer when there is one. */
  answer?: string;
  voters: number;
}

const pickOf = (c: Choice | undefined) => (typeof c === "string" ? c : c && !Array.isArray(c) && typeof (c as { pick?: unknown }).pick === "string" ? (c as { pick: string }).pick : undefined);

/** Hot Seat: the subject's own answer is the truth once they have finished; until then, the cited answer stands. */
export function answerOf(game: PlayGame, r: Round) {
  if (game.format === "hotseat" && game.subjectId && completedBy(game.id).has(game.subjectId)) {
    const own = pickOf(answersFor(game.id).get(game.subjectId)?.[r.id]);
    if (own) return own;
  }
  return r.answer;
}

export function roundResults(game: PlayGame): RoundResult[] {
  const all = answersFor(game.id);
  const done = completedBy(game.id);
  return game.rounds.map((r) => {
    const totals: Record<string, number> = Object.fromEntries(r.options.map((o) => [o.id, 0]));
    const who: Record<string, ID[]> = Object.fromEntries(r.options.map((o) => [o.id, []]));
    let voters = 0;
    for (const [userId, a] of all) {
      if (!done.has(userId)) continue;
      const c = a[r.id];
      if (c === undefined) continue;
      if (game.format === "hotseat" && userId === game.subjectId) continue; // the subject sets the answer, doesn't vote
      voters++;
      if (r.kind === "rank" && Array.isArray(c)) c.forEach((id, i) => { if (id in totals) totals[id] += c.length - i; });
      else if (r.kind === "points" && typeof c === "object" && !Array.isArray(c)) for (const [id, pts] of Object.entries(c as Record<string, number>)) { if (id in totals && pts > 0) { totals[id] += Number(pts); who[id].push(userId); } }
      else { const p = pickOf(c); if (p && p in totals) { totals[p] += 1; who[p].push(userId); } }
    }
    const order = r.options.map((o) => o.id).sort((a, b) => totals[b] - totals[a]);
    return { roundId: r.id, totals, who, order, answer: answerOf(game, r), voters };
  });
}

/** 0..1: how well this player read the chat (or knew the answer). Null until there is something to compare against. */
export function performance(game: PlayGame, userId: ID): number | null {
  const mine = answersFor(game.id).get(userId);
  if (!mine) return null;
  const res = roundResults(game);
  const parts: number[] = [];
  for (const r of game.rounds) {
    const c = mine[r.id];
    const rr = res.find((x) => x.roundId === r.id)!;
    if (c === undefined) continue;
    if (rr.answer !== undefined) { if (!(game.format === "hotseat" && userId === game.subjectId)) parts.push(pickOf(c) === rr.answer ? 1 : 0); continue; }
    if (rr.voters < 2) continue;
    const top = rr.totals[rr.order[0]];
    const leaders = rr.order.filter((id) => rr.totals[id] === top);
    if (r.kind === "split") parts.push(leaders.includes((c as { predict?: string }).predict ?? "") ? 1 : 0);
    else if (r.kind === "pick") parts.push(leaders.includes(pickOf(c) ?? "") ? 1 : 0);
    else if (r.kind === "rank" && Array.isArray(c)) {
      const n = c.length;
      const dist = c.reduce((s, id, i) => s + Math.abs(i - rr.order.indexOf(id)), 0);
      const max = Math.floor((n * n) / 2) || 1;
      parts.push(1 - Math.min(1, dist / max));
    } else if (r.kind === "points") {
      const total = Object.values(rr.totals).reduce((s, x) => s + x, 0) || 1;
      const l1 = r.options.reduce((s, o) => s + Math.abs(Number((c as Record<string, number>)[o.id] ?? 0) / 10 - rr.totals[o.id] / total), 0);
      parts.push(1 - Math.min(1, l1 / 2));
    }
  }
  return parts.length ? parts.reduce((s, x) => s + x, 0) / parts.length : null;
}

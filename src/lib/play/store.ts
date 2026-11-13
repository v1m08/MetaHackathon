// In-memory state for Chat Games: the daily game per chat, every play event, answers, unlocks.
// One append-only event log; every score is derived from it in score.ts. Survives hot reloads on globalThis.
import type { ID } from "@/types";
import { seedPlay } from "./seed";
import type { TopicId } from "./taxonomy";

export type Format = "split" | "receipts" | "lineup" | "blend" | "hotseat" | "wager";
export const FORMATS: Format[] = ["split", "blend", "receipts", "wager", "lineup", "hotseat"];
export const FORMAT_LABEL: Record<Format, string> = { split: "Split", receipts: "Receipts", lineup: "Lineup", blend: "Blend", hotseat: "Hot Seat", wager: "Wager" };
/** Formats that need three or more people. */
export const GROUP_ONLY: Format[] = ["lineup", "hotseat"];

/** How a round is played. split = pick a side, then predict the chat. pick = one option. rank = order people. points = spread 10. */
export type RoundKind = "split" | "pick" | "rank" | "points";
export interface Option {
  id: string;
  label: string;
  sub?: string;
  /** Wager: one line of copy about the item, shown apart from `sub` (the item's own date / price line, set by code). */
  pitch?: string;
  topic?: TopicId;
  /** A chat member (Receipts, Lineup). */
  userId?: ID;
  /** Real inventory (Wager). */
  ref?: { kind: "event" | "group" | "listing"; id: string };
}
export interface Round {
  id: string;
  kind: RoundKind;
  prompt: string;
  /** Receipts: the real line, cut by code from the source's own text (never the model's string), at most 140 characters. */
  quote?: string;
  options: Option[];
  /** Option id of the right answer, when there is one (set by code for Receipts; by the subject's own answer for Hot Seat). */
  answer?: string;
  evidenceIds: string[];
}
export interface EvidenceItem { id: string; kind: "message" | "post" | "reel" | "interest" | "event" | "group" | "listing"; by?: ID; text: string; topics: TopicId[] }

export interface PlayGame {
  id: string;
  conversationId: ID;
  date: string; // YYYY-MM-DD
  format: Format;
  topic: TopicId;
  title: string;
  premise: string;
  rounds: Round[];
  subjectId?: ID;
  /** The cited items, kept so the "made from" screen and the eval can check them. */
  evidence: EvidenceItem[];
  mode: string;
  costUsd: number;
  /** What code refused from the model's draft, and why. */
  dropped: string[];
  /** Why code picked this topic and format for this chat (select.ts). Shown in the dev inspector only. */
  why?: string;
  createdAt: string;
  messageId?: string;
}

export type Choice = string | string[] | Record<string, number> | { pick: string; predict: string };
export type EventKind = "open" | "answer" | "change" | "skip" | "complete" | "react" | "rsvp" | "join" | "save" | "dismiss";
export interface PlayEvent {
  id: string;
  gameId?: string;
  conversationId: ID;
  userId: ID;
  roundId?: string;
  /** Feedback events (rsvp / join / save / dismiss): the unlock card they answer. */
  unlockId?: string;
  kind: EventKind;
  choice?: Choice;
  topic?: TopicId;
  /** Milliseconds spent on the round. */
  ms?: number;
  at: string;
}

export type UnlockTier = "group" | "event" | "listing";
export interface Unlock {
  id: string;
  conversationId: ID;
  tier: UnlockTier;
  refId: string;
  topic: TopicId;
  title: string;
  sub: string;
  image?: string;
  why: string;
  /** The facts code counted from play events; the why line may only use numbers that appear here. */
  facts: string[];
  /** Why the model's line was not shown, when code refused it (the first fact is shown instead). */
  refused?: string;
  score: number;
  mode: string;
  costUsd: number;
  responses: Record<ID, "in" | "dismiss">;
  createdAt: string;
  messageId?: string;
}

export interface PlayStore {
  games: Map<string, PlayGame>;
  byDay: Map<string, string>; // conversationId|date -> gameId
  answers: Map<string, Map<ID, Record<string, Choice>>>; // gameId -> userId -> roundId -> choice
  events: PlayEvent[];
  unlocks: Map<string, Unlock>;
  muted: Set<ID>;
  pending: Map<string, Promise<PlayGame | null>>;
  /** conversationId|date -> when the daily generation last failed, so a page load doesn't retry it at once. */
  failed: Map<string, number>;
  seeded: boolean;
}
const g = globalThis as unknown as { __play?: PlayStore };
const fresh = (): PlayStore => ({ games: new Map(), byDay: new Map(), answers: new Map(), events: [], unlocks: new Map(), muted: new Set(), pending: new Map(), failed: new Map(), seeded: false });
/** The store, seeded with the past days of play (src/data/play.ts) the first time it is read. */
export function playStore() {
  const s = (g.__play ??= fresh());
  if (!s.seeded) { s.seeded = true; seedPlay(s); }
  return s;
}
/** A new store that re-seeds on the next playStore() call; `seed: false` keeps it empty (unit tests). */
export function resetPlayStore(opts: { seed?: boolean } = {}) {
  g.__play = fresh();
  if (opts.seed === false) g.__play.seeded = true;
  return g.__play;
}

let seq = 0;
export const pid = (p: string) => `${p}_${Date.now().toString(36)}${(seq++).toString(36)}`;
/** A game day is a UTC day (YYYY-MM-DD), on the server and in the UI alike, so the drop rolls over at 00:00 UTC. */
export const dayKey = (d: Date | string = new Date()) => (typeof d === "string" ? d : d.toISOString()).slice(0, 10);

export const getGame = (id: string) => playStore().games.get(id);
export const gamesIn = (conversationId: ID) => [...playStore().games.values()].filter((x) => x.conversationId === conversationId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
export const answersFor = (gameId: string) => playStore().answers.get(gameId) ?? new Map<ID, Record<string, Choice>>();
export const eventsFor = (gameId: string) => playStore().events.filter((e) => e.gameId === gameId);
export const unlocksIn = (conversationId: ID) => [...playStore().unlocks.values()].filter((u) => u.conversationId === conversationId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

export function saveGame(game: PlayGame) {
  const s = playStore();
  s.games.set(game.id, game);
  s.byDay.set(`${game.conversationId}|${game.date}`, game.id);
  return game;
}
export function logEvent(e: Omit<PlayEvent, "id" | "at"> & { at?: string }) {
  const ev: PlayEvent = { id: pid("pe"), at: e.at ?? new Date().toISOString(), ...e };
  playStore().events.push(ev);
  return ev;
}
export function setAnswer(gameId: string, userId: ID, roundId: string, choice: Choice) {
  const s = playStore();
  const byUser = s.answers.get(gameId) ?? new Map<ID, Record<string, Choice>>();
  const mine = byUser.get(userId) ?? {};
  const changed = roundId in mine;
  mine[roundId] = choice;
  byUser.set(userId, mine);
  s.answers.set(gameId, byUser);
  return changed;
}
export const completedBy = (gameId: string) => new Set(eventsFor(gameId).filter((e) => e.kind === "complete").map((e) => e.userId));

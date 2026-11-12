// Drift detection. Plain code, no model. Ported from Hang Again's sleep math onto the clone's real data.
//   contact    a real exchange: a two-way chat (both people sent within 48 h, in a DM or a group chat they share),
//              or a meetup (an event both went to, a photo both are tagged in). Likes and reactions never count.
//   rhythm     median gap in days between real contacts over the last 180 days, clamped 7–120; default 30 with
//              fewer than 3 contacts in that window
//   state      days since the last real contact / rhythm → awake (<1), sleepy (1–1.5), napping (>1.5)
// Silence has no notification anywhere else in the app; this is the one place that computes it.
import { cityById } from "@/data/cities";
import { db, getUser } from "@/server/db";
import type { Conversation, ID, Post } from "@/types";
import { connection } from "@/lib/travel/visibility";
import { canSeePost } from "@/lib/travel/visibility";
import { hasMissed, isMutual } from "./store";

const DAY = 86_400_000;
const WINDOW_MS = 48 * 3_600_000;
export const RHYTHM_MIN = 7;
export const RHYTHM_MAX = 120;
export const RHYTHM_DEFAULT = 30;
export const RHYTHM_LOOKBACK_DAYS = 180;

export type ContactType = "two_way_chat" | "one_way" | "meetup";
export interface ContactEvent { date: string; type: ContactType; via: "dm" | "group" | "event" | "photo"; sourceIds: string[] }
export type DriftState = "awake" | "sleepy" | "napping";

const dayOf = (iso: string) => iso.slice(0, 10);
const ms = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).getTime();
export const daysBetween = (fromDay: string, toDay: string) => Math.round((ms(dayOf(toDay)) - ms(dayOf(fromDay))) / DAY);
export const today = () => new Date().toISOString().slice(0, 10);

/** Cluster the two people's messages in one thread into 48-hour exchanges. */
export function chatEvents(c: Conversation, a: ID, b: ID): ContactEvent[] {
  const msgs = c.messages.filter((m) => (m.senderId === a || m.senderId === b) && m.status !== "draft" && !m.system).sort((x, y) => x.createdAt.localeCompare(y.createdAt));
  const out: ContactEvent[] = [];
  let i = 0;
  while (i < msgs.length) {
    const start = ms(msgs[i].createdAt);
    const cluster: typeof msgs = [];
    while (i < msgs.length && ms(msgs[i].createdAt) - start <= WINDOW_MS) cluster.push(msgs[i++]);
    const twoWay = cluster.some((m) => m.senderId === a) && cluster.some((m) => m.senderId === b);
    out.push({ date: dayOf(cluster[cluster.length - 1].createdAt), type: twoWay ? "two_way_chat" : "one_way", via: c.isGroup ? "group" : "dm", sourceIds: cluster.map((m) => m.id) });
  }
  return out;
}

/** Events both went to (in the past) and photos both are tagged in. One meetup per day. */
export function meetupEvents(a: ID, b: ID, now = today()): ContactEvent[] {
  const byDay = new Map<string, { ids: string[]; via: ContactEvent["via"] }>();
  const add = (date: string, id: string, via: ContactEvent["via"]) => {
    const cur = byDay.get(date) ?? { ids: [], via };
    cur.ids.push(id);
    byDay.set(date, cur);
  };
  for (const e of db().events) if (e.going.includes(a) && e.going.includes(b) && dayOf(e.startsAt) <= now) add(dayOf(e.startsAt), e.id, "event");
  for (const p of db().posts) {
    const people = [p.authorId, ...(p.taggedIds ?? [])];
    if (people.includes(a) && people.includes(b) && (p.taggedIds?.length ?? 0) > 0 && dayOf(p.createdAt) <= now) add(dayOf(p.createdAt), p.id, "photo");
  }
  return [...byDay].map(([date, v]) => ({ date, type: "meetup" as const, via: v.via, sourceIds: v.ids }));
}

export function timeline(viewerId: ID, friendId: ID): ContactEvent[] {
  const chats = db().conversations.filter((c) => c.participantIds.includes(viewerId) && c.participantIds.includes(friendId)).flatMap((c) => chatEvents(c, viewerId, friendId));
  return [...chats, ...meetupEvents(viewerId, friendId)].sort((x, y) => x.date.localeCompare(y.date));
}

const isReal = (e: ContactEvent) => e.type !== "one_way";
export const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/** Median gap between real-contact days inside the lookback window, clamped. Default with fewer than 3 days. */
export function rhythmDays(events: ContactEvent[], now = today()): number {
  const floor = new Date(ms(now) - RHYTHM_LOOKBACK_DAYS * DAY).toISOString().slice(0, 10);
  const days = [...new Set(events.filter((e) => isReal(e) && e.date <= now && e.date >= floor).map((e) => e.date))].sort();
  if (days.length < 3) return RHYTHM_DEFAULT;
  const gaps = days.slice(1).map((d, i) => daysBetween(days[i], d));
  return Math.round(Math.min(RHYTHM_MAX, Math.max(RHYTHM_MIN, median(gaps))));
}

export const stateForRatio = (ratio: number): DriftState => (ratio < 1 ? "awake" : ratio <= 1.5 ? "sleepy" : "napping");

export interface Drift {
  friendId: ID;
  state: DriftState;
  ratio: number | null;
  rhythmDays: number;
  daysSince: number | null;
  lastContact: ContactEvent | null;
  lastMeetup: ContactEvent | null;
  /** Real contacts of any age: how much history there is to draw on. */
  sharedCount: number;
}

export function driftFor(viewerId: ID, friendId: ID, now = today()): Drift {
  const tl = timeline(viewerId, friendId).filter((e) => e.date <= now);
  const real = tl.filter(isReal);
  const last = real[real.length - 1] ?? null;
  const lastMeetup = tl.filter((e) => e.type === "meetup").at(-1) ?? null;
  const rhythm = rhythmDays(tl, now);
  const daysSince = last ? daysBetween(last.date, now) : null;
  const ratio = daysSince === null ? null : daysSince / rhythm;
  return { friendId, state: ratio === null ? "napping" : stateForRatio(ratio), ratio, rhythmDays: rhythm, daysSince, lastContact: last, lastMeetup, sharedCount: real.length };
}

export interface RecentPost { id: string; text: string; createdAt: string; image?: string; city?: string }
/** The friend's most recent visible post inside `days`, excluding group posts. */
export function recentPostBy(viewerId: ID, friendId: ID, days = 14): RecentPost | undefined {
  const cutoff = Date.now() - days * DAY;
  const p = db().posts.filter((p) => p.authorId === friendId && !p.groupId && !p.eventId && new Date(p.createdAt).getTime() >= cutoff && canSeePost(viewerId, p)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return p ? { id: p.id, text: p.text, createdAt: p.createdAt, image: p.images?.[0], city: p.city } : undefined;
}

export interface DriftCard extends Drift {
  name: string;
  avatar: string;
  city?: string;
  cityName?: string;
  connection: string;
  recentPost?: RecentPost;
  /** The viewer's own private pick, and whether the friend picked them back. Never shown to anyone else. */
  missed: boolean;
  mutual: boolean;
  label: string;
}

export const stateLabel = (d: Drift) => {
  if (d.daysSince === null) return "quiet · no real contact we can see";
  const weeks = Math.round(d.daysSince / 7);
  const since = d.daysSince < 14 ? `${d.daysSince} days` : `${weeks} weeks`;
  return d.state === "awake" ? `awake · talked ${since} ago` : d.state === "sleepy" ? `sleepy · ${since} since a real chat` : `napping · ${since} since a real chat`;
};

/** Every friend, with their drift state; napping first, then by how far past their rhythm they are. */
export function driftList(viewerId: ID): DriftCard[] {
  const me = getUser(viewerId);
  if (!me) return [];
  const cards: DriftCard[] = me.friendIds.map((fid) => {
    const u = getUser(fid)!;
    const d = driftFor(viewerId, fid);
    return { ...d, name: u.name, avatar: u.avatar, city: u.city, cityName: cityById(u.city ?? "")?.name, connection: connection(viewerId, fid)?.label ?? "friends", recentPost: recentPostBy(viewerId, fid), missed: hasMissed(viewerId, fid), mutual: isMutual(viewerId, fid), label: stateLabel(d) };
  });
  const hoursAgo = (iso?: string) => (iso ? (Date.now() - new Date(iso).getTime()) / 3_600_000 : Infinity);
  const h = (c: DriftCard) => hoursAgo(c.recentPost?.createdAt);
  const rank = (c: DriftCard) => (c.mutual ? -1000 : 0) + (c.state === "napping" ? 0 : c.state === "sleepy" ? 300 : 600) - Math.min(120, c.sharedCount * 20) + (h(c) < 6 ? -300 : h(c) < 48 ? -200 : c.recentPost ? -50 : 0) - Math.min(9, c.ratio ?? 0);
  return cards.sort((a, b) => rank(a) - rank(b) || (b.sharedCount - a.sharedCount));
}

export interface Crew { id: string; name: string; kind: "chat" | "label"; memberIds: ID[]; members: { id: ID; name: string; avatar: string; state: DriftState; city?: string }[]; quiet: number; lastTogether?: string; hook?: { text: string; authorId: ID; messageId: string } }

/** Crews: group chats the viewer is in (3+ people), plus friend-label clusters ("Plano East high school") of 3+. */
export function crewsFor(viewerId: ID): Crew[] {
  const me = getUser(viewerId);
  if (!me) return [];
  const out: Crew[] = [];
  const covered = new Set<string>();
  for (const c of db().conversations) {
    if (!c.isGroup || !c.participantIds.includes(viewerId) || c.participantIds.length < 3) continue;
    const memberIds = c.participantIds.filter((id) => id !== viewerId && me.friendIds.includes(id));
    if (memberIds.length < 2) continue;
    const members = memberIds.map((id) => ({ id, name: getUser(id)!.name, avatar: getUser(id)!.avatar, state: driftFor(viewerId, id).state, city: getUser(id)!.city }));
    const last = c.messages.filter((m) => m.status !== "draft").at(-1);
    // a line from the chat that proposes doing something: the crew's own hook
    const others = [...c.messages].reverse().filter((m) => m.senderId !== viewerId && m.status !== "draft");
    // the ORIGINAL ask (earliest strong match), else the latest weaker hint
    const hook = [...others].reverse().find((m) => /who'?s in|reunion|we should|let'?s do/i.test(m.text)) ?? others.find((m) => /hear me out|come to|this winter|weekend/i.test(m.text));
    out.push({ id: c.id, name: c.name ?? members.map((m) => m.name.split(" ")[0]).join(", "), kind: "chat", memberIds, members, quiet: members.filter((m) => m.state !== "awake").length, lastTogether: last ? dayOf(last.createdAt) : undefined, hook: hook ? { text: hook.text, authorId: hook.senderId, messageId: hook.id } : undefined });
    memberIds.forEach((id) => covered.add(`${id}`));
  }
  const byLabel = new Map<string, ID[]>();
  for (const [fid, label] of Object.entries(me.friendLabels ?? {})) {
    const key = label.replace(/\s*\+.*$/, "").trim();
    byLabel.set(key, [...(byLabel.get(key) ?? []), fid]);
  }
  for (const [label, ids] of byLabel) {
    if (ids.length < 3 || ids.every((id) => covered.has(id))) continue;
    const members = ids.map((id) => ({ id, name: getUser(id)!.name, avatar: getUser(id)!.avatar, state: driftFor(viewerId, id).state, city: getUser(id)!.city }));
    out.push({ id: `label:${label}`, name: label, kind: "label", memberIds: ids, members, quiet: members.filter((m) => m.state !== "awake").length });
  }
  return out.sort((a, b) => b.quiet / b.memberIds.length - a.quiet / a.memberIds.length);
}

export interface Place { city: string; cityName: string; friends: { id: ID; name: string; avatar: string; state: DriftState }[]; quiet: number; ride?: { id: string; driverName: string; departAt: string; seatsOpen: number } }
/** Cities other than home with 2+ friends; the quieter the city, the higher. A visible ride there is noted. */
export function placesFor(viewerId: ID): Place[] {
  const me = getUser(viewerId);
  if (!me) return [];
  const by = new Map<string, Place["friends"]>();
  for (const fid of me.friendIds) {
    const u = getUser(fid)!;
    if (!u.city || u.city === me.city) continue;
    by.set(u.city, [...(by.get(u.city) ?? []), { id: fid, name: u.name, avatar: u.avatar, state: driftFor(viewerId, fid).state }]);
  }
  return [...by]
    .filter(([, f]) => f.length >= 2)
    .map(([city, friends]) => {
      const r = db().rides.find((r) => r.toCity === city && r.fromCity === me.city && r.seatsOpen > 0 && me.friendIds.includes(r.driverId) && new Date(r.departAt).getTime() > Date.now());
      return { city, cityName: cityById(city)?.name ?? city, friends, quiet: friends.filter((f) => f.state !== "awake").length, ride: r ? { id: r.id, driverName: getUser(r.driverId)!.name, departAt: r.departAt, seatsOpen: r.seatsOpen } : undefined };
    })
    .sort((a, b) => b.quiet - a.quiet || b.friends.length - a.friends.length);
}

export interface CultureCard { groupId: string; groupName: string; event: { id: string; title: string; startsAt: string; location: string; price?: string }; friendsGoing: { id: ID; name: string; avatar: string }[]; lastWent?: string }
const CULTURE_TAGS = /culture|heritage|faith|food|language|community|hometown|diaspora/i;
/** Groups the viewer belongs to with culture-ish tags that have an upcoming event friends are going to. */
export function cultureFor(viewerId: ID): CultureCard[] {
  const me = getUser(viewerId);
  if (!me) return [];
  const out: CultureCard[] = [];
  for (const g of db().groups) {
    if (!g.memberIds.includes(viewerId) || !g.tags.some((t) => CULTURE_TAGS.test(t))) continue;
    const upcoming = db().events.filter((e) => e.hostGroupId === g.id && new Date(e.startsAt).getTime() > Date.now()).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
    if (!upcoming) continue;
    const friendsGoing = [...upcoming.going, ...upcoming.interested].filter((id) => me.friendIds.includes(id)).map((id) => ({ id, name: getUser(id)!.name, avatar: getUser(id)!.avatar }));
    if (!friendsGoing.length) continue;
    const lastWent = db().events.filter((e) => e.hostGroupId === g.id && e.going.includes(viewerId) && new Date(e.startsAt).getTime() < Date.now()).sort((a, b) => b.startsAt.localeCompare(a.startsAt))[0];
    out.push({ groupId: g.id, groupName: g.name, event: { id: upcoming.id, title: upcoming.title, startsAt: upcoming.startsAt, location: upcoming.location, price: upcoming.price }, friendsGoing, lastWent: lastWent ? dayOf(lastWent.startsAt) : undefined });
  }
  return out;
}

/** The reactivation number for the eval: how many of someone's friends are asleep, and how many of those have a post to hang a nudge on. */
export function reactivationStats(viewerId: ID) {
  const list = driftList(viewerId);
  const asleep = list.filter((c) => c.state !== "awake");
  return { friends: list.length, asleep: asleep.length, napping: list.filter((c) => c.state === "napping").length, withHistory: asleep.filter((c) => c.sharedCount > 0).length, withTrigger: asleep.filter((c) => c.recentPost).length };
}

export type { Post };

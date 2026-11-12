// "Why now": one line that links a friend's new post to something the two of you actually share, with citations
// code can check. Muse Spark picks the link and the words; code decides whether any of it is allowed on screen:
//   - every cited id must be in the shared index (both people in it) and must not be the trigger post itself
//   - no mood or health words, no guilt ("miss you", "it's been too long")
//   - only for direct friends, only when the friendship is sleepy or napping (or the pick is mutual)
//   - at most one unprompted nudge per person per day
import { ai } from "@/lib/ai";
import { db, getUser, notify } from "@/server/db";
import type { ID } from "@/types";
import { canSeePost, connection } from "@/lib/travel/visibility";
import { driftFor, driftList, recentPostBy, type RecentPost } from "./drift";
import { checkEvidence, sharedEvidence } from "./evidence";
import { isMutual, reconnectStore, type Evidence, type Nudge } from "./store";

export const BANNED = /\b(depress\w*|anxi\w*|lonely|loneliness|grie\w+|sick|illness|hospital|therap\w*|mental|struggl\w*|miss(?:ing|ed|es)?\s+you|too long|guilt\w*|sorry for|you never|should have)\b/i;
const first = (id: ID) => getUser(id)?.name.split(" ")[0] ?? id;

const SCHEMA = {
  type: "object",
  properties: {
    line: { type: "string", description: "One sentence, max 22 words, lowercase-leaning, written TO the user about the friend. Name the specific shared thing. No mood/health words, no 'miss you', no guilt." },
    evidenceIds: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3, description: "Ids from the SHARED HISTORY list only. Never the trigger post." },
    suggestion: { type: "string", enum: ["plan", "hi"], description: "plan = worth making a concrete plan; hi = a quick message is the right size." },
  },
  required: ["line", "evidenceIds", "suggestion"],
};

function postAsTrigger(viewerId: ID, friendId: ID, postId: string): RecentPost | undefined {
  const p = db().posts.find((x) => x.id === postId && x.authorId === friendId);
  return p && canSeePost(viewerId, p) ? { id: p.id, text: p.text, createdAt: p.createdAt, image: p.images?.[0], city: p.city } : undefined;
}
const key = (v: ID, f: ID, t?: string) => `${v}|${f}|${t ?? ""}`;
const fmt = (d: string) => new Date(d + "T12:00:00").toLocaleString("en-US", { month: "short", year: "numeric" });

export interface WhyNowOpts { triggerId?: string; force?: boolean; mutual?: boolean }

/** The nudge for one friend, cached per (viewer, friend, trigger). Returns null when code refuses to show one. */
export async function whyNow(viewerId: ID, friendId: ID, opts: WhyNowOpts = {}): Promise<Nudge | null> {
  const me = getUser(viewerId);
  const friend = getUser(friendId);
  if (!me || !friend) return null;
  if (connection(viewerId, friendId)?.degree !== 1) return null; // friends only, ever
  const drift = driftFor(viewerId, friendId);
  const mutual = isMutual(viewerId, friendId);
  if (drift.state === "awake" && !mutual && !opts.force) return null;
  const trigger: RecentPost | undefined = opts.triggerId ? postAsTrigger(viewerId, friendId, opts.triggerId) : recentPostBy(viewerId, friendId, 14);
  const k = key(viewerId, friendId, trigger?.id);
  const cached = reconnectStore().nudges.get(k);
  if (cached && !opts.force) return cached.dropped ? null : cached;

  const index = sharedEvidence(viewerId, friendId);
  const id = `nudge_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const base = { id, viewerId, friendId, triggerId: trigger?.id, mutual, createdAt: new Date().toISOString() };
  if (!index.length) {
    const n: Nudge = { ...base, line: "", evidenceIds: [], evidence: [], suggestion: "hi", mode: "code", costUsd: 0, dropped: "no shared history we can see" };
    reconnectStore().nudges.set(k, n);
    return null;
  }
  const list = index.slice(0, 14).map((e) => `- id=${e.id} (${e.kind}, ${fmt(e.date)}): ${e.text.slice(0, 150)}`).join("\n");
  const since = drift.daysSince === null ? "a long time" : drift.daysSince < 14 ? `${drift.daysSince} days` : `${Math.round(drift.daysSince / 7)} weeks`;
  const prompt = `${first(viewerId)} and ${friend.name} are friends (${connection(viewerId, friendId)?.label}). Their last real exchange was ${since} ago.${trigger ? `\n\nTRIGGER (the friend's new post, ${new Date(trigger.createdAt).toLocaleString("en-US", { month: "short", day: "numeric" })}${trigger.city ? `, from ${trigger.city}` : ""}): "${trigger.text.slice(0, 220)}"` : "\n\nNo new post from the friend; find a reason in the shared history alone."}\n\nSHARED HISTORY (the only things you may cite, by id):\n${list}\n\nWrite the one line ${first(viewerId)} sees under ${trigger ? "that post" : `${first(friendId)}'s name`}: what in their shared history makes this the moment. Be specific and concrete (a place, a thing they did, a line ${first(friendId)} once said). Cite 1–3 ids. Decide if it's a plan or a hi.`;
  const mockLine = () => {
    const e = index.find((x) => x.kind === "photo") ?? index[0];
    return { line: `(mock) ${trigger ? `${first(friendId)} just posted.` : `${first(friendId)} has been quiet.`} you two: ${e.text.slice(0, 60).toLowerCase()}`, evidenceIds: [e.id], suggestion: "plan" as const };
  };
  let line = "";
  let ids: string[] = [];
  let suggestion: Nudge["suggestion"] = "plan";
  let mode = "live";
  let costUsd = 0;
  let raw: Nudge["raw"];
  try {
    const { data, trace } = await ai.json<{ line: string; evidenceIds: string[]; suggestion: "plan" | "hi" }>(prompt, { task: "reconnect.whynow", userId: viewerId, schema: SCHEMA, maxTokens: 500, temperature: 0.5, mock: mockLine });
    line = (data.line ?? "").trim();
    ids = Array.isArray(data.evidenceIds) ? data.evidenceIds.map(String) : [];
    suggestion = data.suggestion === "hi" ? "hi" : "plan";
    mode = trace.mode;
    costUsd = trace.costUsd ?? 0;
    raw = { line, evidenceIds: ids };
  } catch (err) {
    const n: Nudge = { ...base, line: "", evidenceIds: [], evidence: [], suggestion: "hi", mode: "error", costUsd: 0, dropped: `model error: ${(err as Error).message.slice(0, 80)}` };
    reconnectStore().nudges.set(k, n);
    return null;
  }
  // code decides
  const check = checkEvidence(ids, index, trigger?.id);
  let dropped: string | undefined;
  if (!check.ok && !check.ids.length) dropped = check.reason;
  else if (!line || line.split(/\s+/).length > 30) dropped = "line missing or too long";
  else if (BANNED.test(line)) dropped = `banned word: ${line.match(BANNED)?.[0]}`;
  const evidenceIds = check.ids;
  const evidence = evidenceIds.map((i) => index.find((e) => e.id === i)!).filter(Boolean) as Evidence[];
  const n: Nudge = { ...base, line, evidenceIds, evidence, suggestion, mode, costUsd, raw, dropped };
  reconnectStore().nudges.set(k, n);
  return dropped ? null : n;
}

export interface DailyNudge { nudge: Nudge; friend: { id: ID; name: string; avatar: string; city?: string }; post?: RecentPost; drift: ReturnType<typeof driftFor> }

/** One unprompted nudge per person per day: the best drifted friend with a fresh post. Notifies once. */
export async function dailyNudge(viewerId: ID): Promise<DailyNudge | null> {
  const todayKey = new Date().toISOString().slice(0, 10);
  const s = reconnectStore();
  const d = s.daily.get(viewerId);
  if (d && d.date === todayKey) {
    if (!d.nudgeId) return null;
    const n = [...s.nudges.values()].find((x) => x.id === d.nudgeId);
    return n ? pack(n) : null;
  }
  const candidates = driftList(viewerId).filter((c) => c.state !== "awake" && c.sharedCount > 0 && c.recentPost).sort((a, b) => Number(b.mutual) - Number(a.mutual) || b.recentPost!.createdAt.localeCompare(a.recentPost!.createdAt)).slice(0, 3);
  for (const c of candidates) {
    const n = await whyNow(viewerId, c.friendId, { triggerId: c.recentPost!.id });
    if (!n) continue;
    s.daily.set(viewerId, { date: todayKey, nudgeId: n.id, notified: true });
    const friend = getUser(c.friendId)!;
    const where = c.recentPost?.city ? ` from ${c.cityName ?? c.recentPost.city}` : "";
    notify(viewerId, { actorId: c.friendId, type: "reconnect", text: `**${friend.name}** just posted${where}. ${n.line}`, href: `/reconnect/${c.friendId}` });
    return pack(n);
  }
  s.daily.set(viewerId, { date: todayKey, notified: false });
  return null;
  function pack(n: Nudge): DailyNudge {
    const f = getUser(n.friendId)!;
    return { nudge: n, friend: { id: f.id, name: f.name, avatar: f.avatar, city: f.city }, post: n.triggerId ? recentPostBy(viewerId, n.friendId, 60) : undefined, drift: driftFor(viewerId, n.friendId) };
  }
}

/** Cached nudges for the Inspector and the eval. */
export const allNudges = () => [...reconnectStore().nudges.values()];

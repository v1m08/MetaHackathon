// Live demo: "drop" today's game into a group chat. Opens an Order Up! restaurant on the game server, posts the game
// card in the thread, and has Muse write each member a one-line nudge that lands as a Facebook notification (and pops
// up as a banner on whatever page they're on, src/components/GameNudge.tsx). Also warms Muse's post-game ideas so the
// first judge to finish doesn't wait on the model.
import { ai } from "@/lib/ai";
import { db, getConversation, getUser, newId, sendMessage } from "@/server/db";
import type { ID, Notification } from "@/types";
import { clearChatPicksCadence } from "@/lib/events/chatPicks";
import { ideasFor } from "./museIdeas";

export const DEMO_THREAD = process.env.DEMO_THREAD || "c_judges";
const SQ = `http://127.0.0.1:${process.env.SIDEQUEST_PORT || 5180}`;
const first = (id: ID) => getUser(id)?.name.split(" ")[0] ?? id;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export interface DropResult {
  conversationId: ID;
  ref: string;
  title: string;
  notified: { userId: ID; text: string }[];
  source: "muse" | "fallback";
}

async function openRestaurant(topic: string): Promise<{ id: string; title: string }> {
  const r = await fetch(`${SQ}/api/k/new`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ interest: topic }), signal: AbortSignal.timeout(120_000) });
  const body = (await r.json().catch(() => ({}))) as { id?: string; error?: string };
  if (!r.ok || !body.id) throw Object.assign(new Error(body.error ?? `game server said ${r.status}. Is \`npm run sidequest\` running?`), { status: 502 });
  const room = (await fetch(`${SQ}/api/k/${body.id}`).then((x) => x.json()).catch(() => ({}))) as { menu?: { name?: string } };
  return { id: body.id, title: room.menu?.name ?? cap(topic) };
}

async function nudges(conversationId: ID, recipients: ID[], gameTitle: string, byId: ID): Promise<{ lines: Record<ID, string>; source: "muse" | "fallback" }> {
  const c = getConversation(conversationId)!;
  const chat = c.name ?? "your chat";
  const fallback = Object.fromEntries(recipients.map((id) => [id, id === byId ? `Today's game is live in ${chat}: ${gameTitle}. Post a score first 🎮` : `${first(byId)} dropped today's game in ${chat}: ${gameTitle}. Your turn 🎮`]));
  const chatLines = c.messages.filter((m) => !m.attachment && m.text).slice(-12).map((m) => `${first(m.senderId)}: ${m.text}`).join("\n");
  try {
    const once = () => ai.json<{ nudges: { userId: string; text: string }[] }>(
      `Write a short Facebook notification for each person below, nudging them to play today's game in their group chat "${chat}". The game is "${gameTitle}", started by ${first(byId)} (if the person IS ${first(byId)}, tell them the crew is waiting on their score instead). Make each one personal and playful (use their interests or something they said in the chat), under 90 characters, no hashtags.

People: ${recipients.map((id) => `${id} = ${first(id)} (likes ${getUser(id)?.interests.slice(0, 4).join(", ")})`).join("; ")}

Recent messages in the chat:
${chatLines}`,
      {
        task: "drop.nudge",
        userId: byId,
        schema: { type: "object", properties: { nudges: { type: "array", items: { type: "object", properties: { userId: { type: "string", enum: recipients }, text: { type: "string" } }, required: ["userId", "text"] } } }, required: ["nudges"] },
        temperature: 0.9,
        maxTokens: 2500,
        reasoning: "low",
        mock: () => ({ nudges: [] }),
      },
    );
    const call = once().catch(() => once());
    const { data } = await Promise.race([call, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("slow")), 25_000))]);
    const lines: Record<ID, string> = { ...fallback };
    let got = 0;
    for (const n of data.nudges ?? []) {
      if (recipients.includes(n.userId) && n.text?.trim()) {
        lines[n.userId] = n.text.trim().slice(0, 120);
        got++;
      }
    }
    return { lines, source: got ? "muse" : "fallback" };
  } catch {
    return { lines: fallback, source: "fallback" };
  }
}

/** Drops today's game into `conversationId` as `by`, notifies every member, and warms the post-game ideas. */
export async function dropGame(opts: { conversationId?: ID; topic?: string; by?: ID } = {}): Promise<DropResult> {
  const conversationId = opts.conversationId || DEMO_THREAD;
  const c = getConversation(conversationId);
  if (!c) throw Object.assign(new Error(`No chat ${conversationId}`), { status: 404 });
  const by = opts.by && c.participantIds.includes(opts.by) ? opts.by : c.participantIds[0];
  const topic = (opts.topic || "tacos").trim().slice(0, 60);

  const room = await openRestaurant(topic);
  // A new game for the demo: every seat gets the post-game sheet again, even if they saw one earlier today.
  clearChatPicksCadence(c.id);
  const ref = `k:${room.id}`;
  sendMessage(c.id, by, `🎮 Order Up!: ${cap(topic)}`, { type: "sqgame", ref });

  // Everyone gets the nudge, the dropper included: in the demo every seat is a judge holding a phone.
  const recipients = c.participantIds;
  const { lines, source } = await nudges(c.id, recipients, room.title, by);
  const at = new Date().toISOString();
  for (const id of recipients) {
    const n: Notification = { id: newId("n"), userId: id, actorId: by, type: "game", text: lines[id], href: `/messages/${c.id}?game=${encodeURIComponent(ref)}`, createdAt: at, read: false };
    db().notifications.unshift(n);
  }

  // Warm Muse's ideas for this game in the background so the post-game sheet is instant.
  void ideasFor(c.id, ref, by).catch(() => {});

  return { conversationId: c.id, ref, title: room.title, notified: recipients.map((id) => ({ userId: id, text: lines[id] })), source };
}

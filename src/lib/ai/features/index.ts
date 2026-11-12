// Example features built on the AI layer. Copy one of these as the starting point for your own feature.
// Each one: gathers context from the store → calls `ai.*` with a task label → returns typed data.
import { ai } from "@/lib/ai";
import { allTools, getGroupPosts, getUserProfile } from "@/lib/ai/tools";
import { db, feedFor, getGroup, getUser, postsInGroup, requireUser } from "@/server/db";
import type { ToolDef } from "@/lib/ai/types";

/** Composer: rewrite a draft in a tone, or suggest post ideas from the user's recent world. */
export async function composeSuggestions(userId: string, draft: string, tone: string, groupId?: string) {
  const me = requireUser(userId);
  const group = groupId ? getGroup(groupId) : undefined;
  const recent = feedFor(userId).slice(0, 8).map((p) => `- ${getUser(p.authorId)?.name.split(" ")[0]}: ${p.text.slice(0, 140)}`).join("\n");
  const schema = { type: "object", properties: { suggestions: { type: "array", items: { type: "string", description: "A complete post, 1–3 sentences, in the user's voice" }, minItems: 3, maxItems: 3 } }, required: ["suggestions"] };
  const context = `User: ${me.name}, ${me.age}, ${me.work ?? me.school}. Bio: "${me.bio}". Interests: ${me.interests.join(", ")}.${group ? `\nPosting in group "${group.name}": ${group.description}` : ""}\nWhat their friends posted recently:\n${recent}`;
  const prompt = draft.trim()
    ? `${context}\n\nRewrite this draft in a ${tone} tone, keeping the facts. Give 3 variants.\nDraft: """${draft}"""`
    : `${context}\n\nSuggest 3 ${tone} posts this user might plausibly write right now, grounded in their bio and what's going on with their friends. Sound like a real 20-something, not a brand.`;
  const friendPost = feedFor(userId).find((p) => p.authorId !== userId);
  const friend = friendPost ? getUser(friendPost.authorId)?.name.split(" ")[0] : "everyone";
  const [i1, i2] = me.interests;
  const mock = () =>
    draft.trim()
      ? { suggestions: [draft.trim().replace(/\.$/, "") + (tone === "funny" ? " (no I will not be taking questions)" : tone === "hype" ? " LET'S GO 🔥" : tone === "heartfelt" ? ". genuinely grateful for this one." : "."), draft.trim().split(/(?<=[.!?])\s+/)[0], `ok so. ${draft.trim().charAt(0).toLowerCase()}${draft.trim().slice(1)}`] }
      : { suggestions: [`${i1} ${tone === "hype" ? "was unreal today" : "day"}. if you know, you know.`, `saw ${friend}'s post and now I need everyone to come to the next thing. who's in?`, `${me.age} and still figuring out ${i2}. progress not perfection or whatever`] };
  const { data } = await ai.json<{ suggestions: string[] }>(prompt, { task: draft.trim() ? "compose.rewrite" : "compose.ideas", userId, schema, temperature: 0.9, mock });
  return data;
}

export interface GroupDigest {
  summary: string;
  highlights: { title: string; detail: string }[];
  actionItems: string[];
  vibe: string;
}

/** Group "Catch me up": tool-calling loop (fetches posts + the user's profile) then a structured digest. */
export async function groupDigest(userId: string, groupId: string): Promise<GroupDigest> {
  const me = requireUser(userId);
  const g = getGroup(groupId);
  if (!g) throw Object.assign(new Error("Group not found"), { status: 404 });

  // Step 1: let the model pull what it needs via tools.
  const research = await ai.tools(`Research what has been happening in the group with id "${g.id}" over the last few weeks, and what user "${me.id}" cares about, so you can brief them. Call tools as needed, then reply with concise notes.`, {
    task: "digest.research",
    userId,
    tools: [getGroupPosts as ToolDef, getUserProfile as ToolDef],
    maxSteps: 4,
  });

  // Step 2: structured output. In mock mode the notes are a stub, so include real posts directly too.
  const posts = postsInGroup(groupId).slice(0, 15).map((p) => `${getUser(p.authorId)?.name.split(" ")[0]} (${p.createdAt.slice(0, 10)}): ${p.text.slice(0, 220)}${p.comments.length ? ` [${p.comments.length} comments, e.g. "${p.comments[0].text.slice(0, 80)}"]` : ""}`).join("\n");
  const schema = {
    type: "object",
    properties: {
      summary: { type: "string", description: "2–3 sentence recap written to the user, mentioning names" },
      highlights: { type: "array", minItems: 3, maxItems: 5, items: { type: "object", properties: { title: { type: "string", description: "Short headline" }, detail: { type: "string", description: "One sentence with the specifics" } }, required: ["title", "detail"] } },
      actionItems: { type: "array", maxItems: 3, items: { type: "string", description: "Something this specific user could do, e.g. RSVP, reply, bring an item" } },
      vibe: { type: "string", description: "One or two words describing the group's mood" },
    },
    required: ["summary", "highlights", "actionItems", "vibe"],
  };
  // Mock digest built from the real posts, so it reads right without a key.
  const mock = (): GroupDigest => {
    const top = [...postsInGroup(groupId)].sort((a, b) => Object.values(b.reactions).flat().length - Object.values(a.reactions).flat().length).slice(0, 4);
    const name = (id: string) => getUser(id)?.name.split(" ")[0] ?? id;
    return {
      summary: `Since you last checked, ${g.name.split(" (")[0]} has been active. ${top.slice(0, 2).map((p) => `${name(p.authorId)} posted about "${p.text.slice(0, 60).trim()}…" (${p.comments.length} comments)`).join(" and ")}.`,
      highlights: top.map((p) => ({ title: `${name(p.authorId)}: ${p.text.split(/[.!?\n]/)[0].slice(0, 48)}`, detail: p.comments[0] ? `${name(p.comments[0].authorId)} replied: "${p.comments[0].text.slice(0, 90)}"` : p.text.slice(0, 100) })),
      actionItems: [`Reply to ${name(top[0]?.authorId ?? "")}'s post`, ...(db().events.find((e) => e.hostGroupId === groupId) ? [`RSVP to ${db().events.find((e) => e.hostGroupId === groupId)!.title}`] : []), `Say hi to the ${g.memberIds.length} members you haven't talked to`].slice(0, 3),
      vibe: ["upbeat", "supportive", "busy", "chaotic good"][g.name.length % 4],
    };
  };
  const { data } = await ai.json<GroupDigest>(
    `Brief ${me.name.split(" ")[0]} (${me.bio}) on the group "${g.name}".\n\nResearch notes:\n${research.text}\n\nRecent posts:\n${posts}\n\nWrite the digest for ${me.name.split(" ")[0]} specifically.`,
    { task: "digest.write", userId, schema, temperature: 0.5, mock },
  );
  return data;
}

/** Marketplace: draft a listing from a few words. */
export async function draftListing(userId: string, hint: string) {
  const me = requireUser(userId);
  const schema = { type: "object", properties: { title: { type: "string", description: "Marketplace title, under 60 chars" }, description: { type: "string", description: "2–4 sentence honest description in the seller's voice" }, price: { type: "number", description: "Fair asking price in USD" }, category: { type: "string", enum: ["Furniture", "Electronics", "Bikes", "Sporting Goods", "Clothing", "Plants", "Books", "Tickets", "Musical Instruments", "Misc"] } }, required: ["title", "description", "price", "category"] };
  const mock = () => ({ title: hint ? hint.charAt(0).toUpperCase() + hint.slice(1, 56) : "Barely used desk lamp", description: `${hint ? hint.charAt(0).toUpperCase() + hint.slice(1) : "Desk lamp"}. Good condition, a couple of scuffs you won't notice. Selling because I'm moving. Pickup in ${me.location}, cash or Venmo.`, price: 40 + (hint.length % 7) * 15, category: /bike/i.test(hint) ? "Bikes" : /desk|couch|chair|table|shelf/i.test(hint) ? "Furniture" : /plant/i.test(hint) ? "Plants" : "Misc" });
  const { data } = await ai.json<{ title: string; description: string; price: number; category: string }>(`Seller: ${me.name}, ${me.bio}. They want to sell: "${hint || "something they no longer need"}". Draft the listing.`, { task: "listing.draft", userId, schema, mock });
  return data;
}

/** Playground: used by the Inspector to demo each capability. */
export async function playground(userId: string, kind: "text" | "json" | "image" | "tools", prompt: string) {
  switch (kind) {
    case "text":
      return (await ai.text(prompt, { task: "playground.text", userId })).text;
    case "json":
      return (await ai.json(prompt, { task: "playground.json", userId, schema: { type: "object", properties: { answer: { type: "string" }, confidence: { type: "number" }, tags: { type: "array", items: { type: "string" } } }, required: ["answer", "confidence", "tags"] } })).data;
    case "image":
      return (await ai.image(prompt, { task: "playground.image", userId, size: "512x512" })).url;
    case "tools":
      return (await ai.tools(prompt, { task: "playground.tools", userId, tools: allTools })).text;
  }
}

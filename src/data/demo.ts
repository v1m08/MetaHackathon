// Seed for the hackathon demo: our team as 5 friends around SF (3 of them hike), their posts, the "weekend plans"
// group chat, the Muse bot, and the Bay Area events Muse can suggest. They're only friends with each other, so
// their feeds are all SF. Photos in public/demo/ (scripts/demo-images.ts).
import { DEMO_CHAT, DEMO_IDS, MUSE_ID } from "@/lib/demo";
import { museAvatarFor } from "@/lib/museAvatar";
import type { Comment, Conversation, FBEvent, Post, ReactionType, Story, User } from "@/types";
import { daysAgo, hoursAgo, inDays, uid } from "./helpers";

const img = (key: string) => `/demo/${key}.jpg`;
const cast = DEMO_IDS as readonly string[];

/** Where each person lives (Muse uses this) and whether they hike. */
export const DEMO_CAST: Record<string, { hood: string; hikes: boolean }> = {
  nivan: { hood: "the Mission", hikes: true },
  armaan: { hood: "Hayes Valley", hikes: false },
  vedansh: { hood: "Oakland", hikes: true },
  keira: { hood: "the Inner Sunset", hikes: true },
  abishek: { hood: "Berkeley", hikes: false },
};

const person = (u: Pick<User, "id" | "name" | "username" | "bio" | "location" | "interests"> & Partial<User>): User => ({
  avatar: museAvatarFor(u.id),
  cover: img("golden-gate"),
  age: 22,
  pronouns: "",
  joined: "2019-09-01T00:00:00.000Z",
  friendIds: cast.filter((id) => id !== u.id),
  work: "Building Sidequest @ Meta Hackathon",
  ...u,
});

export const demoUsers: User[] = [
  person({
    id: "nivan", name: "Nivan", username: "nivan.sf", location: "San Francisco, CA", cover: img("tam-sunrise"),
    bio: "Mission district · Mt. Tam at sunrise > sleep · hackathon goblin 🌄",
    interests: ["hiking", "Mt. Tam", "sunrise hikes", "Dolores Park", "hackathons"],
  }),
  person({
    id: "armaan", name: "Armaan", username: "armaan.eats", location: "San Francisco, CA", cover: img("burrito"),
    bio: "Hayes Valley · ranks every burrito in the Mission (current #1: La Taqueria, fight me) 🌯",
    interests: ["food spots", "burritos", "Dolores Park", "Giants games", "Valencia St"],
  }),
  person({
    id: "vedansh", name: "Vedansh", username: "vedansh.trails", location: "Oakland, CA", cover: img("mission-peak"),
    bio: "Oakland · chasing a Mission Peak PR · will drive anyone to a trailhead 🏔️",
    interests: ["hiking", "trail running", "Mission Peak", "Lake Merritt", "Warriors"],
  }),
  person({
    id: "keira", name: "Keira", username: "keira.fog", location: "San Francisco, CA", cover: img("lands-end"),
    bio: "Inner Sunset · fog is a personality · Lands End loop every Sunday 🌁",
    interests: ["hiking", "Lands End", "Ocean Beach", "film photos", "coffee"],
  }),
  person({
    id: "abishek", name: "Abishek", username: "abishek.bites", location: "Berkeley, CA", cover: img("off-the-grid"),
    bio: "Berkeley · Off the Grid every Friday · BART defender (unpopular) 🚇",
    interests: ["food trucks", "Off the Grid", "BART", "Berkeley Bowl", "board games"],
  }),
];

/** The bot that sends the group a game and suggests a plan. Not anyone's friend, so it never shows in feeds. */
export const museUser: User = {
  id: MUSE_ID, name: "Muse", username: "muse", avatar: museAvatarFor(MUSE_ID), cover: img("golden-gate"), age: 1, pronouns: "",
  bio: "your group chat's game master ✨ picks games from what you're into, then helps you make plans",
  location: "San Francisco, CA", joined: "2026-11-01T00:00:00.000Z", friendIds: [], interests: [],
};

// ---------- posts ----------
type C = [author: string, text: string];
let ci = 0;
const comments = (list: C[], postAt: string): Comment[] =>
  list.map(([authorId, text], k) => ({ id: `cm_demo_${++ci}`, authorId, text, createdAt: new Date(new Date(postAt).getTime() + (k + 1) * 23 * 60e3).toISOString(), likes: cast.filter((id) => id !== authorId).slice(0, (k % 3) + 1) }));
/** Reactions only from the cast (the shared seed builder would pull in the Austin crowd). */
const reacts = (author: string, love: number): Partial<Record<ReactionType, string[]>> => {
  const others = cast.filter((id) => id !== author);
  return { like: others.slice(love), love: others.slice(0, love) };
};
const post = (authorId: string, at: string, text: string, o: { image?: string; location?: string; love?: number; comments?: C[] } = {}): Post => ({
  id: uid("p"), authorId, createdAt: at, text, images: o.image ? [img(o.image)] : undefined, location: o.location,
  reactions: reacts(authorId, o.love ?? 2), comments: comments(o.comments ?? [], at), shares: 0, audience: "friends",
});

export const demoPosts: Post[] = [
  post("nivan", hoursAgo(20), "5:40am alarm, zero regrets. Mt. Tam above the fog 🌄 who's coming next time?", {
    image: "tam-sunrise", location: "Mount Tamalpais State Park", love: 3,
    comments: [["keira", "me. always me"], ["vedansh", "I'll drive, you bring coffee"], ["abishek", "5:40 is a crime"]],
  }),
  post("nivan", daysAgo(4), "hot take: Lands End beats Twin Peaks for sunset. no notes", {
    comments: [["keira", "finally someone said it"], ["armaan", "twin peaks has a parking lot though"]],
  }),
  post("nivan", daysAgo(9), "Battery Spencer with the fog under the bridge. this city is unfair", { image: "golden-gate", location: "Battery Spencer", love: 2 }),

  post("armaan", hoursAgo(9), "official burrito ranking update 🌯 1. La Taqueria 2. El Farolito 3. Taqueria Cancún. don't @ me", {
    image: "burrito", location: "The Mission, San Francisco", love: 1,
    comments: [["abishek", "farolito at 2am is #1 and you know it"], ["nivan", "ok but have you tried the one on 24th"], ["armaan", "there are 5 taquerias on 24th. be specific"]],
  }),
  post("armaan", daysAgo(3), "72° in November at Dolores Park. SF said surprise 🌞", {
    image: "dolores", location: "Mission Dolores Park", love: 3, comments: [["keira", "meanwhile the sunset: 54° and foggy"]],
  }),

  post("vedansh", hoursAgo(30), "Mission Peak summit pole in 58 min. new PR 🏔️ legs are gone", {
    image: "mission-peak", location: "Mission Peak Regional Preserve", love: 3,
    comments: [["nivan", "58?? ok I'm coming next time"], ["armaan", "why would you do this to yourself"]],
  }),
  post("vedansh", daysAgo(5), "Lake Merritt cool-down loop. Oakland sunsets are underrated", { image: "lake-merritt", location: "Lake Merritt, Oakland", love: 2 }),

  post("keira", hoursAgo(6), "Sunday Lands End loop ✔️ the cypress trees, the bridge, the cold. my happy place 🌁", {
    image: "lands-end", location: "Lands End, San Francisco", love: 4,
    comments: [["nivan", "the labyrinth at sunset next time?"], ["keira", "it's a date. bring everyone"], ["abishek", "is it uphill"]],
  }),
  post("keira", daysAgo(2), "Karl rolled in at 4pm again. Inner Sunset forecast: sweater", {
    image: "fog-sutro", comments: [["vedansh", "oakland is 75 and sunny 😌"]],
  }),

  post("abishek", hoursAgo(14), "Off the Grid Fridays are back. the bao truck alone is worth the BART ride", {
    image: "off-the-grid", location: "Fort Mason, San Francisco", love: 2, comments: [["armaan", "save me a bao"]],
  }),
  post("abishek", daysAgo(6), "unpopular opinion: BART is fine. it's the escalators that aren't 🚇", {
    image: "bart", comments: [["keira", "the escalators at civic center have never worked"], ["vedansh", "defending BART is wild"]],
  }),
];

export const demoStories: Story[] = [
  { id: "s_demo_1", userId: "keira", image: img("lands-end"), caption: "sunday loop 🌁", createdAt: hoursAgo(2) },
  { id: "s_demo_2", userId: "armaan", image: img("burrito"), caption: "research", createdAt: hoursAgo(4) },
  { id: "s_demo_3", userId: "vedansh", image: img("mission-peak"), caption: "PR 🏔️", createdAt: hoursAgo(7) },
  { id: "s_demo_4", userId: "abishek", image: img("off-the-grid"), caption: "friday", createdAt: hoursAgo(10) },
];

// ---------- the group chat ----------
const msgs: [string, number, string][] = [
  ["keira", 30, "lands end sunday again? I'm not asking I'm telling"],
  ["nivan", 29.8, "only if we do the labyrinth at sunset this time"],
  ["vedansh", 29.5, "I'm in. driving from oakland so someone lend me parking karma"],
  ["armaan", 29, "I'll come if there's a burrito after. non-negotiable"],
  ["abishek", 28.8, "can we do something that doesn't involve walking uphill for once 😭"],
  ["keira", 28.7, "abishek it's a coastal trail. it's flat. mostly"],
  ["nivan", 5, "ok but who actually knows the city best. armaan thinks he's a local because he knows 4 taquerias"],
  ["armaan", 4.9, "5 taquerias. and I'll prove it"],
  ["abishek", 4.8, "berkeley counts as the bay, don't forget about me"],
];
export const demoConversation: Conversation = {
  id: DEMO_CHAT,
  participantIds: [...cast, MUSE_ID],
  isGroup: true,
  name: "weekend plans 🌤️",
  emoji: "🌤️",
  messages: msgs.map(([senderId, h, text]) => ({ id: uid("m"), senderId, text, createdAt: hoursAgo(h), readBy: [...cast] })),
};

// ---------- events Muse can suggest ----------
export const demoEvents: FBEvent[] = [
  {
    id: "e_lands_end_hike", title: "Sunset Hike: Lands End Loop + Labyrinth", cover: img("event-lands-end"),
    startsAt: inDays(2, 16), endsAt: inDays(2, 18), location: "Lands End Lookout", address: "680 Point Lobos Ave, San Francisco, CA",
    category: "Outdoors", price: "Free",
    description: "An easy 3.4 mile loop on the coastal trail: cypress groves, Golden Gate views, and the Mile Rock labyrinth right as the sun goes down. Mostly flat, a few stairs. Bring a layer, it's SF.",
    going: [], interested: [],
  },
  {
    id: "e_burrito_crawl", title: "Mission Burrito Crawl", cover: img("event-burrito-crawl"),
    startsAt: inDays(4, 13), endsAt: inDays(4, 16), location: "24th St & Mission", address: "24th St BART, San Francisco, CA",
    category: "Food & Drink", price: "Pay as you go",
    description: "Four taquerias, four half-burritos, one official ranking at the end. Starts at 24th St BART.",
    going: [], interested: [],
  },
];

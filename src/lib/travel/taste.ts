// What does this person like? Built from their interests, the Reels they saved and the posts they reacted to,
// joined with the Muse image notes for the photos in that content. Used to match friends' media to the user.
import { mediaIdForUrl, mediaIndex } from "@/data/travel";
import { db, getUser } from "@/server/db";
import type { ID } from "@/types";

export const TASTE_KEYS = ["runners", "foodies", "music lovers", "photographers", "hikers", "night owls", "art people", "budget travellers", "thrifters", "swimmers", "cyclists", "coffee people", "families"] as const;
export type TasteKey = (typeof TASTE_KEYS)[number];

const INTEREST_MAP: [RegExp, TasteKey][] = [
  [/run/i, "runners"],
  [/food|taco|cook|eat|bbq|crawfish|brunch|ramen|pizza|chicken/i, "foodies"],
  [/music|dj|vinyl|band|song|jazz|concert|synth|house/i, "music lovers"],
  [/photo|film|35mm|camera/i, "photographers"],
  [/hik|trail|climb|boulder|backpack|camp|mountain|ski/i, "hikers"],
  [/nightlife|bar|late|dj|party|show/i, "night owls"],
  [/pottery|ceramic|art|design|illustrat|museum|mural|typograph|sew|cosplay|anime|architecture/i, "art people"],
  [/budget|cheap|thrift|deal|broke|saving/i, "budget travellers"],
  [/thrift|vintage|depop|flip/i, "thrifters"],
  [/swim|barton springs|lake|beach|pool/i, "swimmers"],
  [/cycl|bike|strava|gravel/i, "cyclists"],
  [/coffee|matcha|espresso|barista|tea|boba/i, "coffee people"],
];

export interface Taste {
  scores: Record<TasteKey, number>;
  top: TasteKey[];
  interests: string[];
  savedReelCaptions: string[];
  likedCities: string[];
  summary: string;
}

export function tasteFor(userId: ID): Taste {
  const me = getUser(userId);
  const scores = Object.fromEntries(TASTE_KEYS.map((k) => [k, 0])) as Record<TasteKey, number>;
  const bump = (text: string, w = 1) => {
    for (const [re, key] of INTEREST_MAP) if (re.test(text)) scores[key] += w;
  };
  const likedCities = new Set<string>();
  if (!me) return { scores, top: [], interests: [], savedReelCaptions: [], likedCities: [], summary: "" };
  for (const i of me.interests) bump(i, 2);
  bump(me.bio, 1);
  const saved = db().reels.filter((r) => r.savedBy.includes(userId));
  for (const r of saved) {
    bump(r.caption + " " + r.tags.join(" "), 2);
    const mid = mediaIdForUrl(r.image);
    const note = mid ? mediaIndex[mid] : undefined;
    note?.goodFor.forEach((g) => (scores[g as TasteKey] = (scores[g as TasteKey] ?? 0) + 2));
    if (r.city && r.city !== me.city) likedCities.add(r.city);
  }
  const liked = db().reels.filter((r) => r.likes.includes(userId) && !r.savedBy.includes(userId));
  for (const r of liked) bump(r.caption + " " + r.tags.join(" "), 1);
  const reacted = db().posts.filter((p) => Object.values(p.reactions).some((ids) => ids?.includes(userId)) || p.comments.some((c) => c.authorId === userId));
  for (const p of reacted) {
    bump(p.text, 1);
    for (const img of p.images ?? []) {
      const mid = mediaIdForUrl(img);
      mediaIndex[mid ?? ""]?.goodFor.forEach((g) => (scores[g as TasteKey] = (scores[g as TasteKey] ?? 0) + 1));
    }
    if (p.city && p.city !== me.city) likedCities.add(p.city);
  }
  const top = [...TASTE_KEYS].filter((k) => scores[k] > 0).sort((a, b) => scores[b] - scores[a]).slice(0, 5);
  const summary = top.length ? `into ${top.slice(0, 3).join(", ")}${top[3] ? ` and ${top[3]}` : ""}` : "no strong signals yet";
  return { scores, top, interests: me.interests, savedReelCaptions: saved.slice(0, 8).map((r) => r.caption), likedCities: [...likedCities], summary };
}

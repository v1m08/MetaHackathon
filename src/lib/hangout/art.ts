// Muse Image critter art: which animal each friendship becomes (from its memory file) and how the app
// describes it. Shared by scripts/generate-critters.ts (prompts) and the Hangout views (captions).
import { PLACES } from "@/data/hangout/seed";
import type { InsideJoke, SharedPlace } from "./types";

export type ArtKey = "ramen" | "goose" | "school" | "run" | "movies" | "swim" | "campus";

export const ART: Record<ArtKey, { species: string; color: string; detail: string; caption: (place: string) => string }> = {
  ramen: { species: "kitten with little pointed ears", color: "soft coral-pink", detail: "holding a tiny bowl of ramen", caption: (p) => `A kitten with a ramen bowl, for all those nights at ${p}.` },
  goose: { species: "baby goose with a small orange beak", color: "soft dove-grey", detail: "with a tiny white feather tucked behind one wing", caption: () => "A little goose, in honor of the goose incident." },
  school: { species: "bunny with tall ears", color: "soft butter-yellow", detail: "with a tiny star clip on one ear", caption: (p) => `A bunny with a star clip, for the ${p} days.` },
  run: { species: "fox with a fluffy cream-tipped tail", color: "soft peach-orange", detail: "wearing a tiny red sweatband", caption: (p) => `A fox in a sweatband, from your runs at ${p}.` },
  movies: { species: "bear cub with round ears", color: "warm honey-tan", detail: "wearing tiny round glasses", caption: (p) => `A bear cub in glasses, for movie nights at ${p}.` },
  swim: { species: "round baby seal with whiskers", color: "pale sky-blue", detail: "with a tiny pink flower on its head", caption: (p) => `A seal with a flower, for summers at ${p}.` },
  campus: { species: "penguin with a cream belly and a small yellow beak", color: "soft lilac", detail: "wearing a tiny backpack", caption: (p) => `A penguin with a backpack, from ${p}.` },
};

/** Pick the friendship's art theme: an inside joke first, then the first shared place with a matching kind. */
export function artKey(m: { sharedPlaces: SharedPlace[]; insideJokes: InsideJoke[] }): { key: ArtKey; place: string } {
  if (m.insideJokes.some((j) => /goose/i.test(j.phrase))) return { key: "goose", place: "" };
  for (const p of m.sharedPlaces) {
    const kind = PLACES.find((x) => x.name === p.name)?.kind;
    if (kind && kind in ART) return { key: kind as ArtKey, place: p.name };
  }
  const first = m.sharedPlaces[0]?.name ?? "";
  return { key: /lincoln|high/i.test(first) ? "school" : "campus", place: first };
}

export const artCaption = (m: Parameters<typeof artKey>[0]) => {
  const { key, place } = artKey(m);
  return ART[key].caption(place);
};

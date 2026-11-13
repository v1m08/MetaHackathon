// Which drawn critter each friend gets in the Hangout, and which image shows for a state.
// The art is Hang Again's (public/seed/critters/art), named after the Hang Again friend it was drawn for, one image
// per mood. Only friends listed here appear. The SVG parts are the fallback Critter draws for the egg.
import type { DesignLike } from "@/components/hangout/Critter";
import type { CritterState } from "@/lib/hangout/types";
import type { ID } from "@/types";

interface Art { art: string; animal: string; body: string; color: string; accessory: string }
export const CRITTER_ART: Record<ID, Art> = {
  jordan: { art: "maya", animal: "baby otter with a ramen bowl", body: "noodle", color: "peach", accessory: "scarf" },
  sofia: { art: "priya", animal: "kitten with a popcorn bucket", body: "blob", color: "peach", accessory: "glasses" },
  ethan: { art: "chris", animal: "bear cub in a sweatband", body: "pebble", color: "coral", accessory: "bandana" },
  aisha: { art: "dev", animal: "fluffy baby goose", body: "puff", color: "butter", accessory: "feather" },
  grace: { art: "jess", animal: "bunny with a flower", body: "bean", color: "lilac", accessory: "flower" },
  hannah: { art: "alex", animal: "baby frog with a swim ring", body: "pebble", color: "mint", accessory: "flower" },
  lucas: { art: "sam", animal: "baby turtle in a bandana", body: "pebble", color: "sky", accessory: "bandana" },
};

type Mood = "awake" | "sleepy" | "napping" | "celebrating";
/** Every friend has art for four moods; the other states borrow one (an egg is always drawn in SVG). */
export const moodFor = (s: CritterState): Mood | null => (s === "egg" ? null : s === "resting" ? "napping" : s === "hatching" ? "awake" : s);

export function critterDesign(friendId: ID, state: CritterState): DesignLike {
  const a = CRITTER_ART[friendId];
  const mood = moodFor(state);
  return { body: a.body, color: a.color, accessory: a.accessory, image: mood ? `/seed/critters/art/${a.art}-${mood}.webp` : undefined, imageOwn: true };
}

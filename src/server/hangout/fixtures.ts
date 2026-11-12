// Hand-written stand-ins for a good Muse run, shaped exactly like model output. Cached mode replays
// data/hangout/recorded.json first (saved from real live runs) and falls back to these.
// Once you have a key: run `npm run eval:moments -- --live --record` and `npm run memory:rebuild -- --live --record`.
import { CHATS, PHOTOS, PLACES } from "@/data/hangout/seed";
import { ART } from "@/lib/hangout/art";
import { keepsakeForKind, keepsakeLabel } from "@/lib/hangout/parts";
import type { CritterAi, KeepsakeAi, MemoryAi, PlanAi, WhyNow } from "@/lib/hangout/schemas";

const photosOf = (friendId: string) => PHOTOS.filter((p) => p.taggedFriendIds.includes("me") && p.taggedFriendIds.includes(friendId));
const placesFor = (friendId: string): MemoryAi["sharedPlaces"] => {
  const byPlace = new Map<string, string[]>();
  for (const p of photosOf(friendId)) byPlace.set(p.place, [...(byPlace.get(p.place) ?? []), p.id]);
  return [...byPlace].map(([name, photoIds]) => ({ name, photoIds }));
};
const photosAt = (friendId: string, place: string) => photosOf(friendId).filter((p) => p.place === place).map((p) => p.id);
const gooseIds = CHATS.filter((c) => c.friendId === "dev" && /goose/i.test(c.text)).map((c) => c.id);

const memory: Record<string, MemoryAi> = {
  maya: { sharedPlaces: placesFor("maya"), insideJokes: [] },
  dev: { sharedPlaces: placesFor("dev"), insideJokes: [{ phrase: "the goose incident", sourceIds: [...gooseIds, "ph_dev_01"] }] },
  jess: { sharedPlaces: placesFor("jess"), insideJokes: [] },
  sam: { sharedPlaces: placesFor("sam"), insideJokes: [] },
  priya: { sharedPlaces: placesFor("priya"), insideJokes: [] },
  chris: { sharedPlaces: placesFor("chris"), insideJokes: [] },
  alex: { sharedPlaces: placesFor("alex"), insideJokes: [] },
};

const art = (key: keyof typeof ART, place: string) => ({ animal: ART[key].species.split(" with ")[0], color: ART[key].color, detail: ART[key].detail, caption: ART[key].caption(place) });
const critter: Record<string, CritterAi> = {
  maya: { body: "noodle", color: "butter", accessory: "scarf", why: "Noodle body for all those Ramen Ya nights junior year.", art: art("ramen", "Ramen Ya") },
  dev: { body: "puff", color: "sky", accessory: "feather", why: "A feather, in honor of the goose incident.", art: art("goose", "") },
  jess: { body: "bean", color: "lilac", accessory: "star_clip", why: "A star clip for Friday night lights at Lincoln High.", art: art("school", "Lincoln High") },
  sam: { body: "pebble", color: "mint", accessory: "bandana", why: "A sweatband from Saturday Run Club.", art: art("run", "Lady Bird Lake Trail") },
  priya: { body: "blob", color: "mint", accessory: "glasses", why: "Glasses for movie nights at Alamo Drafthouse.", art: art("movies", "Alamo Drafthouse") },
  chris: { body: "pebble", color: "coral", accessory: "cap", why: "A cap from the stats group project at Gregory Gym.", art: art("campus", "Gregory Gym") },
  alex: { body: "blob", color: "peach", accessory: "flower", why: "A flower for summers at Barton Springs.", art: art("swim", "Barton Springs") },
};

const NO: WhyNow = { nudge: false, type: null, reason: "", evidenceIds: [], action: null, photoId: null };
const whyNow: Record<string, WhyNow> = {
  maya_ramen: { nudge: true, type: "place", reason: "Maya's back at Ramen Ya. You two came here 9 times junior year.", evidenceIds: photosAt("maya", "Ramen Ya"), action: "send_photo", photoId: "ph_maya_07" },
  dev_goose: { nudge: true, type: "joke", reason: "Dev just shared an angry goose Reel. The goose incident lives on.", evidenceIds: [...gooseIds, "ph_dev_01"], action: "say_hi", photoId: null },
  jess_moved: { nudge: true, type: "life_update", reason: "Jess just moved to Austin! You two go way back to Lincoln High football games.", evidenceIds: ["ph_jess_01", "ph_jess_02", "ph_jess_04"], action: "suggest_plan", photoId: null },
  priya_lunch: NO,
  chris_meme: NO,
};

const plan: Record<string, PlanAi> = {
  maya: { place: "Ramen Ya", slotId: "d3_evening", estCostPerPerson: 18, reason: "Back to the old spot for spicy miso. You're both free that night." },
  dev: { place: "Pease Park", slotId: "d1_afternoon", estCostPerPerson: 0, reason: "Pease Park again, scene of the goose incident. Free for both of you." },
  jess: { place: "Kerbey Lane Cafe", slotId: "d1_afternoon", estCostPerPerson: 16, reason: "Pancakes and a welcome-to-Austin tour. You're both free." },
  sam: { place: "Lady Bird Lake Trail", slotId: "d7_morning", estCostPerPerson: 0, reason: "Same trail as run club, coffee after. You're both free." },
  priya: { place: "Alamo Drafthouse", slotId: "d5_evening", estCostPerPerson: 17, reason: "Movie night at your usual spot." },
  chris: { place: "Spider House Cafe", slotId: "d2_evening", estCostPerPerson: 8, reason: "Quick coffee to catch up." },
  alex: { place: "Barton Springs", slotId: "d1_afternoon", estCostPerPerson: 5, reason: "One more swim before it gets cold." },
};

const keepsake: Record<string, KeepsakeAi> = Object.fromEntries(
  PLACES.map((p) => {
    const pin = keepsakeForKind(p.kind);
    return [p.name, { pin, why: p.kind === "ramen" ? "For spicy miso night." : `${keepsakeLabel(pin).replace(" pin", "")} for ${p.name}.` }];
  }),
);

export const FIXTURES: Record<string, unknown> = {
  ...Object.fromEntries(Object.entries(memory).map(([k, v]) => [`memory:${k}`, v])),
  ...Object.fromEntries(Object.entries(critter).map(([k, v]) => [`critter:${k}`, v])),
  ...Object.fromEntries(Object.entries(whyNow).map(([k, v]) => [`whyNow:${k}`, v])),
  ...Object.fromEntries(Object.entries(plan).map(([k, v]) => [`plan:${k}`, v])),
  ...Object.fromEntries(Object.entries(keepsake).map(([k, v]) => [`keepsake:${k}`, v])),
};

// Fixed critter parts library. The critter designer (Muse Wonder) may only pick IDs from here,
// and the SVG renderer in components/hangout/Critter.tsx draws exactly these.

export const BODIES = [
  { id: "blob", label: "Blob", hint: "classic round friend, good for easygoing everyday friends" },
  { id: "noodle", label: "Noodle", hint: "tall wiggly noodle, for food spots and ramen nights" },
  { id: "bean", label: "Bean", hint: "tilted bean, for school-days and long-history friends" },
  { id: "puff", label: "Puff", hint: "fluffy cloud, for silly friends and inside jokes" },
  { id: "pebble", label: "Pebble", hint: "low, sturdy pebble, for active and outdoorsy friends" },
] as const;

export const COLORS = [
  { id: "peach", label: "Peach", fill: "#FFB89A", shade: "#F39A78", cheek: "#FF8A7A" },
  { id: "mint", label: "Mint", fill: "#9BE3C4", shade: "#74CDA8", cheek: "#FF9AA2" },
  { id: "sky", label: "Sky", fill: "#9CCBFF", shade: "#74B0F2", cheek: "#FF9AB5" },
  { id: "lilac", label: "Lilac", fill: "#C9B5FF", shade: "#AC93F2", cheek: "#FF9AC8" },
  { id: "butter", label: "Butter", fill: "#FFE08A", shade: "#F5C95C", cheek: "#FF9A7A" },
  { id: "coral", label: "Coral", fill: "#FF9E9E", shade: "#F27C7C", cheek: "#E85D75" },
] as const;

export const ACCESSORIES = [
  { id: "none", label: "Nothing", hint: "no accessory" },
  { id: "beanie", label: "Beanie", hint: "cozy knit hat, cold-weather hangs" },
  { id: "party_hat", label: "Party hat", hint: "birthdays and celebrations" },
  { id: "bow", label: "Bow", hint: "cute bow" },
  { id: "headphones", label: "Headphones", hint: "music, concerts, playlists" },
  { id: "glasses", label: "Glasses", hint: "movies, studying, nerdy hangs" },
  { id: "flower", label: "Flower", hint: "summer, swimming, outdoors" },
  { id: "cap", label: "Cap", hint: "school, sports, group projects" },
  { id: "scarf", label: "Scarf", hint: "warm, cozy, food and comfort" },
  { id: "feather", label: "Feather", hint: "birds, geese, animal chaos" },
  { id: "sprout", label: "Sprout", hint: "new beginnings, someone just moved or started something" },
  { id: "star_clip", label: "Star clip", hint: "school spirit, friday nights, nostalgia" },
  { id: "bandana", label: "Sweatband", hint: "running, workouts, run club" },
] as const;

export const KEEPSAKES = [
  { id: "chopsticks", label: "Chopsticks pin", kinds: ["ramen"] },
  { id: "coffee", label: "Coffee cup pin", kinds: ["coffee"] },
  { id: "sneaker", label: "Sneaker pin", kinds: ["run"] },
  { id: "wave", label: "Wave pin", kinds: ["swim"] },
  { id: "leaf", label: "Leaf pin", kinds: ["park", "salad"] },
  { id: "ticket", label: "Ticket pin", kinds: ["movies"] },
  { id: "taco", label: "Taco pin", kinds: ["tacos"] },
  { id: "pancake", label: "Pancake pin", kinds: ["diner"] },
  { id: "music", label: "Music note pin", kinds: ["concert"] },
  { id: "star", label: "Star pin", kinds: [] as string[] },
] as const;

export type BodyId = (typeof BODIES)[number]["id"];
export type ColorId = (typeof COLORS)[number]["id"];
export type AccessoryId = (typeof ACCESSORIES)[number]["id"];
export type KeepsakeId = (typeof KEEPSAKES)[number]["id"];

export const BODY_IDS = BODIES.map((b) => b.id) as [BodyId, ...BodyId[]];
export const COLOR_IDS = COLORS.map((c) => c.id) as [ColorId, ...ColorId[]];
export const ACCESSORY_IDS = ACCESSORIES.map((a) => a.id) as [AccessoryId, ...AccessoryId[]];
export const KEEPSAKE_IDS = KEEPSAKES.map((k) => k.id) as [KeepsakeId, ...KeepsakeId[]];

export const colorById = (id: string) => COLORS.find((c) => c.id === id) ?? COLORS[0];
export const keepsakeLabel = (id: string) => KEEPSAKES.find((k) => k.id === id)?.label ?? id;
/** Code fallback when the keepsake picker fails: map the place kind to a pin. */
export const keepsakeForKind = (kind: string): KeepsakeId => (KEEPSAKES.find((k) => (k.kinds as readonly string[]).includes(kind))?.id ?? "star") as KeepsakeId;

/** Plant theme uses the same states under different names. */
export const PLANT_STATE_LABEL = { awake: "Thriving", sleepy: "Thirsty", napping: "Dormant", celebrating: "Blooming", egg: "Seed", hatching: "Sprouting", resting: "Resting" } as const;
export const CRITTER_STATE_LABEL = { awake: "Awake", sleepy: "Sleepy", napping: "Napping", celebrating: "Celebrating", egg: "Egg", hatching: "Hatching", resting: "Resting" } as const;

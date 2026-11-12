// Hang Again seed: one current user ("me") + 8 friends, with the shared history the AI mines.
// Everything is mock data. Names and photos are placeholders; teammates swap them in here
// (and drop real photos into /public/seed with the same filenames, or change imagePath).
import type { Calendar, CalendarSlot, ChatSnippet, FeedPost, Friend, Gathering, Person, Photo, Place, Reaction } from "@/lib/hangout/types";

/** Demo "today". Override with DEMO_DATE in .env.local or from /demo at runtime. */
export const DEFAULT_DEMO_DATE = "2026-11-14";

export const ME: Person = { id: "me", name: "Riley Brooks", avatarPhoto: "/seed/avatars/me.svg", city: "Austin" };

const friend = (f: Pick<Friend, "id" | "name" | "replies"> & Partial<Friend>): Friend => ({
  avatarPhoto: `/seed/avatars/${f.id}.svg`,
  isCloseCircle: true,
  isBlocked: false,
  isResting: false,
  isFriend: true,
  city: "Austin",
  ...f,
});

export const FRIENDS: Friend[] = [
  friend({ id: "maya", name: "Maya Torres", replies: ["STOP. I was literally just thinking about junior year", "ok we have to go back together. this week?"] }),
  friend({ id: "dev", name: "Dev Patel", replies: ["THE GOOSE. I knew you'd see it", "ok but we're staying far away from that pond"] }),
  friend({ id: "jess", name: "Jess Morgan", city: "Chicago", replies: ["RILEY!! yes please, I know exactly zero people here", "show me all your spots"] }),
  friend({ id: "sam", name: "Sam Okafor", isCloseCircle: false, replies: ["hey!! that was fun this morning", "same time next saturday?"] }),
  friend({ id: "priya", name: "Priya Shah", replies: ["haha hi! what's up"] }),
  friend({ id: "chris", name: "Chris Lee", replies: ["yo what's good"] }),
  friend({ id: "alex", name: "Alex Rivera", isResting: true, replies: ["hey you!"] }),
  // Blocked. Must never appear in any UI, attendee list or model prompt.
  friend({ id: "jordan", name: "Jordan Blake", isBlocked: true, isCloseCircle: false, replies: [] }),
];

/** People at the run club who aren't friends yet. Only used by the "See again" sheet. */
export const PEOPLE: Person[] = [
  { id: "lena", name: "Lena Park", avatarPhoto: "/seed/avatars/lena.svg" },
  { id: "marco", name: "Marco Silva", avatarPhoto: "/seed/avatars/marco.svg" },
  { id: "theo", name: "Theo Nguyen", avatarPhoto: "/seed/avatars/theo.svg" },
];

export const PLACES: Place[] = [
  { name: "Ramen Ya", costPerPerson: 18, kind: "ramen" },
  { name: "Kerbey Lane Cafe", costPerPerson: 16, kind: "diner" },
  { name: "Mozart's Coffee", costPerPerson: 7, kind: "coffee" },
  { name: "Spider House Cafe", costPerPerson: 8, kind: "coffee" },
  { name: "Alamo Drafthouse", costPerPerson: 17, kind: "movies" },
  { name: "Pease Park", costPerPerson: 0, kind: "park" },
  { name: "Zilker Park", costPerPerson: 0, kind: "park" },
  { name: "Barton Springs", costPerPerson: 5, kind: "swim" },
  { name: "Lady Bird Lake Trail", costPerPerson: 0, kind: "run" },
  { name: "Torchy's Tacos", costPerPerson: 12, kind: "tacos" },
  { name: "Sweetgreen", costPerPerson: 15, kind: "salad" },
];

const ph = (id: string, date: string, place: string, tagged: string[], caption?: string): Photo => ({ id, date, place, caption, taggedFriendIds: ["me", ...tagged], imagePath: `/seed/photos/${id}.svg` });

export const PHOTOS: Photo[] = [
  // Maya: Ramen Ya, junior year (9 times)
  ph("ph_maya_01", "2023-09-15", "Ramen Ya", ["maya"], "first week of junior year ramen"),
  ph("ph_maya_02", "2023-10-06", "Ramen Ya", ["maya"]),
  ph("ph_maya_03", "2023-10-27", "Ramen Ya", ["maya"], "midterms survival ramen"),
  ph("ph_maya_04", "2023-11-17", "Ramen Ya", ["maya"]),
  ph("ph_maya_05", "2024-01-19", "Ramen Ya", ["maya"], "back from break, straight here"),
  ph("ph_maya_06", "2024-02-09", "Ramen Ya", ["maya"]),
  ph("ph_maya_07", "2024-03-01", "Ramen Ya", ["maya"], "extra chashu, no regrets"),
  ph("ph_maya_08", "2024-04-05", "Ramen Ya", ["maya"]),
  ph("ph_maya_09", "2024-04-26", "Ramen Ya", ["maya"], "last ramen before finals"),
  ph("ph_maya_10", "2024-02-24", "Mozart's Coffee", ["maya"]),
  ph("ph_maya_11", "2025-12-20", "Kerbey Lane Cafe", ["maya"], "holiday pancakes"),
  // Dev: the goose incident happened at Pease Park
  ph("ph_dev_01", "2024-04-20", "Pease Park", ["dev"], "moments before the goose incident"),
  ph("ph_dev_02", "2026-02-01", "Spider House Cafe", ["dev"]),
  ph("ph_dev_03", "2026-06-06", "Zilker Park", ["dev"], "frisbee, zero geese"),
  // Jess: high school in San Antonio
  ph("ph_jess_01", "2019-09-20", "Lincoln High", ["jess"], "friday night lights"),
  ph("ph_jess_02", "2019-10-18", "Lincoln High", ["jess"]),
  ph("ph_jess_03", "2020-02-14", "Bird Bakery", ["jess"], "galentine's cupcakes"),
  ph("ph_jess_04", "2020-10-02", "Lincoln High", ["jess"], "senior year, front row"),
  ph("ph_jess_05", "2021-03-12", "Bird Bakery", ["jess"]),
  ph("ph_jess_06", "2021-08-10", "Jess's backyard", ["jess"], "going-away party before chicago"),
  // Priya
  ph("ph_priya_01", "2025-10-03", "Alamo Drafthouse", ["priya"]),
  ph("ph_priya_02", "2026-02-14", "Mozart's Coffee", ["priya"]),
  ph("ph_priya_03", "2026-08-22", "Alamo Drafthouse", ["priya"], "we cried at a robot movie"),
  // Chris: one group-project photo
  ph("ph_chris_01", "2023-03-10", "Gregory Gym", ["chris", "lena"], "stats group project, finally done"),
  // Alex: summers at Barton Springs
  ph("ph_alex_01", "2024-06-15", "Barton Springs", ["alex"]),
  ph("ph_alex_02", "2024-07-04", "Barton Springs", ["alex"], "fourth of july cannonballs"),
  ph("ph_alex_03", "2024-08-10", "Barton Springs", ["alex"]),
  ph("ph_alex_04", "2025-06-21", "Barton Springs", ["alex"], "first swim of summer"),
  ph("ph_alex_05", "2025-07-19", "Barton Springs", ["alex"]),
  ph("ph_alex_06", "2025-08-30", "Barton Springs", ["alex"]),
  // Jordan (blocked)
  ph("ph_jordan_01", "2022-09-09", "Torchy's Tacos", ["jordan"]),
  ph("ph_jordan_02", "2022-11-04", "Torchy's Tacos", ["jordan"]),
  ph("ph_jordan_03", "2023-01-27", "Torchy's Tacos", ["jordan"]),
  ph("ph_jordan_04", "2023-04-14", "Torchy's Tacos", ["jordan"]),
  // Run club group photo (this morning)
  ph("ph_runclub_01", "2026-11-14", "Lady Bird Lake Trail", ["sam", "lena", "marco", "theo"], "saturday run club, 5 miles"),
];

export const GATHERINGS: Gathering[] = [
  { id: "gt_runclub_1114", kind: "group_meetup", name: "Saturday Run Club", groupName: "Saturday Run Club", date: "2026-11-14", place: "Lady Bird Lake Trail", attendeeIds: ["me", "sam", "lena", "marco", "theo", "jordan"] },
  { id: "gt_friendsgiving_25", kind: "event", name: "Friendsgiving 2025", date: "2025-11-22", place: "Riley's apartment", attendeeIds: ["me", "priya", "alex"] },
  { id: "gt_maya_bday_24", kind: "event", name: "Maya's 21st", date: "2024-03-01", place: "Ramen Ya", attendeeIds: ["me", "maya"] },
];

// ---------- chat snippets (opted-in threads only) ----------
// talk(friend, "YYYY-MM-DD", [sender, text], …) → snippets a few minutes apart. Sender "me" or the friend id.
let n = 0;
const talk = (friendId: string, date: string, ...lines: [string, string][]): ChatSnippet[] =>
  lines.map(([sender, text], i) => ({ id: `ch_${friendId}_${String(++n).padStart(3, "0")}`, friendId, date: `${date}T${String(18 + Math.floor(i / 6)).padStart(2, "0")}:${String((i * 9) % 60).padStart(2, "0")}:00`, sender, text }));

export const CHATS: ChatSnippet[] = [
  // Maya: last two-way chat March 2026, then one-way
  ...talk("maya", "2024-05-10", ["maya", "FINALS DONE"], ["me", "ramen to celebrate??"]),
  ...talk("maya", "2024-08-22", ["me", "you back in town?"], ["maya", "sunday!"]),
  ...talk("maya", "2025-02-14", ["maya", "happy galentine's"], ["me", "love you, design club forever"]),
  ...talk("maya", "2025-06-01", ["me", "how's the internship"], ["maya", "busy but good. figma all day"]),
  ...talk("maya", "2025-09-10", ["maya", "can't believe we're seniors"], ["me", "don't say it out loud"]),
  ...talk("maya", "2025-12-18", ["me", "pancakes over break?"], ["maya", "kerbey lane saturday"]),
  ...talk("maya", "2026-01-25", ["maya", "new job starts monday"], ["me", "proud of you!!"]),
  ...talk("maya", "2026-03-08", ["maya", "omg they brought back the spicy miso"], ["me", "no way. we need to go"], ["maya", "next month for sure"]),
  ...talk("maya", "2026-06-02", ["me", "happy birthday!! 🎂"]),
  ...talk("maya", "2026-08-15", ["me", "saw a noodle mural and thought of you"]),
  // Dev: the goose incident runs through everything
  ...talk("dev", "2024-04-20", ["dev", "I can't believe that goose chased you across the whole park"], ["me", "it was personal. the goose incident will never be spoken of again"]),
  ...talk("dev", "2024-09-12", ["me", "saw a goose today and walked the other way"], ["dev", "goose incident flashbacks"]),
  ...talk("dev", "2025-04-20", ["dev", "happy goose incident anniversary"], ["me", "I still hear the honk"]),
  ...talk("dev", "2025-12-03", ["me", "you surviving finals"], ["dev", "barely"]),
  ...talk("dev", "2026-01-04", ["dev", "new year new me"], ["me", "same dev though"]),
  ...talk("dev", "2026-03-03", ["me", "coffee soon?"], ["dev", "yes after midterms"]),
  ...talk("dev", "2026-04-02", ["dev", "goose incident anniversary in 18 days. cake?"], ["me", "a goose-shaped cake"]),
  ...talk("dev", "2026-05-05", ["me", "happy cinco"], ["dev", "🌮🌮"]),
  ...talk("dev", "2026-07-06", ["dev", "fireworks were mid"], ["me", "agree"]),
  ...talk("dev", "2026-08-08", ["me", "back for fall?"], ["dev", "next week"]),
  ...talk("dev", "2026-09-06", ["dev", "first week of classes done"], ["me", "nice"]),
  ...talk("dev", "2026-10-07", ["me", "how's the new place"], ["dev", "loud neighbors but good"]),
  // Jess: close in school, now long-distance
  ...talk("jess", "2021-08-12", ["jess", "chicago is so cold already"], ["me", "it's august??"]),
  ...talk("jess", "2022-03-20", ["me", "spring break plans?"], ["jess", "studying lol"]),
  ...talk("jess", "2023-01-09", ["jess", "happy new year!!"], ["me", "happy new year bestie"]),
  ...talk("jess", "2024-06-12", ["me", "happy birthday!!"], ["jess", "thank you!! come visit chicago"]),
  ...talk("jess", "2025-06-12", ["me", "happy birthday!! old lady"], ["jess", "rude. thank you 💕"]),
  // Priya: talked last week
  ...talk("priya", "2026-09-05", ["priya", "movie this weekend?"], ["me", "yes"]),
  ...talk("priya", "2026-09-16", ["me", "did you finish the show"], ["priya", "the finale ruined me"]),
  ...talk("priya", "2026-09-27", ["priya", "coffee tomorrow?"], ["me", "mozart's at 10"]),
  ...talk("priya", "2026-10-08", ["me", "how was the interview"], ["priya", "good I think!"]),
  ...talk("priya", "2026-10-18", ["priya", "GOT THE JOB"], ["me", "LET'S GOOO"]),
  ...talk("priya", "2026-10-29", ["me", "halloween costume?"], ["priya", "still deciding"]),
  ...talk("priya", "2026-11-07", ["priya", "first week at the new job done"], ["me", "proud of you!"]),
  // Chris: weak history
  ...talk("chris", "2023-03-08", ["chris", "can you do the slides for stats"], ["me", "yeah I got it"]),
  ...talk("chris", "2023-03-12", ["me", "good luck on the final"]),
  // Alex
  ...talk("alex", "2025-06-20", ["alex", "springs tomorrow?"], ["me", "obviously"]),
  ...talk("alex", "2025-08-29", ["me", "last swim of summer?"], ["alex", "saturday"]),
  ...talk("alex", "2025-11-20", ["alex", "bringing pie to friendsgiving"], ["me", "you're a hero"]),
  // Jordan (blocked)
  ...talk("jordan", "2023-04-13", ["jordan", "torchy's tomorrow?"], ["me", "sure"]),
];

/** Likes and reactions. The sleep math ignores these on purpose. */
export const REACTIONS: Reaction[] = [
  { id: "rx_maya_01", friendId: "maya", date: "2026-06-04", by: "maya", emoji: "❤️", target: "ch_maya_happy_birthday" },
  { id: "rx_maya_02", friendId: "maya", date: "2026-09-30", by: "me", emoji: "👍", target: "maya's post" },
  { id: "rx_dev_01", friendId: "dev", date: "2026-11-01", by: "dev", emoji: "😂", target: "riley's post" },
];

// ---------- calendars (the week after DEMO_DATE) ----------
export const SLOTS: (Omit<CalendarSlot, "label" | "start"> & { dayOffset: number; hours: string; startHour: number })[] = [
  { id: "d1_morning", dayOffset: 1, hours: "10am–1pm", startHour: 10 },
  { id: "d1_afternoon", dayOffset: 1, hours: "2–6pm", startHour: 14 },
  { id: "d2_evening", dayOffset: 2, hours: "6–9pm", startHour: 18 },
  { id: "d3_evening", dayOffset: 3, hours: "6–9pm", startHour: 18 },
  { id: "d4_evening", dayOffset: 4, hours: "6–9pm", startHour: 18 },
  { id: "d5_evening", dayOffset: 5, hours: "6–9pm", startHour: 18 },
  { id: "d6_evening", dayOffset: 6, hours: "7–10pm", startHour: 19 },
  { id: "d7_morning", dayOffset: 7, hours: "9am–12pm", startHour: 9 },
  { id: "d7_afternoon", dayOffset: 7, hours: "1–5pm", startHour: 13 },
];

export const CALENDARS: Calendar[] = [
  { personId: "me", free: ["d1_afternoon", "d3_evening", "d5_evening", "d7_morning"] },
  { personId: "maya", free: ["d1_morning", "d3_evening", "d6_evening", "d7_afternoon"] },
  { personId: "dev", free: ["d1_afternoon", "d4_evening", "d7_morning"] },
  { personId: "jess", free: ["d1_afternoon", "d5_evening", "d6_evening"] },
  { personId: "sam", free: ["d3_evening", "d7_morning"] },
  { personId: "priya", free: ["d2_evening", "d5_evening"] },
  { personId: "chris", free: ["d2_evening", "d4_evening"] },
  { personId: "alex", free: ["d1_afternoon"] },
];

/** Keepsakes earned before the demo starts (from past meetups). */
export const STARTING_KEEPSAKES: Record<string, string[]> = { priya: ["ticket", "coffee"], alex: ["wave"], dev: ["leaf"] };

export const POSTS: FeedPost[] = [];

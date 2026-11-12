// The 8 friend moments the demo panel triggers and `npm run eval:moments` grades.
// Trigger items are dated at the current demo date when they fire.
import type { Scenario } from "@/lib/hangout/types";
import { CHATS, DEFAULT_DEMO_DATE, PHOTOS } from "./seed";

const d = DEFAULT_DEMO_DATE;
const photosAt = (friendId: string, place: string) => PHOTOS.filter((p) => p.place === place && p.taggedFriendIds.includes(friendId)).map((p) => p.id);
const chatsMentioning = (friendId: string, word: RegExp) => CHATS.filter((c) => c.friendId === friendId && word.test(c.text)).map((c) => c.id);

export const SCENARIOS: Scenario[] = [
  {
    id: "maya_ramen",
    label: "Maya posts from Ramen Ya",
    friendId: "maya",
    trigger: { kind: "post", item: { id: "post_maya_ramen", friendId: "maya", date: d, text: "the spicy miso is BACK 🍜", place: "Ramen Ya", imagePath: "/seed/photos/post_maya_ramen.svg" } },
    expect: { outcome: "nudge", type: "place", mustCite: photosAt("maya", "Ramen Ya") },
  },
  {
    id: "dev_goose",
    label: "Dev shares an angry goose Reel",
    friendId: "dev",
    trigger: { kind: "reel", item: { id: "reel_dev_goose", friendId: "dev", date: d, caption: "this goose woke up and chose violence", topicTags: ["goose", "animals", "funny", "park"], imagePath: "/seed/photos/reel_dev_goose.svg" } },
    expect: { outcome: "nudge", type: "joke", mustCite: chatsMentioning("dev", /goose/i) },
  },
  {
    id: "jess_moved",
    label: "Jess moved to Austin",
    friendId: "jess",
    trigger: { kind: "life_update", item: { id: "post_jess_moved", friendId: "jess", date: d, text: "just moved to Austin!! I know exactly zero people here, send recs", kind: "life_update", imagePath: "/seed/photos/post_jess_moved.svg" } },
    expect: { outcome: "nudge", type: "life_update" },
  },
  {
    id: "priya_lunch",
    label: "Priya posts a lunch photo",
    friendId: "priya",
    trigger: { kind: "post", item: { id: "post_priya_lunch", friendId: "priya", date: d, text: "lunch between back-to-back meetings 🥗", place: "Sweetgreen", imagePath: "/seed/photos/post_priya_lunch.svg" } },
    expect: { outcome: "no_nudge" },
  },
  {
    id: "chris_meme",
    label: "Chris posts a meme",
    friendId: "chris",
    trigger: { kind: "post", item: { id: "post_chris_meme", friendId: "chris", date: d, text: "me in the monday meeting that could've been an email", imagePath: "/seed/photos/post_chris_meme.svg" } },
    expect: { outcome: "no_nudge" },
  },
  {
    id: "alex_barton",
    label: "Alex posts from Barton Springs",
    friendId: "alex",
    trigger: { kind: "post", item: { id: "post_alex_barton", friendId: "alex", date: d, text: "first cold plunge of the season", place: "Barton Springs", imagePath: "/seed/photos/post_alex_barton.svg" } },
    expect: { outcome: "filtered", reason: "resting" },
  },
  {
    id: "jordan_torchys",
    label: "Jordan posts from Torchy's",
    friendId: "jordan",
    trigger: { kind: "post", item: { id: "post_jordan_torchys", friendId: "jordan", date: d, text: "trashy tacos forever", place: "Torchy's Tacos", imagePath: "/seed/photos/post_jordan_torchys.svg" } },
    expect: { outcome: "filtered", reason: "blocked" },
  },
];

export const scenarioById = (id: string) => SCENARIOS.find((s) => s.id === id);

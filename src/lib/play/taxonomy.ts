// One fixed topic list. Every game option and every Event / Group / Listing maps onto it, which is what lets
// game scores rank real inventory. Code owns the mapping; the model may only use ids from this list.
// Short stems are word-anchored so "weather" and "loveseat" aren't food and "campus" isn't the outdoors.
import type { TasteKey } from "./taste";
import type { FBEvent, Group, Listing } from "@/types";

export const BANNED = /\b(depress\w*|anxi\w*|lonely|loneliness|grie\w+|sick|illness|hospital|therap\w*|mental|struggl\w*|miss(?:ing|ed|es)?\s+you|too long|guilt\w*|sorry for|you never|should have)\b/i;

export const TOPICS = [
  { id: "running", label: "running", emoji: "🏃", re: /\brun(s|ning|ner|club)?\b|5k|10k|marathon|town lake|strava/i, events: ["Fitness"], tags: ["Running", "Fitness"], listings: [] as string[], taste: ["runners"] },
  { id: "food", label: "food", emoji: "🌮", re: /food|tacos?\b|cook|\beat(s|en|ing)?\b|bbq|brunch|ramen|pizza|birria|meal|grill|bak(e|ing)|dinner|potluck|farmers market/i, events: ["Food & Drink"], tags: ["Food"], listings: [], taste: ["foodies"] },
  { id: "music", label: "live music", emoji: "🎸", re: /music|dj|vinyl|\bbands?\b|brassband|song|jazz|concert|synth|house set|\b(a|the|live|house) show\b|'s show\b|show tix|cumbia|afrobeats|acl|gig/i, events: ["Music"], tags: ["Music"], listings: ["Musical Instruments", "Tickets"], taste: ["music lovers"] },
  { id: "sports", label: "pickup sports", emoji: "🏐", re: /volleyball|pickleball|soccer|football|basketball|spurs|pickup|\bcourts?\b|tourney|round robin|\bgame day\b/i, events: ["Sports"], tags: ["Volleyball", "Sports"], listings: ["Sporting Goods"], taste: [] },
  { id: "outdoors", label: "the outdoors", emoji: "🥾", re: /hik|trail|climb|boulder|backpack|\bcamp(ing|site|fire|out)?\b|mountain|greenbelt|outdoor/i, events: ["Outdoors"], tags: ["Outdoors"], listings: [], taste: ["hikers"] },
  { id: "water", label: "lake days", emoji: "🏊", re: /swim|barton springs|\blake\b|paddle ?board|kayak|pool|float/i, events: [], tags: [], listings: [], taste: ["swimmers"] },
  { id: "nightlife", label: "nights out", emoji: "🪩", re: /nightlife|\bbar\b|late night|party|night ?club|clubbing|karaoke|housewarming|friendsgiving/i, events: ["Party"], tags: [], listings: [], taste: ["night owls"] },
  { id: "art", label: "art & making", emoji: "🎨", re: /pottery|ceramic|\bart\b|design|illustrat|museum|mural|\bsew|crochet|craft|gallery/i, events: ["Arts", "Culture"], tags: ["Culture"], listings: [], taste: ["art people"] },
  { id: "film", label: "movies & anime", emoji: "🎬", re: /film|movie|anime|cinema|k-drama|reality tv/i, events: ["Film"], tags: [], listings: [], taste: ["photographers"] },
  { id: "thrift", label: "thrifting", emoji: "🧥", re: /thrift|vintage|depop|flip|\bmend|sneaker|denim/i, events: ["Shopping"], tags: ["Thrifting", "Fashion", "Sustainability"], listings: ["Clothing"], taste: ["thrifters", "budget travellers"] },
  { id: "cycling", label: "cycling", emoji: "🚴", re: /\bcycl|cycling|\bbike|gravel|peloton/i, events: [], tags: [], listings: ["Bikes"], taste: ["cyclists"] },
  { id: "coffee", label: "coffee runs", emoji: "☕", re: /coffee|matcha|espresso|barista|boba|bubble tea|cafe/i, events: [], tags: [], listings: [], taste: ["coffee people"] },
  { id: "gaming", label: "games", emoji: "🎮", re: /valorant|2k|board game|chess|trivia|ps5|controller|keyboard|hackathon/i, events: ["Networking"], tags: [], listings: ["Electronics"], taste: [] },
  { id: "fitness", label: "the gym", emoji: "🏋️", re: /\blift|deadlift|powerlift|gym|pilates|kettlebell|workout|warmup|meal prep/i, events: ["Fitness"], tags: ["Fitness"], listings: ["Sporting Goods"], taste: [] },
  { id: "home", label: "plants & home", emoji: "🪴", re: /plant|monstera|propagat|interior|apartment|roommate|bookshelf|couch/i, events: [], tags: ["Housing", "Roommates"], listings: ["Plants", "Furniture"], taste: [] },
  { id: "community", label: "giving back", emoji: "🤝", re: /volunteer|mutual aid|cleanup|community|health fair/i, events: ["Volunteering", "Community"], tags: ["Community"], listings: ["Books"], taste: [] },
] as const;

export type TopicId = (typeof TOPICS)[number]["id"];
export const TOPIC_IDS = TOPICS.map((t) => t.id) as TopicId[];
export const isTopic = (s: unknown): s is TopicId => typeof s === "string" && (TOPIC_IDS as string[]).includes(s);
export const topic = (id: TopicId) => TOPICS.find((t) => t.id === id)!;
export const topicLabel = (id: TopicId) => `${topic(id).emoji} ${topic(id).label}`;

export const topicsOfText = (text: string): TopicId[] => TOPICS.filter((t) => t.re.test(text)).map((t) => t.id);
const uniq = <T,>(a: T[]) => [...new Set(a)];
const has = (list: readonly string[], v: string) => list.some((x) => x.toLowerCase() === v.toLowerCase());

/** Category first (it counts most), then words in the title. The description is read only when those say nothing:
 *  a pickleball tourney whose prize is a taco gift card is not a food event. */
export const topicsOfEvent = (e: FBEvent): TopicId[] => {
  const main = uniq([...TOPICS.filter((t) => has(t.events, e.category)).map((t) => t.id), ...topicsOfText(e.title)]);
  return main.length ? main : topicsOfText(e.description.slice(0, 200));
};
export const topicsOfGroup = (g: Group): TopicId[] => uniq([...TOPICS.filter((t) => g.tags.some((tag) => has(t.tags, tag))).map((t) => t.id), ...topicsOfText(`${g.name} ${g.tags.join(" ")}`)]);
export const topicsOfListing = (l: Listing): TopicId[] => uniq([...TOPICS.filter((t) => has(t.listings, l.category)).map((t) => t.id), ...topicsOfText(l.title)]);

export const topicsOfTaste = (k: TasteKey): TopicId[] => TOPICS.filter((t) => (t.taste as readonly string[]).includes(k)).map((t) => t.id);

// 16-topic taxonomy shared between Sidequest game themes (Deep Cuts + Order Up!) and Facebook's
// Events, Groups, and Marketplace inventory.
import type { FBEvent, Group, Listing } from "@/types";
import type { GameKind } from "@/components/ChatGames";

export const TOPICS = [
  { id: "food", label: "food", emoji: "🌮", re: /food|tacos?\b|cook|\beat(s|en|ing)?\b|bbq|brunch|ramen|pizza|burger|sushi|sourdough|birria|dumpling|noodle|meal|grill|bak(e|ing)|dinner|potluck|farmers market|kitchen|diner/i, events: ["Food & Drink"], tags: ["Food", "Budget"], listings: [] as string[], deepcuts: "Street tacos", orderup: "Tacos" },
  { id: "music", label: "live music", emoji: "🎸", re: /music|dj|vinyl|\bbands?\b|indie|taylor swift|pop|hip-?hop|song|jazz|concert|synth|house set|\b(a|the|live|house) show\b|cumbia|afrobeats|acl|gig/i, events: ["Music"], tags: ["Music"], listings: ["Musical Instruments", "Tickets"], deepcuts: "Indie bands", orderup: "Late-night concert diner" },
  { id: "sports", label: "pickup sports", emoji: "🏐", re: /volleyball|pickleball|soccer|football|basketball|spurs|f1|formula ?1|racing|pickup|\bcourts?\b|tourney|round robin/i, events: ["Sports"], tags: ["Volleyball", "Sports"], listings: ["Sporting Goods"], deepcuts: "F1", orderup: "Courtside snack bar" },
  { id: "outdoors", label: "the outdoors", emoji: "🧗", re: /hik|trail|climb|boulder|rock climbing|backpack|\bcamp(ing|site|fire|out)?\b|mountain|greenbelt|outdoor|scuba|diving/i, events: ["Outdoors"], tags: ["Outdoors"], listings: [], deepcuts: "Rock climbing", orderup: "Crag-side camp cafe" },
  { id: "running", label: "running", emoji: "🏃", re: /\brun(s|ning|ner|club)?\b|5k|10k|marathon|town lake|strava/i, events: ["Fitness"], tags: ["Running"], listings: [], deepcuts: "Marathon running", orderup: "Post-run smoothie bar" },
  { id: "coffee", label: "coffee & matcha", emoji: "☕", re: /coffee|matcha|espresso|barista|boba|bubble tea|cafe|latte/i, events: [], tags: [], listings: [], deepcuts: "Coffee", orderup: "Coffee shop" },
  { id: "film", label: "movies & anime", emoji: "🎬", re: /film|movie|anime|ghibli|cinema|k-drama|reality tv|35mm|camera|photo/i, events: ["Film"], tags: [], listings: [], deepcuts: "90s anime", orderup: "Midnight cinema snacks" },
  { id: "thrift", label: "thrifting", emoji: "🧥", re: /thrift|vintage|depop|flip|\bmend|sneaker|denim|streetwear/i, events: ["Shopping"], tags: ["Thrifting", "Fashion", "Sustainability"], listings: ["Clothing"], deepcuts: "Vintage streetwear", orderup: "Flea market food truck" },
  { id: "art", label: "art & making", emoji: "🎨", re: /pottery|ceramic|\bart\b|design|illustrat|museum|mural|\bsew|crochet|craft|gallery/i, events: ["Arts", "Culture"], tags: ["Culture"], listings: [], deepcuts: "Design classics", orderup: "Art studio bakery" },
  { id: "cycling", label: "cycling", emoji: "🚴", re: /\bcycl|cycling|\bbike|gravel|peloton/i, events: [], tags: [], listings: ["Bikes"], deepcuts: "Road cycling", orderup: "Cyclist espresso stop" },
  { id: "water", label: "lake days", emoji: "🏊", re: /swim|barton springs|\blake\b|paddle ?board|kayak|pool|float|ocean/i, events: [], tags: [], listings: [], deepcuts: "Scuba diving", orderup: "Beachside taco stand" },
  { id: "nightlife", label: "nights out", emoji: "🪩", re: /nightlife|\bbar\b|late night|party|night ?club|karaoke|housewarming|friendsgiving|patio/i, events: ["Party"], tags: [], listings: [], deepcuts: "2010s party anthems", orderup: "2am food truck" },
  { id: "gaming", label: "games & tech", emoji: "🎮", re: /valorant|2k|board game|chess|trivia|ps5|controller|keyboard|hackathon|space|dino/i, events: ["Networking"], tags: [], listings: ["Electronics"], deepcuts: "Space", orderup: "Arcade pizza bar" },
  { id: "fitness", label: "the gym", emoji: "🏋️", re: /\blift|deadlift|powerlift|gym|pilates|kettlebell|workout|warmup|meal prep/i, events: ["Fitness"], tags: ["Fitness"], listings: ["Sporting Goods"], deepcuts: "Gym culture", orderup: "Protein bowl kitchen" },
  { id: "home", label: "plants & home", emoji: "🪴", re: /plant|monstera|propagat|interior|apartment|roommate|bookshelf|couch/i, events: [], tags: ["Housing", "Roommates"], listings: ["Plants", "Furniture"], deepcuts: "Houseplants", orderup: "Greenhouse tea room" },
  { id: "community", label: "giving back", emoji: "🤝", re: /volunteer|mutual aid|cleanup|community|health fair/i, events: ["Volunteering", "Community"], tags: ["Community"], listings: ["Books"], deepcuts: "Austin landmarks", orderup: "Neighborhood block BBQ" },
] as const;

export type TopicId = (typeof TOPICS)[number]["id"];
export const TOPIC_IDS = TOPICS.map((t) => t.id) as TopicId[];
export const topic = (id: TopicId) => TOPICS.find((t) => t.id === id)!;
export const topicLabel = (id: TopicId) => `${topic(id).emoji} ${topic(id).label}`;

const uniq = <T,>(a: T[]) => [...new Set(a)];
const has = (list: readonly string[], v: string) => list.some((x) => x.toLowerCase() === v.toLowerCase());

export const topicsOfText = (text: string): TopicId[] => TOPICS.filter((t) => t.re.test(text)).map((t) => t.id);

export const topicsOfEvent = (e: FBEvent): TopicId[] => {
  const main = uniq([...TOPICS.filter((t) => has(t.events, e.category)).map((t) => t.id), ...topicsOfText(e.title)]);
  return main.length ? main : topicsOfText(e.description.slice(0, 200));
};
export const topicsOfGroup = (g: Group): TopicId[] => uniq([...TOPICS.filter((t) => g.tags.some((tag) => has(t.tags, tag))).map((t) => t.id), ...topicsOfText(`${g.name} ${g.tags.join(" ")}`)]);
export const topicsOfListing = (l: Listing): TopicId[] => uniq([...TOPICS.filter((t) => has(t.listings, l.category)).map((t) => t.id), ...topicsOfText(l.title)]);

export const chipForTopic = (id: TopicId, game: GameKind): string => (game === "orderup" ? topic(id).orderup : topic(id).deepcuts);

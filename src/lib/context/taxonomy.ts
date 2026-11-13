// 16-topic taxonomy shared between all 4 Sidequest games (Deep Cuts, Order Up!, Ghost Run, Sketch Off)
// and Facebook's Events, Groups, and Marketplace inventory.
import type { FBEvent, Group, Listing } from "@/types";
import type { GameKind } from "@/components/ChatGames";

export const TOPICS = [
  { id: "food", label: "food", emoji: "🌮", re: /food|tacos?\b|cook(ware|ing)?|\beat(s|en|ing)?\b|bbq|brunch|ramen|pizza|burger|sushi|sourdough|birria|dumpling|noodle|meal|grill|bak(e|ery|ing)|dinner|potluck|farmers market|kitchen|diner|pastry|pastries|cookie|cake|dessert|tortilla|cast[- ]iron|skillet|salsa|chili crisp|kimchi|snack/i, events: ["Food & Drink"], tags: ["Food", "Budget"], listings: ["Food", "Food & Drink", "Home & Kitchen", "Kitchen"], auto: "Tacos", deepcuts: "Street food", orderup: "Tacos", ghostrun: "Food truck sprint", sketchoff: "Street food" },
  { id: "music", label: "live music", emoji: "🎸", re: /music|dj|vinyl|\bbands?\b|indie|taylor swift|pop|hip-?hop|song|jazz|concert|synth|house set|\b(a|the|live|house) show\b|cumbia|afrobeats|acl|gig/i, events: ["Music"], tags: ["Music"], listings: ["Musical Instruments", "Tickets"], auto: "Indie bands", deepcuts: "Indie bands", orderup: "Late-night concert diner", ghostrun: "Tour bus sprint", sketchoff: "Concert gear" },
  { id: "sports", label: "pickup sports", emoji: "🏐", re: /volleyball|pickleball|soccer|football|basketball|spurs|f1|formula ?1|racing|pickup|\bcourts?\b|tourney|round robin/i, events: ["Sports"], tags: ["Volleyball", "Sports"], listings: ["Sporting Goods"], auto: "F1", deepcuts: "NBA trivia", orderup: "Courtside snack bar", ghostrun: "F1", sketchoff: "Sports gear" },
  { id: "outdoors", label: "the outdoors", emoji: "🧗", re: /hik|trail|climb|boulder|rock climbing|ski(ing)?|backpack|\bcamp(ing|site|fire|out)?\b|mountain|greenbelt|outdoor|scuba|diving/i, events: ["Outdoors"], tags: ["Outdoors"], listings: [], auto: "Rock climbing", deepcuts: "National parks", orderup: "Campfire kitchen", ghostrun: "Rock climbing", sketchoff: "Camping wildlife" },
  { id: "running", label: "running", emoji: "🏃", re: /\brun(s|ning|ner|club)?\b|5k|10k|marathon|town lake|strava/i, events: ["Fitness"], tags: ["Running"], listings: [], auto: "Marathon running", deepcuts: "Famous marathons", orderup: "Post-run smoothie bar", ghostrun: "Marathon running", sketchoff: "Track day" },
  { id: "coffee", label: "coffee & matcha", emoji: "☕", re: /coffee|matcha|espresso|barista|boba|bubble tea|cafe|latte/i, events: [], tags: [], listings: [], auto: "Coffee shop", deepcuts: "Coffee culture", orderup: "Coffee shop", ghostrun: "Morning commute dash", sketchoff: "Cafe doodles" },
  { id: "film", label: "movies & anime", emoji: "🎬", re: /film|movie|anime|ghibli|cinema|k-drama|reality tv|35mm|camera|photo/i, events: ["Film"], tags: [], listings: [], auto: "Anime", deepcuts: "90s movies", orderup: "Midnight cinema snacks", ghostrun: "Action movie chase", sketchoff: "Anime" },
  { id: "thrift", label: "thrifting", emoji: "🧥", re: /thrift|vintage|depop|flip|\bmend|sneaker|denim|streetwear|fashion|outfits?/i, events: ["Shopping"], tags: ["Thrifting", "Fashion", "Sustainability"], listings: ["Clothing"], auto: "Vintage fashion", deepcuts: "Sneaker history", orderup: "Flea market food truck", ghostrun: "Thrift rack dash", sketchoff: "Vintage fashion" },
  { id: "art", label: "art & making", emoji: "🎨", re: /pottery|ceramic|\bart\b|design|illustrat|museum|mural|\bsew|crochet|craft|gallery|drawing|painting/i, events: ["Arts", "Culture"], tags: ["Culture"], listings: [], auto: "Art & pottery", deepcuts: "Design classics", orderup: "Art studio bakery", ghostrun: "Gallery run", sketchoff: "Art & pottery" },
  { id: "cycling", label: "cycling", emoji: "🚴", re: /\bcycl|cycling|\bbike|biking|gravel|peloton/i, events: [], tags: [], listings: ["Bikes"], auto: "Road cycling", deepcuts: "Tour de France", orderup: "Cyclist espresso stop", ghostrun: "Road cycling", sketchoff: "Bikes & gear" },
  { id: "water", label: "lake days", emoji: "🏊", re: /swim|barton springs|\blake\b|paddle ?board|kayak|pool|float|ocean|surf/i, events: [], tags: [], listings: [], auto: "Surfing", deepcuts: "Ocean wonders", orderup: "Beachside taco stand", ghostrun: "Surfing", sketchoff: "Ocean life" },
  { id: "nightlife", label: "nights out", emoji: "🪩", re: /nightlife|\bbar\b|late night|party|night ?club|karaoke|housewarming|friendsgiving|patio/i, events: ["Party"], tags: [], listings: [], auto: "2010s party anthems", deepcuts: "2010s party anthems", orderup: "2am food truck", ghostrun: "Neon night drive", sketchoff: "Party props" },
  { id: "gaming", label: "games & tech", emoji: "🎮", re: /valorant|2k|board game|chess|trivia|ps5|controller|keyboard|hackathon|space|dino|robots?/i, events: ["Networking"], tags: [], listings: ["Electronics"], auto: "Space", deepcuts: "Retro video games", orderup: "Arcade pizza bar", ghostrun: "Space rockets", sketchoff: "Space" },
  { id: "fitness", label: "the gym", emoji: "🏋️", re: /\blift|deadlift|powerlift|gym|pilates|kettlebell|workout|warmup|meal prep/i, events: ["Fitness"], tags: ["Fitness"], listings: ["Sporting Goods"], auto: "Gym culture", deepcuts: "Gym culture", orderup: "Protein bowl kitchen", ghostrun: "Obstacle sprint", sketchoff: "Gym gear" },
  { id: "home", label: "plants & home", emoji: "🪴", re: /plant|monstera|propagat|interior|apartment|roommate|bookshelf|couch|animals?|pets?/i, events: [], tags: ["Housing", "Roommates"], listings: ["Plants", "Furniture"], auto: "Plants", deepcuts: "Rare houseplants", orderup: "Greenhouse tea room", ghostrun: "Backyard zoomies", sketchoff: "Plants" },
  { id: "community", label: "giving back", emoji: "🤝", re: /volunteer|mutual aid|cleanup|community|health fair/i, events: ["Volunteering", "Community"], tags: ["Community"], listings: ["Books"], auto: "Austin landmarks", deepcuts: "Austin landmarks", orderup: "Neighborhood block BBQ", ghostrun: "Town Lake trail", sketchoff: "Austin icons" },
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
export const topicsOfListing = (l: Listing): TopicId[] => {
  const main = uniq([...TOPICS.filter((t) => has(t.listings, l.category)).map((t) => t.id), ...topicsOfText(l.title)]);
  return main.length ? main : topicsOfText(l.description.slice(0, 200));
};

export const chipForTopic = (id: TopicId, game: GameKind | "auto"): string => topic(id)[game];

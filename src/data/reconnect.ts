// Reconnect seed: shared history that code can cite (tagged photos, events both went to), the friend's "new post"
// that makes a nudge timely, one culture group with a past and an upcoming event, and the private picks that exist
// before the demo starts. Everything here is content, not answers: the model still has to find and cite it.
import type { FBEvent, Group, Post } from "@/types";
import { P } from "./builders";
import { daysAgo, inDays, photo } from "./helpers";

/** Old posts with people tagged: the "meetup" signal and the photos a nudge can point at. Audience friends. */
export const memoryPosts: Post[] = [
  { ...P("nadia", 740, "last long run before graduation. town lake, 7am, maya made us do the full loop and then bought us breakfast tacos as an apology", { images: [photo("town-lake-sunrise-run", 1000, 750)], tagged: ["maya", "arjun"], likes: 31, audience: "friends" }), city: "austin" },
  { ...P("maya", 905, "3 years of this apartment. 3 years of nadia stealing my hot cheetos. moving out tomorrow and I am not ok", { images: [photo("ut-apartment-boxes", 1000, 750)], tagged: ["nadia"], likes: 44, audience: "friends" }), city: "austin" },
  { ...P("arjun", 410, "turkey trot with the two people who actually ran it. I walked. proudly", { images: [photo("turkey-trot-austin", 1000, 750)], tagged: ["maya", "nadia"], likes: 22, audience: "friends" }), city: "austin" },
  { ...P("cole", 2200, "plano east homecoming. we lost by 30 and nobody cared", { images: [photo("plano-east-homecoming", 1000, 750)], tagged: ["maya", "harper", "kenji", "tess", "bri"], likes: 58, audience: "friends" }), city: "dallas" },
  { ...P("harper", 560, "first vintage market I ever ran. maya drove up from austin and bought the ugliest lamp in texas", { images: [photo("deep-ellum-vintage-lamp", 1000, 750)], tagged: ["maya", "cole"], likes: 27, audience: "friends" }), city: "dallas" },
  { ...P("june", 300, "clay studio final firing. maya's bowl survived, mine did not", { images: [photo("clay-studio-kiln", 1000, 750)], tagged: ["maya"], likes: 19, audience: "friends" }), city: "austin" },
  { ...P("wes", 640, "senior show install at 2am. maya labeled every single wall text by hand because the printer died", { images: [photo("ut-design-senior-show", 1000, 750)], tagged: ["maya", "kenji"], likes: 36, audience: "friends" }), city: "austin" },
  { ...P("yara", 95, "run club turnout this morning. maya came back after like a year and still dropped us on the hill", { images: [photo("town-lake-run-club-group", 1000, 750)], tagged: ["maya", "raj"], likes: 24, audience: "friends" }), city: "austin" },
];

/** The trigger: Nadia posted today. Friends-only, from Chicago, with a photo. Not evidence of anything shared. */
export const triggerPosts: Post[] = [
  { ...P("nadia", 3, "first lakefront run since the move. 7 miles, 19°F, zero regrets. the lake was doing the thing where it looks like the ocean", { images: [photo("chicago-lakefront-winter-run", 1000, 750)], likes: 17, hours: true, audience: "friends" }), city: "chicago" },
  { ...P("cole", 30, "cleaned out the spare room. there is now a bed in it. this is not a hint. (it is a hint)", { images: [photo("dallas-spare-room", 1000, 750)], likes: 12, hours: true, audience: "friends" }), city: "dallas" },
];

/** Events in the past that people went to together: code reads these as meetups. */
export const pastEvents: FBEvent[] = [
  {
    id: "e_turkey_trot_2024", title: "Austin Turkey Trot", cover: photo("event-turkey-trot", 1200, 600),
    startsAt: daysAgo(410, 8), endsAt: daysAgo(410, 11), location: "Long Center lawn", address: "701 W Riverside Dr, Austin, TX",
    category: "Fitness", description: "5 miler, then migas.", going: ["maya", "nadia", "arjun", "yara"], interested: [], city: "austin",
  },
  {
    id: "e_ut_design_show", title: "UT Design Senior Show 2024", cover: photo("event-ut-design-show", 1200, 600),
    startsAt: daysAgo(640, 18), endsAt: daysAgo(640, 22), location: "UT Art Building atrium", address: "2301 San Jacinto Blvd, Austin, TX",
    category: "Arts", description: "The class of 2024 shows the work.", going: ["maya", "wes", "kenji", "arjun", "nadia", "sofia"], interested: [], city: "austin",
  },
  {
    id: "e_lny_2025", title: "Lunar New Year Potluck 2025", cover: photo("event-lny-2025", 1200, 600),
    startsAt: daysAgo(290, 18), endsAt: daysAgo(290, 22), location: "Asian American Resource Center", address: "8401 Cameron Rd, Austin, TX",
    hostGroupId: "g_atx_lny", category: "Culture", description: "Bring a dish your family makes. Red envelopes for the kids. Mahjong after.", going: ["maya", "hannah", "zoe", "grace", "ethan"], interested: [], city: "austin",
  },
];

/** A culture kind of reconnection: a group Maya is in but has drifted from, with an event coming up. */
export const cultureGroups: Group[] = [
  {
    id: "g_atx_lny", name: "ATX Lunar New Year (20s & 30s)", cover: photo("atx-lny-group", 1200, 500),
    description: "Chinese, Vietnamese, Korean and everyone-adjacent young adults in Austin who want to actually celebrate instead of calling home and feeling bad. Potlucks, dumpling nights, mahjong that gets too serious.",
    privacy: "public", memberIds: ["maya", "hannah", "zoe", "grace", "ethan", "priya", "kenji", "mei"], adminIds: ["hannah"], tags: ["Culture", "Food", "Community"], createdAt: daysAgo(900), postsPerDay: 0.3,
  },
];
export const cultureEvents: FBEvent[] = [
  {
    id: "e_dumpling_night", title: "Dumpling Night: fold, eat, mahjong", cover: photo("event-dumpling-night", 1200, 600),
    startsAt: inDays(9, 18), endsAt: inDays(9, 22), location: "Hannah's house (North Loop)", address: "North Loop, Austin, TX",
    hostGroupId: "g_atx_lny", hostId: "hannah", category: "Culture", price: "Bring a filling or $10", description: "Pre-new-year practice round. Hannah's grandma's wrapper recipe. Two tables of mahjong, one of them friendly.",
    going: ["hannah", "zoe", "grace", "ethan"], interested: ["priya", "kenji"], city: "austin",
  },
];

/** Private picks that exist before the demo: Nadia tapped "I miss them" on Maya last week. Nobody can see this. */
export const seededMisses: [string, string][] = [["nadia", "maya"], ["cole", "maya"], ["harper", "cole"]];

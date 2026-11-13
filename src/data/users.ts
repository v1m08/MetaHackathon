import type { User } from "@/types";
import { face, photo } from "./helpers";

// A believable friend graph of young adults in Austin, TX.
// IDs are short handles so URLs read well (/profile/maya) and so ?as=maya works.

const U = (u: Omit<User, "friendIds" | "joined" | "cover"> & { cover?: string; joined?: string }): User => ({
  friendIds: [],
  joined: u.joined ?? "2017-08-20T00:00:00.000Z",
  cover: u.cover ?? photo(`cover-${u.id}`, 1200, 500),
  ...u,
});

export const users: User[] = [
  U({
    id: "maya", name: "Maya Chen", username: "maya.chen", age: 23, pronouns: "she/her", avatar: face(47),
    bio: "product designer @ a startup you haven't heard of yet · trail runs before work · pottery on sundays",
    location: "Austin, TX", hometown: "Plano, TX", school: "UT Austin · Design '24", work: "Product Designer at Lumen Health",
    relationship: "Single", interests: ["trail running", "pottery", "matcha", "Figma", "thrifting", "Barton Springs"], birthday: "11-19",
  }),
  U({
    id: "jordan", name: "Jordan Reyes", username: "jordan.reyes.atx", age: 24, pronouns: "he/him", avatar: face(12),
    bio: "line cook by night, future taco truck owner by 2027 🌮 ask me about my salsa macha",
    location: "Austin, TX", hometown: "Laredo, TX", school: "Austin Community College", work: "Line Cook at Suerte",
    relationship: "In a relationship", interests: ["cooking", "food trucks", "Spurs", "cumbia", "bikes", "Marketplace flipping"], birthday: "03-02",
  }),
  U({
    id: "priya", name: "Priya Natarajan", username: "priyan", age: 22, pronouns: "she/her", avatar: face(44),
    bio: "CS senior @ UT · hackathon goblin · currently homeless as of august (apartment hunting, not literally)",
    location: "Austin, TX", hometown: "Sugar Land, TX", school: "UT Austin · Computer Science '26",
    work: "SWE Intern (prev. Dell)", relationship: "Single", interests: ["hackathons", "boba", "mechanical keyboards", "K-dramas", "rock climbing"], birthday: "07-14",
  }),
  U({
    id: "devon", name: "Devon Williams", username: "devon.w", age: 25, pronouns: "he/him", avatar: face(53),
    bio: "ER nurse (nights) · rec league volleyball · will beat you in 2K · sleep schedule: no",
    location: "Austin, TX", hometown: "Killeen, TX", school: "Texas State · Nursing '23", work: "RN at Dell Seton Medical Center",
    relationship: "Single", interests: ["volleyball", "NBA 2K", "meal prep", "sneakers", "podcasts"], birthday: "01-28",
  }),
  U({
    id: "sofia", name: "Sofia Alvarez", username: "sofia.sings", age: 21, pronouns: "she/her", avatar: face(26),
    bio: "vocals/guitar in Porch Lights 🎸 · RTF junior · we have a show friday come thru",
    location: "Austin, TX", hometown: "El Paso, TX", school: "UT Austin · Radio-Television-Film '27",
    work: "Porch Lights (band) · Barista at Jo's", relationship: "It's complicated", interests: ["indie rock", "songwriting", "film photography", "vinyl", "Hotel Vegas"], birthday: "09-30",
  }),
  U({
    id: "ethan", name: "Ethan Park", username: "ethanpark", age: 26, pronouns: "he/him", avatar: face(68),
    bio: "swe · bouldering V5 on a good day · trying to cook more than eggs",
    location: "Austin, TX", hometown: "Irvine, CA", school: "UC San Diego · CS '22", work: "Software Engineer at Indeed",
    relationship: "Single", interests: ["bouldering", "coffee", "board games", "Formula 1", "hiking"], birthday: "05-11",
  }),
  U({
    id: "aisha", name: "Aisha Bello", username: "aisha.bello", age: 23, pronouns: "she/her", avatar: face(49),
    bio: "MPH student · community organizer · if you need a volunteer sign-up sheet I already made one",
    location: "Austin, TX", hometown: "Houston, TX", school: "UT Austin · MPH '26", work: "Graduate Research Assistant, Dell Med",
    relationship: "Single", interests: ["public health", "mutual aid", "afrobeats", "farmers markets", "journaling"], birthday: "12-05",
  }),
  U({
    id: "lucas", name: "Lucas Moreau", username: "lucas.moreau", age: 24, pronouns: "he/him", avatar: face(33),
    bio: "came from Lyon for a semester in 2022, never left · barista @ Fleet · shoots 35mm · ask me for coffee recs",
    location: "Austin, TX", hometown: "Lyon, France", school: "Université Lumière Lyon 2", work: "Barista at Fleet Coffee",
    relationship: "Single", interests: ["film photography", "espresso", "football (soccer)", "cycling", "jazz"], birthday: "04-22",
  }),
  U({
    id: "hannah", name: "Hannah Kim", username: "hannahkim", age: 22, pronouns: "she/her", avatar: face(45),
    bio: "4th grade teacher 🍎 first year, send help · budgeting my way through my 20s",
    location: "Austin, TX", hometown: "Carrollton, TX", school: "UT Austin · Education '25", work: "Teacher at Pecan Springs Elementary",
    relationship: "In a relationship", interests: ["budgeting", "crochet", "Trader Joe's hauls", "pilates", "romance novels"], birthday: "08-08",
  }),
  U({
    id: "marcus", name: "Marcus Thompson", username: "marcusfit", age: 25, pronouns: "he/him", avatar: face(60),
    bio: "personal trainer · 5am club · reels about lifting without being annoying about it (mostly)",
    location: "Austin, TX", hometown: "Dallas, TX", school: "Texas State · Exercise Science '22", work: "Trainer at Castle Hill Fitness",
    relationship: "Single", interests: ["powerlifting", "content creation", "meal prep", "basketball", "anime"], birthday: "06-17",
  }),
  U({
    id: "zoe", name: "Zoe Nakamura", username: "zoe.nak", age: 20, pronouns: "she/they", avatar: face(16),
    bio: "sophomore · anime club treasurer · thrift flips · plat 2 in val don't @ me",
    location: "Austin, TX", hometown: "San Jose, CA", school: "UT Austin · Studio Art '28",
    relationship: "Single", interests: ["Valorant", "anime", "thrifting", "sewing", "bubble tea", "cosplay"], birthday: "02-14",
  }),
  U({
    id: "tyler", name: "Tyler Brooks", username: "tylerbrooks", age: 24, pronouns: "he/him", avatar: face(59),
    bio: "real estate (the assistant kind, for now) · pickleball evangelist · golden retriever energy",
    location: "Austin, TX", hometown: "Round Rock, TX", school: "Texas A&M · Business '24", work: "Transaction Coordinator at Keller Williams",
    relationship: "Single", interests: ["pickleball", "Aggie football", "lake days", "country music", "grilling"], birthday: "10-03",
  }),
  U({
    id: "nina", name: "Nina Okafor", username: "nina.okafor", age: 23, pronouns: "she/her", avatar: face(32),
    bio: "nursing school survivor (almost) · 47 plants and counting · yes I'll sell you a cutting",
    location: "Austin, TX", hometown: "Arlington, TX", school: "Texas State · Nursing '26", work: "Patient Care Tech",
    relationship: "In a relationship", interests: ["houseplants", "propagation", "reality TV", "baking", "nursing memes"], birthday: "03-19",
  }),
  U({
    id: "sam", name: "Sam Rivera", username: "samrivera.dj", age: 25, pronouns: "they/them", avatar: face(7),
    bio: "bartender @ Hotel Vegas · DJ sets as SAMANTHA_VR · booking shows, DM me",
    location: "Austin, TX", hometown: "Corpus Christi, TX", school: "Austin Community College", work: "Bartender at Hotel Vegas · DJ",
    relationship: "Single", interests: ["DJing", "house music", "vintage synths", "booking shows", "tattoos"], birthday: "11-27",
  }),
  U({
    id: "omar", name: "Omar Haddad", username: "omar.haddad", age: 26, pronouns: "he/him", avatar: face(56),
    bio: "PhD candidate (materials science, year 4, don't ask) · road cycling · makes a mean shakshuka",
    location: "Austin, TX", hometown: "Dearborn, MI", school: "UT Austin · PhD Materials Science", work: "Graduate Researcher",
    relationship: "Single", interests: ["road cycling", "Strava", "cooking", "chess", "space"], birthday: "01-09",
  }),
  U({
    id: "grace", name: "Grace Liu", username: "graceliu", age: 22, pronouns: "she/her", avatar: face(38),
    bio: "new grad in marketing · pilates & farmers markets · learning to like running (it's not working)",
    location: "Austin, TX", hometown: "Katy, TX", school: "UT Austin · Advertising '25", work: "Marketing Coordinator at Tito's",
    relationship: "Single", interests: ["pilates", "brunch", "matcha", "Taylor Swift", "interior design"], birthday: "06-02",
  }),
];

// Friendship edges (undirected). Dense in the core, sparser at the edges.
const edges: [string, string][] = [
  ["maya", "jordan"], ["maya", "priya"], ["maya", "aisha"], ["maya", "lucas"], ["maya", "hannah"], ["maya", "grace"], ["maya", "ethan"], ["maya", "sofia"], ["maya", "omar"],
  ["jordan", "sofia"], ["jordan", "sam"], ["jordan", "devon"], ["jordan", "tyler"], ["jordan", "nina"], ["jordan", "zoe"],
  ["priya", "zoe"], ["priya", "ethan"], ["priya", "aisha"], ["priya", "hannah"], ["priya", "omar"],
  ["devon", "nina"], ["devon", "marcus"], ["devon", "tyler"], ["devon", "sam"], ["devon", "ethan"],
  ["sofia", "sam"], ["sofia", "lucas"], ["sofia", "zoe"], ["sofia", "grace"],
  ["ethan", "omar"], ["ethan", "tyler"], ["ethan", "lucas"], ["ethan", "marcus"],
  ["aisha", "hannah"], ["aisha", "nina"], ["aisha", "grace"], ["aisha", "sam"],
  ["lucas", "sam"], ["lucas", "omar"], ["lucas", "grace"],
  ["hannah", "grace"], ["hannah", "nina"], ["hannah", "tyler"],
  ["marcus", "tyler"], ["marcus", "zoe"], ["marcus", "grace"],
  ["zoe", "sam"], ["tyler", "grace"], ["nina", "grace"], ["omar", "aisha"],
];
for (const [a, b] of edges) {
  users.find((u) => u.id === a)!.friendIds.push(b);
  users.find((u) => u.id === b)!.friendIds.push(a);
}
for (const u of users) u.privacy = u.id === "aisha" || u.id === "zoe" ? "friends" : "public";

export const userById = (id: string) => users.find((u) => u.id === id);

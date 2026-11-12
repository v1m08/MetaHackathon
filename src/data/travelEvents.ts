import type { Conversation, FBEvent, Group, Message, Post, Ride } from "@/types";
import { P } from "./builders";
import { hoursAgo, photo, uid } from "./helpers";
import { weekendLabel, wk } from "./travel";

// Out-of-town weekends for the travel feature. Every timestamp goes through wk() so the events are always
// "coming up" relative to boot. People are never marked going on a weekend they're busy (see travelUsers).

// ---------- events ----------
export const travelEvents: FBEvent[] = [
  {
    id: "e_nola_samantha", title: "SAMANTHA_VR + Colin Byrne — late set at the Hi-Ho Lounge", cover: photo("event-nola-samantha", 1200, 600),
    startsAt: wk(1, 1, 22), endsAt: wk(1, 2, 2), location: "Hi-Ho Lounge", address: "2239 St Claude Ave, New Orleans, LA", city: "new-orleans",
    hostId: "sam", category: "Music", price: "$12 adv / $15 door",
    description: "First NOLA booking!! Colin's coming down from Chicago to open with the house set, I go on at midnight. Finn's driving the van so there's room for 2 more if you want to make a weekend of it. Camille is putting everyone on the list at the Spotted Cat friday. 21+. We're going to Café du Monde at 3am and nobody can stop us.",
    going: ["sam", "finn", "camille", "beau", "lucas", "zoe", "colin"], interested: ["maya", "jordan"],
  },
  {
    id: "e_hou_night_market", title: "Montrose Night Market", cover: photo("event-hou-night-market", 1200, 600),
    startsAt: wk(2, 1, 18), endsAt: wk(2, 1, 23), location: "Montrose Collective (parking lot + courtyard)", address: "888 Westheimer Rd, Houston, TX", city: "houston",
    hostId: "raj", category: "Food & Drink", price: "Free entry, bring cash",
    description: "The good one. 60+ vendors, half of them food. I'm making the route: viet-cajun crawfish → birria ramen → the ube cheesecake lady → that one Nigerian suya stand Maddie won't shut up about. Yara's driving from Austin with seats. If you come, you're staying at mine, I have a futon and a very opinionated roommate.",
    going: ["raj", "yara", "tj", "maddie", "layla", "priya"], interested: ["maya", "aisha"],
  },
  {
    id: "e_nash_songwriter", title: "East Nashville Songwriter Round: Leah Whitfield + friends at The 5 Spot", cover: photo("event-nash-songwriter", 1200, 600),
    startsAt: wk(3, 0, 20), endsAt: wk(3, 0, 23), location: "The 5 Spot", address: "1006 Forrest Ave, Nashville, TN", city: "nashville",
    hostId: "leah", category: "Music", price: "$10",
    description: "Four writers, one guitar each, no talking during songs (I will stare at you). I'm playing three new ones, including the one Sofia heard a demo of and cried in a Whataburger parking lot. Sofia's flying in to sing harmonies on the last one. Kai's got a couch, Ruben and Marisol have actual beds. Come to Nashville, it's cheaper than you think in December.",
    going: ["leah", "kai", "tess", "ruben", "sofia", "andre", "kwame"], interested: ["maya", "sam"],
  },
  {
    id: "e_sa_pearl_spurs", title: "Pearl farmers market → Spurs game (day trip)", cover: photo("event-sa-pearl-spurs", 1200, 600),
    startsAt: wk(3, 1, 9), endsAt: wk(3, 1, 23), location: "The Pearl → Frost Bank Center", address: "303 Pearl Pkwy, San Antonio, TX", city: "san-antonio",
    hostId: "gabe", category: "Sports", price: "Market free · Spurs tix ~$28 upper bowl",
    description: "Classic Gabe Saturday. Market at 9 (the tamale lady sells out by 10:30, be warned), lunch at my abuela's (non-negotiable, she already knows how many of you are coming), nap, then Spurs vs Grizzlies at 7. Tyler's driving down from Austin and back same night. I have a guest room if anyone wants to stay and do the missions Sunday.",
    going: ["gabe", "lena", "tyler", "owen"], interested: ["devon"],
  },
  {
    id: "e_chi_improv_bday", title: "Arjun's 25th: Second City mainstage + deep dish after", cover: photo("event-chi-improv-bday", 1200, 600),
    startsAt: wk(3, 1, 19), endsAt: wk(3, 1, 23, 30), location: "The Second City", address: "230 W North Ave, Chicago, IL", city: "chicago",
    hostId: "arjun", category: "Party", price: "$35 show tix (I'm covering the pizza)",
    description: "A quarter century of losing hackathons. 7pm mainstage show, then Pequod's (the caramelized crust one, don't argue with me about Lou's). It will be cold. It will be worth it. Priya is flying in, which means you have no excuse. My couch in Wicker Park is spoken for by Priya but Nadia and Mei both said they'd take strays.",
    going: ["arjun", "nadia", "mei", "colin", "priya"], interested: ["maya", "ethan"],
  },
  {
    id: "e_dal_vintage", title: "Deep Ellum Vintage Market (winter edition)", cover: photo("event-dal-vintage", 1200, 600),
    startsAt: wk(4, 1, 10), endsAt: wk(4, 1, 17), location: "Deep Ellum Art Co. + the lot behind it", address: "3200 Commerce St, Dallas, TX", city: "dallas",
    hostId: "harper", category: "Shopping", price: "Free entry",
    description: "90 vendors, mostly 70s-00s, lots of western wear this time because of course. I'm selling out of Owen's trunk (booth 41). Cole has a spare room for Austin people, Diego said he'll cook Saturday night if we get 6+ heads. Carhartt prices are insane right now, bring cash and leave your dignity.",
    going: ["harper", "owen", "zoe", "cole", "sienna", "ravi"], interested: ["maya", "grace"],
  },
  {
    id: "e_den_mural_comp", title: "RiNo Mural Crawl + Movement bouldering comp finals", cover: photo("event-den-mural-comp", 1200, 600),
    startsAt: wk(4, 1, 11), endsAt: wk(4, 1, 22), location: "RiNo Art District → Movement RiNo", address: "2845 Walnut St, Denver, CO", city: "denver",
    hostId: "jules", category: "Fitness", price: "Crawl free · comp spectating $10",
    description: "I set the finals problems so I legally cannot compete, which means I'm your tour guide. Mural walk 11-2 (I know who painted what and who they're mad at), tacos at the Source, comp finals at 6. Ethan is flying in to be humbled on the wall. I have a couch and Noah has a guest room 10 min away. Bring a real coat, it's Denver.",
    going: ["jules", "noah", "ethan", "mateo"], interested: ["maya", "omar"],
  },
  {
    id: "e_marfa_sky", title: "Marfa Night Sky Weekend (Chinati grounds + McDonald Observatory star party)", cover: photo("event-marfa-sky", 1200, 600),
    startsAt: wk(5, 0, 18), endsAt: wk(5, 2, 12), location: "June's casita → Chinati → McDonald Observatory", address: "Marfa, TX", city: "marfa",
    hostId: "june", category: "Outdoors", price: "Star party $25 · Chinati self-guided free",
    description: "New moon weekend. Friday: arrive, tacos at the food truck by the courthouse, Marfa lights viewing area (yes they're real, no they're not aliens). Saturday: Chinati grounds in the morning, nap, drive out to the observatory for the star party at 8. Sunday: Prada Marfa photo and go home. The casita sleeps 4 on a good night; bring a sleeping bag and a second blanket, it gets COLD. Kenji's driving the Subaru from Austin.",
    going: ["june", "silas", "kenji", "lucas"], interested: ["maya", "zoe", "omar"],
  },
  {
    id: "e_atl_beltline_run", title: "BeltLine Night Run 5k + Ponce City Market after", cover: photo("event-atl-beltline-run", 1200, 600),
    startsAt: wk(6, 1, 18), endsAt: wk(6, 1, 22), location: "Eastside Trail (start at Krog Street Tunnel)", address: "Krog St NE, Atlanta, GA", city: "atlanta",
    hostId: "andre", category: "Fitness", price: "$20 reg (glow stuff included)",
    description: "The glow run. 5k on the Eastside Trail, headlamps and LED bracelets, then the rooftop at Ponce for the carnival games and a beer. Marcus is coming from Austin to run it 'easy' which means sub-20. Kwame is NOT running, he's cheering with a cowbell. Bri's picking the restaurant after because she's the food writer. My couch is open, Simone's is too if you're quiet.",
    going: ["andre", "bri", "kwame", "simone", "marcus"], interested: ["maya", "yara"],
  },
  {
    id: "e_la_screening", title: "Dani's short film screening at Echo Park Film Center", cover: photo("event-la-screening", 1200, 600),
    startsAt: wk(6, 0, 19), endsAt: wk(6, 0, 22), location: "Echo Park Film Center", address: "1200 N Alvarado St, Los Angeles, CA", city: "los-angeles",
    hostId: "dani", category: "Film", price: "$8 suggested",
    description: "My thesis short 'Cumbia for the End of the World' (14 min, shot on 16mm, Rosa did stills) screens in a program with 5 other student films. Q&A after where I will say 'that's a great question' a lot. My sister is flying in. My couch has hosted half of El Paso and it can host you. Tacos at Guisados after, I'm buying for whoever helped on set.",
    going: ["dani", "theo", "rosa", "sofia"], interested: ["maya", "lucas"],
  },
  {
    id: "e_nyc_config", title: "UT Design alumni meetup + Wes's studio open house in Bushwick", cover: photo("event-nyc-config", 1200, 600),
    startsAt: wk(7, 1, 14), endsAt: wk(7, 1, 20), location: "Wes's studio (the one room) → Roberta's", address: "Bushwick, Brooklyn, NY", city: "new-york",
    hostId: "wes", category: "Networking", price: "Free (bring a 6-pack)",
    description: "Every UT Design person in the tri-state area in one room (the room is also my apartment, so like 15 people max). I'm showing the type specimen project and the thing I can't post yet. 2pm open house, 5pm walk to Roberta's. Ava is bringing the agency people. I literally have nowhere for you to sleep but I will walk you around the city until your feet give up.",
    going: ["wes", "ava", "ibrahim", "grace"], interested: ["maya"],
  },
  {
    id: "e_nash_run", title: "Shelby Bottoms trail run + hot chicken after", cover: photo("event-nash-run", 1200, 600),
    startsAt: wk(5, 1, 8), endsAt: wk(5, 1, 13), location: "Shelby Bottoms Nature Center", address: "1900 Davidson St, Nashville, TN", city: "nashville",
    hostId: "kai", category: "Fitness", price: "Free (chicken is like $14)",
    description: "8am start before the tourists wake up, 6ish miles on the greenway and the dirt trails along the Cumberland, then Bolton's for hot chicken (Prince's if the line is too long). Tess is coming off a night shift and says she'll run anyway, which is deranged. Marisol is walking it with the dog. Andre's driving up from Atlanta. Couch is open.",
    going: ["kai", "tess", "marisol", "andre"], interested: ["maya"],
  },
];

// ---------- rides ----------
export const travelRides: Ride[] = [
  {
    id: "ride_finn_nola", driverId: "finn", eventId: "e_nola_samantha", fromCity: "austin", toCity: "new-orleans",
    departAt: wk(1, 0, 13), returnAt: wk(1, 2, 14), seatsOpen: 2, riderIds: ["sam", "lucas"],
    note: "the band van (Sprinter, seats 8 but the back is gear). leaving from Hotel Vegas at 1pm sharp friday. split gas 4 ways ~$45 each. I drive the speed limit, sam picks the music until Lafayette.",
  },
  {
    id: "ride_yara_hou", driverId: "yara", eventId: "e_hou_night_market", fromCity: "austin", toCity: "houston",
    departAt: wk(2, 1, 10), returnAt: wk(2, 2, 18), seatsOpen: 3, riderIds: [],
    note: "corolla, 3 seats, leaving from the Mueller HEB lot sat 10am, back sunday evening. I'm staying at my parents' so you'll need a couch (raj has one). gas is like $15 each, buc-ee's stop is mandatory.",
  },
  {
    id: "ride_andre_nash", driverId: "andre", eventId: "e_nash_songwriter", fromCity: "atlanta", toCity: "nashville",
    departAt: wk(3, 0, 14), returnAt: wk(3, 2, 15), seatsOpen: 2, riderIds: ["kwame"],
    note: "4runner, leaving from my place in Old Fourth Ward at 2 friday so we make Leah's set. 4 hours with one stop. kwame's already in so the playlist is going to be a fight. gas split ~$20 each.",
  },
  {
    id: "ride_tyler_sa", driverId: "tyler", eventId: "e_sa_pearl_spurs", fromCity: "austin", toCity: "san-antonio",
    departAt: wk(3, 1, 7, 30), returnAt: wk(3, 1, 23, 30), seatsOpen: 2, riderIds: ["owen"],
    note: "day trip! 4runner, leaving round rock 7:30 (I can grab you on the way down 35). back after the game, home by 11:30ish. gabe's abuela is feeding us so don't eat breakfast. $10 each for gas.",
  },
  {
    id: "ride_owen_dal", driverId: "owen", eventId: "e_dal_vintage", fromCity: "austin", toCity: "dallas",
    departAt: wk(4, 1, 7), returnAt: wk(4, 2, 19), seatsOpen: 3, riderIds: ["zoe"],
    note: "tacoma, trunk is half harper's inventory so pack light. sat 7am from south lamar, back sunday evening. zoe's in. cole has a spare room, otherwise it's floor at harper's. gas ~$18 each.",
  },
  {
    id: "ride_ravi_dal", driverId: "ravi", eventId: "e_dal_vintage", fromCity: "austin", toCity: "dallas",
    departAt: wk(4, 0, 17), returnAt: wk(4, 2, 20), seatsOpen: 2, riderIds: [],
    note: "going up for family anyway so the car's going regardless. civic, 2 seats, fri 5pm from mueller (yes in traffic, sorry), back sunday night. I drive the speed limit and I'm not sorry about that either. $15 each or buy me a kolache in west.",
  },
  {
    id: "ride_kenji_marfa", driverId: "kenji", eventId: "e_marfa_sky", fromCity: "austin", toCity: "marfa",
    departAt: wk(5, 0, 13), returnAt: wk(5, 2, 16), seatsOpen: 3, riderIds: ["lucas"],
    note: "the subaru's 7th marfa trip. 6.5 hrs, leaving east austin 1pm friday, stop in fredericksburg and fort stockton. lucas is in with a camera bag that counts as a person. gas ~$40 each round trip. bring a blanket for the car, I run the AC like a psycho.",
  },
];

// ---------- groups ----------
export const travelGroups: Group[] = [
  {
    id: "g_alumni_away",
    name: "UT Austin Alumni Who Left (but visit) 🤠",
    cover: photo("alumni-away-cover", 1200, 500),
    description:
      "For Longhorns who moved away and everyone still in Austin who misses them. Post when you're visiting, post when you have a couch, post flight deals, post when you need a local to tell you where to eat. Not a job board. Not a place to argue about whether Austin changed (it did).",
    privacy: "public",
    memberIds: [
      "kai", "nadia", "arjun", "mei", "andre", "bri", "marisol", "tess", "ruben", "leah", "noah", "ivy", "jules", "wes", "ava", "cole", "harper",
      "kenji", "gabe", "raj", "june", "dani", "theo", "beau", "maya", "sofia", "priya", "grace", "omar", "ethan", "zoe", "sienna",
    ],
    adminIds: ["kai", "nadia"],
    tags: ["UT Austin", "Alumni", "Travel", "Couches"],
    createdAt: "2023-06-02T00:00:00.000Z",
    rules: ["Say what city you're in", "Couch offers: say how many nights, and whether there's a pet", "No job postings, no MLMs, no 'Austin was better in 2015'", "If someone hosted you, post a pic of their city"],
    postsPerDay: 1,
  },
  {
    id: "g_rideshares",
    name: "Austin Road Trips & Rideshares",
    cover: photo("rideshares-cover", 1200, 500),
    description:
      "Austin people with cars going places, and Austin people without cars who want to go to those places. Post your trip, your seats, your departure point and your return time. Riders: say how much stuff you have. Everyone: split gas, don't be weird about it.",
    privacy: "public",
    memberIds: [
      "finn", "kenji", "maya", "jordan", "priya", "devon", "sofia", "ethan", "aisha", "lucas", "zoe", "tyler", "omar", "grace", "sam", "marcus",
      "yara", "owen", "ravi", "amara", "ella", "harper", "raj", "cole", "andre", "june",
    ],
    adminIds: ["finn", "kenji"],
    tags: ["Road Trips", "Rideshare", "Austin", "Travel"],
    createdAt: "2022-02-14T00:00:00.000Z",
    rules: [
      "Gas gets split evenly between everyone in the car including the driver. Venmo before you get out.",
      "Drivers post: departure point, time, return time, seats, how much trunk space.",
      "Riders post: how much stuff you have and whether you're a 'stop every hour' person.",
      "Driver picks the music for the first hour. After that it's a democracy.",
      "No last-minute flakes without a text. We all have the group chat.",
    ],
    postsPerDay: 1,
  },
];

// ---------- group posts ----------
const alumni: Post[] = [
  P("kai", 1, `who's going to be in nashville in december? leah's round at the 5 spot is ${weekendLabel(3)} and she's playing the new ones. sofia's already flying in. my couch is yours (dolly the cat is a non-negotiable roommate). also shelby bottoms run + hot chicken ${weekendLabel(5)} if you're more of a morning person`, {
    group: "g_alumni_away", likes: 19, love: 6,
    comments: [
      ["sofia", "I'M COMING. flights were $140 round trip on southwest when I booked, check tuesday mornings"],
      ["maya", "stop tempting me with dolly"],
      ["kai", "dolly says come", [["maya", "dolly doesn't pay my rent"]]],
      ["andre", "driving up from atl friday with kwame, 2 seats if anyone's in atlanta somehow"],
      ["tess", "I'm off that friday for once. this never happens. don't make me regret saying it"],
    ],
  }),
  P("arjun", 3, `hi it's me, the one who lost the hackathon. I'm turning 25 ${weekendLabel(3)} and doing second city + deep dish in chicago. priya is flying in. if you're also flying in, flights out of AUS have been $120-180 on united. nadia and mei both have couches, mine is priya's. come be cold with us`, {
    group: "g_alumni_away", likes: 24, love: 9, haha: 3,
    comments: [
      ["priya", "we didn't lose, we placed. 14th is placing"],
      ["nadia", "couch confirmed, hyde park, 2 nights, I have exams the week before so I'm going to be insufferable"],
      ["mei", "my couch is also open but I'm going to draw you. that's the rent"],
      ["ethan", "second city AND pequod's. ok I'm looking at flights"],
    ],
  }),
  P("nadia", 6, "PSA for anyone flying to visit anyone this winter: google flights → explore → set your dates to 'weekend' and leave the destination blank. AUS→MDW was $89 one way on southwest when I checked for maya (she still hasn't booked). AUS→BNA $70. AUS→ATL $64 on frontier if you hate yourself. prices are lowest tuesday/wednesday, book 3-5 weeks out", {
    group: "g_alumni_away", likes: 41, love: 7, shares: 9,
    comments: [
      ["maya", "I am being called out in a public group"],
      ["bri", "frontier to atlanta is $64 and then $89 for your backpack lol"],
      ["grace", "saving this. ok wait, $70 to nashville is actually nothing"],
      ["kenji", "or you could drive to marfa with me for $40 in gas. just saying. the stars are free"],
    ],
  }),
  P("june", 10, `casita update for anyone planning marfa: it has a space heater now. ONE space heater. it gets to 28° at night in december out here and the walls are adobe which is beautiful and also means nothing. bring a real sleeping bag, not the one from your freshman dorm. star party weekend is ${weekendLabel(5)}, 4 people max in the casita, floor is first come first serve`, {
    group: "g_alumni_away", likes: 22, haha: 5, wow: 2, images: [photo("marfa-casita", 800, 600)],
    comments: [
      ["kenji", "can confirm. I slept in the subaru one time and it was warmer"],
      ["lucas", "I have a 0° bag from the camping phase. I'm in. bringing the large format for silas to judge"],
      ["maya", "28 degrees?? in TEXAS?"],
      ["june", "it's the desert maya. come anyway. the stars will fix your brain", [["maya", "my brain does need fixing"]]],
    ],
  }),
  P("wes", 15, `UT design people in NYC: open house at my studio ${weekendLabel(7)}. 'studio' meaning my apartment, which is one room in bushwick. showing the type specimen and a thing I can't post yet. roberta's after. I have literally nowhere for anyone to sleep (one room!!) but ava has a couch uptown and I will walk you around until your feet die`, {
    group: "g_alumni_away", likes: 17, love: 4,
    comments: [
      ["ava", "couch confirmed. upper west side, 2 nights, I leave for work at 7:30 so you'll have the place"],
      ["grace", "I'm in!! booked. taking the friday off"],
      ["maya", "wes you KNOW I want to see the thing you can't post"],
      ["wes", "then come see it", [["maya", "I'm doing math on it"]]],
    ],
  }),
  P("harper", 22, `looking for a guide: who knows denver? going for a conference in jan and I have a free saturday. I want murals, a good coffee, and somewhere to eat that isn't $40 a plate. noah? jules? ivy? one of you has to be useful`, {
    group: "g_alumni_away", likes: 11,
    comments: [
      ["jules", "I literally give a mural tour. DM me the date. coffee is huckleberry roasters, food is the source food hall, you're welcome"],
      ["noah", "if it's a saturday I'm probably skiing but I'll leave you a key lol. guest room's open"],
      ["ivy", "I'll take you on a trail run and you'll hate me and then love me"],
      ["harper", "this is the most useful this group has ever been"],
    ],
  }),
  P("beau", 31, `austin people: my place in the bywater is open most weekends through mardi gras, 2 nights max, there's a dog and a lot of brass band at 2am that isn't me. sam's got a show at the hi-ho ${weekendLabel(1)} and I'm making red beans for whoever shows up. finn's driving the van from austin`, {
    group: "g_alumni_away", likes: 28, love: 8,
    comments: [
      ["maya", "beau I still owe you for the run club summer. red beans though..."],
      ["beau", "you owe me nothing except a visit. the trail is right there, we'll run the levee"],
      ["zoe", "I'm in the van!! first time in new orleans, tell me everything"],
      ["camille", "zoe I'm putting you on the list at the spotted cat. don't wear heels on frenchmen"],
    ],
  }),
  P("andre", 44, `atl check in: beltline night run is back ${weekendLabel(6)}, glow sticks and everything. I have a couch in old fourth ward (2 nights, no pets, decent coffee), simone has one too if you're the quiet type. marcus is coming to run it 'easy' which is a lie`, {
    group: "g_alumni_away", likes: 15, love: 3,
    comments: [
      ["marcus", "easy is a mindset"],
      ["bri", "I'll pick the dinner spot. there's a new ethiopian place on buford highway I need an excuse for"],
      ["simone", "couch is real, I just need 24h notice and you can't be loud after 10, I'm old"],
      ["maya", "I miss you guys. also I can't believe it's been a year since you left"],
    ],
  }),
  P("mei", 58, "drew the people who stayed on my couch this fall. pilsen has been good to me. if you come visit you get drawn, that's the deal, I'm not taking money", {
    group: "g_alumni_away", likes: 54, love: 21, wow: 4, images: [photo("mei-couch-sketches", 800, 1000)],
    comments: [
      ["zoe", "SENPAI these are so good. I need to come to chicago immediately"],
      ["arjun", "I'm the one with the hoodie. I look stressed because I was"],
      ["nadia", "the fact that you got my eye bags exactly right. rude. beautiful. rude"],
      ["mei", "zoe come for arjun's birthday, I'll draw you with the deep dish"],
    ],
  }),
  P("gabe", 75, "back in SA for good (hi). my abuela has decided she's feeding every UT person who comes through town, so that's a standing offer. guest room is open 2 nights, the pearl market saturdays is my church. tyler is already planning a spurs day trip and he's not even an alumni of this group, he just has a car", {
    group: "g_alumni_away", likes: 23, love: 7, haha: 4,
    comments: [
      ["maya", "your abuela's chilaquiles live in my head rent free"],
      ["lena", "I'm not UT but I'm here for the market and to beat tyler at pickleball again"],
      ["tyler", "I have a car and a dream lena"],
      ["gabe", "everyone has a seat at the table, UT or not, abuela doesn't check IDs"],
    ],
  }),
  P("raj", 95, `houston reminder: montrose night market winter edition is ${weekendLabel(2)}. I'm doing a food route. yara's driving from austin with 3 seats, futon at mine is open (roommate has opinions about the TV). priya you said you'd come when the apartment thing was over and the apartment thing is over`, {
    group: "g_alumni_away", likes: 18, love: 5,
    comments: [
      ["priya", "the apartment thing IS over and I'm coming. I need a win"],
      ["maddie", "the suya stand. tell them the suya stand"],
      ["raj", "the suya stand is on the route maddie, calm down"],
      ["aisha", "maddie I'm looking at coming too, mostly for you, partly for the suya"],
    ],
  }),
  P("marisol", 115, "first fall in nashville done. things I've learned: 1) it's not cheaper than austin anymore 2) the hot chicken is worth it 3) the UT alumni crowd here is actually big and kai is the mayor of it. we have a guest room and a dog named Pepper, open most weekends except when my sister visits. come see leah play, she's the real deal", {
    group: "g_alumni_away", likes: 32, love: 10,
    comments: [
      ["kai", "I am not the mayor. I am the city planner at most"],
      ["maya", "marisol I miss pottery with you so much. the studio replaced you with a guy who only makes mugs"],
      ["leah", "'the real deal' putting this on a poster"],
      ["ruben", "the rent thing is true. jordan don't move here for the rent, move here for me"],
    ],
  }),
];

const rideshares: Post[] = [
  P("finn", 0.5, `🚐 NEW ORLEANS ${weekendLabel(1)}: band van, leaving hotel vegas friday 1pm, back sunday ~2pm. sam and lucas are in, 2 seats left. back half is gear so one bag each. gas split 4 ways ~$45. I drive the speed limit, sam has the aux until lafayette. sam's set is sat night at the hi-ho, beau's making red beans`, {
    group: "g_rideshares", likes: 14, love: 3, event: "e_nola_samantha",
    comments: [
      ["zoe", "I'm marked going but I don't have a ride... is one seat me??"],
      ["finn", "zoe yes, you're basically already in, just venmo me when we're on 10", [["zoe", "DONE. first time in nola I'm so excited"]]],
      ["maya", "ugh I want to. jordan are you going"],
      ["jordan", "I have a pop-up that weekend 😭 next time"],
    ],
  }),
  P("yara", 2, `houston ${weekendLabel(2)} for the montrose night market. corolla, 3 seats, leaving mueller HEB sat 10am, back sunday ~6pm. I'm staying at my parents so you'll need a couch (raj has a futon). gas is like $15 each. buc-ee's stop is not optional, it's a religion`, {
    group: "g_rideshares", likes: 11, event: "e_hou_night_market",
    comments: [
      ["priya", "I'm in, I'll take raj's futon. one backpack. I am a 'stop once' person"],
      ["aisha", "maybe! can I tell you thursday?"],
      ["yara", "thursday's fine, I just need a headcount for the buc-ee's budget"],
    ],
  }),
  P("kenji", 4, `MARFA CHECKLIST (pinning this, I've done this trip 6 times):
• sleeping bag rated 20° or lower. june's casita has one space heater. ONE.
• water. there is one grocery store and it closes at 8.
• red headlamp for the star party, they'll yell at you for white light
• cash. half the town doesn't take cards and the food truck is cash only
• download your maps, there's no signal after fort stockton
• gas up in fort stockton. do NOT wait for marfa
• a real jacket. the desert doesn't care that it's texas
subaru leaves east austin fri 1pm ${weekendLabel(5)}, lucas is in, 3 seats left, ~$40 gas round trip each`, {
    group: "g_rideshares", likes: 31, love: 6, shares: 7, event: "e_marfa_sky",
    comments: [
      ["lucas", "'a camera bag counts as a person' is still true right"],
      ["kenji", "it counts as half a person. you're on probation"],
      ["omar", "interested. does the star party actually let you look through the big telescope?"],
      ["june", "omar yes, the 82 inch if the line isn't bad. come, I'll vouch for you to the astronomers"],
      ["zoe", "I want to come but I'm also doing dallas the weekend before, my bank account is crying"],
    ],
  }),
  P("owen", 7, `dallas ${weekendLabel(4)} for the deep ellum vintage market. tacoma, sat 7am from south lamar, back sunday evening. trunk is half harper's inventory so ONE bag. zoe's in. 3 seats. cole has a spare room for austin people, otherwise floor at harper's. gas ~$18 each`, {
    group: "g_rideshares", likes: 9, event: "e_dal_vintage",
    comments: [
      ["zoe", "I'm bringing an empty duffel and coming back with a full one, is that one bag"],
      ["owen", "that's one bag with ambition. approved"],
      ["grace", "interested!! I need to not spend money but also carhartt"],
      ["cole", "spare room is real, queen bed, I'll be up at 6 making bad coffee"],
    ],
  }),
  P("ravi", 11, `also going to dallas ${weekendLabel(4)} but the boring way: fri 5pm from mueller (traffic, I know, I know), back sunday ~8pm. civic, 2 seats. going up for family so the car's going regardless, might as well fill it. I drive the speed limit and I will not be apologizing. $15 each or buy me a kolache in west`, {
    group: "g_rideshares", likes: 8, haha: 2, event: "e_dal_vintage",
    comments: [
      ["ethan", "ravi the speed limit on 35 is a suggestion"],
      ["ravi", "ethan the speed limit on 35 is the law and I have a clean record"],
      ["sienna", "if anyone takes ravi's ride I can meet you in uptown for brunch, I don't have space to host though"],
    ],
  }),
  P("tyler", 16, `SAN ANTONIO DAY TRIP ${weekendLabel(3)} 🏀 pearl market at 9, lunch at gabe's abuela's (mandatory, she's counting heads), spurs vs grizzlies at 7, home by 11:30. 4runner leaving round rock 7:30am, can grab you down 35. owen's in. 2 seats. $10 gas each. don't eat breakfast`, {
    group: "g_rideshares", likes: 13, love: 2, event: "e_sa_pearl_spurs",
    comments: [
      ["devon", "interested if I'm not on shift. I'll know wednesday"],
      ["lena", "I'll meet you at the market, ready to lose at pickleball again tyler"],
      ["tyler", "lena I beat you ONCE and you've never forgotten it"],
      ["gabe", "abuela says 6 people. she's already making tamales. don't make her a liar"],
    ],
  }),
  P("maya", 23, `ok rider post: is ANYONE driving to nashville ${weekendLabel(3)}? leah's round is that friday and kai's couch is calling. I know it's 13 hours. I know. I'm just asking. I have one bag and I'll bring snacks and pay more than my share of gas`, {
    group: "g_rideshares", likes: 10, care: 2,
    comments: [
      ["sofia", "I'm flying, it was $140. maya just fly with me"],
      ["maya", "$140 is a lot of pottery clay"],
      ["andre", "I'm driving atlanta → nashville friday if that helps at all. it doesn't. but I'm offering"],
      ["kenji", "13 hours in a car is a marfa trip and back. you're not ready"],
    ],
  }),
  P("finn", 31, `gas split etiquette, because it came up again last trip and I'm the admin so I get to be annoying:
1. gas is split evenly between EVERYONE in the car, driver included. the driver is already giving you their car and their saturday.
2. venmo before you get out at the destination, not 'later'. later is a lie.
3. tolls count as gas.
4. if the driver stops for food and you don't eat, you don't pay for food. if they stop for gas and you're in the car, you pay.
5. snacks for the car are a gift, not a gas payment. nice try.
that's it. love you all. drive safe.`, {
    group: "g_rideshares", likes: 47, love: 9, haha: 6, shares: 4,
    comments: [
      ["kenji", "co-signed as the other admin. also: wear a seatbelt in the back, the subaru beeps"],
      ["sam", "I offer DJ services as payment and it has never once worked"],
      ["lucas", "in my defense the snacks were from the good bakery"],
      ["aisha", "pinning this. #5 is personal and I accept it"],
    ],
  }),
  P("amara", 42, "non-event ride ask: anyone going to houston or dallas any weekend in the next month? I need to get a box of mutual aid supplies to a group in third ward and shipping is $90. I'll pay gas for the whole trip if you can fit a 24x24 box. no car, long story", {
    group: "g_rideshares", likes: 12, care: 5,
    comments: [
      ["yara", `I go to houston like monthly, next one is ${weekendLabel(2)} for the night market. box fits in the corolla, no charge, it's mutual aid`],
      ["amara", "yara I could cry. ok DMing you"],
      ["tj", "if it's third ward tell them to leave it with me, I'm 5 min from there"],
    ],
  }),
  P("harper", 55, `dallas → austin and back, basically every month, for anyone who ever needs it the other direction. I bring vintage down to the thrift group and go home empty, so the trunk's free on the way back. next one's ${weekendLabel(4)} for the deep ellum market but I'll be in austin the week before dropping stock. 3 seats, cash for gas, I only listen to dolly parton after dark`, {
    group: "g_rideshares", likes: 16, love: 3,
    comments: [
      ["owen", "harper I'm literally driving your inventory up that weekend"],
      ["harper", "and I'm bringing it down the weekend before. it's a loop owen. it's a system"],
      ["grace", "dolly after dark is a rule I can live by"],
      ["cole", "if y'all come up, spare room's open, I'll do breakfast tacos (the dallas kind, don't be mean)"],
    ],
  }),
];

export const travelGroupPosts: Post[] = [...alumni, ...rideshares];

// ---------- conversations ----------
type MSpec = [string, number, string, Message["attachment"]?];
const build = (id: string, participantIds: string[], msgs: MSpec[], extra: Partial<Conversation> = {}): Conversation => ({
  id,
  participantIds,
  isGroup: participantIds.length > 2,
  messages: msgs.map(([senderId, h, text, attachment]) => ({ id: uid("m"), senderId, text, createdAt: hoursAgo(h), attachment, readBy: participantIds })),
  ...extra,
});

export const travelConversations: Conversation[] = [
  build("c_maya_kai", ["maya", "kai"], [
    ["kai", 320, "", { type: "image", ref: photo("dolly-cat-window", 800, 800) }],
    ["kai", 319.9, "dolly sat in your spot on the couch for an hour. she misses you. I'm not projecting"],
    ["maya", 318, "you're projecting but also tell her I miss her too"],
    ["kai", 170, `ok real pitch. leah's round at the 5 spot is ${weekendLabel(3)}. she's playing the new ones. sofia's flying in. come for leah's round in december, couch is yours`],
    ["maya", 168, "kai I'm so broke. I spent my fun money on clay and a car repair for a car I don't own (jordan's)"],
    ["kai", 167.5, "flights were $140 last week. round trip. I checked for you because I'm a good friend and a bad influence"],
    ["maya", 160, "$140 is like... 4 weeks of groceries"],
    ["kai", 159, "it's also 2 nights on my couch, free hot chicken (I'm paying), and leah crying on stage. and shelby bottoms run if you stay the weekend after. think about it"],
    ["maya", 40, "I'm thinking about it. that's not a yes. but I checked flights twice today"],
    ["kai", 39, "twice is basically a yes. dolly has been informed"],
  ]),
  build("c_maya_nadia", ["maya", "nadia"], [
    ["nadia", 290, "I'm in the library and a man is eating soup. loudly. this is my life now"],
    ["maya", 289, "a SOUP. in the LIBRARY. report him"],
    ["nadia", 288.5, "I'm too tired to report. exams this month and I've been in regenstein so long I know which chairs squeak"],
    ["maya", 288, "do you want me to send you a care package or do you want me to leave you alone"],
    ["nadia", 287, "care package. the hot cheetos we used to get at the corner store. and a nap"],
    ["nadia", 96, `ok exams are over the ${weekendLabel(2)} weekend-ish. come after, we'll do the lakefront. arjun's birthday is ${weekendLabel(3)}, two birds`],
    ["maya", 94, "the lakefront in december nadia. you want me to walk the lakefront in DECEMBER"],
    ["nadia", 93.5, "with hot chocolate. from the good place. and then second city with arjun and deep dish. and my couch has a new blanket. 3 years of roommates means you don't get to say no"],
  ]),
  build("c_sofia_maya", ["sofia", "maya"], [
    ["sofia", 200, "booked nashville!!! $140 round trip. I'm singing harmonies on leah's new one at the 5 spot"],
    ["maya", 199, "SOFIA. that's huge. the one she sent you the demo of?"],
    ["sofia", 198.8, "the one I cried in the whataburger parking lot to. yes. come with me please. kai has a couch, I'm at leah's"],
    ["maya", 196, "I want to so bad. money is just really tight rn. rent went up $75 and I'm still paying off the pottery wheel"],
    ["sofia", 195, "ok what if you don't fly. what if someone's driving"],
    ["maya", 194.5, "it's 13 hours sofia"],
    ["sofia", 72, "ok just checked, southwest has it for $150 still. if you book this week I'll buy the hot chicken AND the merch. this is a bribe"],
    ["maya", 70, "I'm going to look at my budget tonight. that's all I'm promising. don't tell kai"],
  ]),
  build("c_devon_elijah", ["devon", "elijah"], [
    ["elijah", 240, "three cardiac arrests tonight. two came back. how's your ER"],
    ["devon", 230, "quiet. said the word quiet. it's over now"],
    ["elijah", 229, "lmao you did this to yourself. anyway when are you coming to new orleans. you keep saying it"],
    ["devon", 228, "sometime this winter for real. not sam's show weekend, I'm on. maybe january? I have 4 days off in a row the second week"],
    ["elijah", 227.5, "january works. I'll take you on the bayou, we'll eat too much, you'll sleep in my spare room and complain about the humidity"],
    ["devon", 227, "it's winter there's no humidity", { type: "image", ref: photo("devon-schedule-screenshot", 800, 600) }],
  ]),
  build("c_plano_east", ["maya", "cole", "harper", "kenji", "tess", "bri"], [
    ["cole", 180, "ok hear me out. plano east reunion weekend. not the official one with the gym and the name tags. just us. one weekend this winter. who's in"],
    ["harper", 179, `me obviously. not ${weekendLabel(4)} though, I'm running the vintage market in deep ellum. unless that IS the weekend and y'all just come to dallas`],
    ["bri", 178, `I'm in atlanta so it's a flight for me regardless. ${weekendLabel(6)} is the beltline run, andre will murder me if I miss it. anything else is open`],
    ["tess", 177, `I'm on nights the ${weekendLabel(1)} and ${weekendLabel(2)} weekends. ${weekendLabel(3)} I'm off and already in nashville for leah's thing. so like, come to nashville??`],
    ["kenji", 176, `or. hear ME out. marfa. ${weekendLabel(5)}. new moon. june's casita. the subaru fits 4 and lucas already has one seat but I'll bump him for plano east`],
    ["maya", 175, "kenji you can't bump lucas"],
    ["kenji", 174.5, "I can and I would. for the homeland"],
    ["cole", 174, `I'm busy ${weekendLabel(5)} unfortunately (sister's wedding thing). but if y'all do dallas ${weekendLabel(4)} my spare room's open and I'll cook. queen bed, 2 people, 3 if someone takes the couch`],
    ["harper", 173, "so dallas it is?? everyone comes to the market, I give you the friends discount, cole feeds us, we go to the bishop arts bars after"],
    ["bri", 172, "flight ATL→DAL that weekend is $110. ok. ok fine. I'm looking"],
    ["tess", 171, "I'll see if I can swap. nashville → dallas is 10 hours, I'd fly. 180k mile car is not making that drive"],
    ["maya", 48, "ok I've been quiet because I have no money but I'm there for dallas if someone has a seat. owen and ravi are both driving from austin apparently"],
  ], { name: "plano east besties 🏈", emoji: "🏈" }),
  build("c_maya_wes", ["maya", "wes"], [
    ["maya", 130, `wes!! open house ${weekendLabel(7)}?? I saw the group post. is there any chance your studio fits one more sleeping body`],
    ["wes", 128, "maya. my studio IS my apartment. it is one room. there is a bed and a desk and the desk is also the kitchen table"],
    ["maya", 127.5, "so that's a no on the floor"],
    ["wes", 127, "that's a no on the floor. BUT ava has a couch uptown and I will show you around nyc until your feet fall off. dumplings in flushing, the whitney, that pizza place, the whole thing"],
    ["maya", 126, "the thing you can't post. I need to see the thing you can't post"],
    ["wes", 125, "then get on a plane. $160 on jetblue last time I looked. I'll even carry your bag on the L"],
  ]),
];

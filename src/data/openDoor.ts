// Open Door policies, in each person's own words. The host-side agents interpret these; nothing here is a tag.
// Variety is deliberate: tiers differ, conditions differ, some people offer a ride or a tour but no couch, and a
// few policies contain the kind of nuance a tag system cannot hold ("not during finals", "one person max",
// "would love a guest who cooks", "ask early", "Friday is better than Saturday").
import type { OpenDoor } from "@/types";

const od = (policy: string, tier: OpenDoor["tier"], offers: OpenDoor["offers"], maxGuests = 1, on = true): OpenDoor => ({ on, policy, tier, offers, maxGuests });

export const openDoorPolicies: Record<string, OpenDoor> = {
  // ---------- Austin core ----------
  maya: od("couch in mueller for friends passing through austin. one person, two nights, i'm out most evenings so you'd have the place. no smokers.", "friends", ["couch", "show-around"]),
  devon: od("futon's free for friends and friends of friends. i work nights in the ER so you'll barely see me and you need to be quiet before 2pm. nurses always welcome.", "fof", ["couch"]),
  ethan: od("guest room in mueller, open to friends and anyone they vouch for. board games are mandatory on at least one night. two people fine if you're a couple or don't mind sharing a queen.", "fof", ["couch", "ride", "show-around"], 2),
  tyler: od("couch in round rock for friends. if it's warm we're doing a lake day, that's the deal. not the first weekend of december, my parents are in town.", "friends", ["couch", "ride"]),
  kenji: od("no couch (roommates) but the subaru fits 4 and i'm always driving west. gas split, i pick the music.", "fof", ["ride"], 3),
  yara: od("can't host, can drive. corolla, three seats, i leave early and don't stop much. friends and their friends.", "fof", ["ride"], 3),
  owen: od("truck seats 5, i drive to dallas every other weekend for family and i'll take anyone ethan knows. i'm not hosting, i live with my brother.", "fof", ["ride"], 4),
  // ---------- Nashville ----------
  kai: od("couch and a genuinely good air mattress for UT people and whoever they bring. two nights max, i have a cat named dolly so allergic people beware. you'll get dragged to a songwriter night.", "fof", ["couch", "show-around"], 2),
  tess: od("i can't host (tiny place, weird hours) but i'll drive you around nashville in the 180k mile car and i'm a yes for airport pickups from plano east people.", "friends", ["ride", "show-around"]),
  ruben: od("futon in the living room for jordan's friends and the suerte crowd. i work nights so you have the place to yourself, just don't touch the knives. one person.", "fof", ["couch"]),
  marisol: od("real guest room, three nights fine, open to friends and friends of friends. our dog biscuit will sleep on you. not the first weekend of december, we're at a wedding in birmingham.", "fof", ["couch", "show-around"], 2),
  // ---------- Atlanta ----------
  andre: od("pull-out couch in O4W, two minutes to the beltline, friends only please. weekends only, i travel for work midweek. runners get a guided beltline loop.", "friends", ["couch", "show-around"]),
  simone: od("spare room when my roommate travels, which is often, but you have to ask at least two weeks out. friends and aisha's people. one person, no overnight guests of guests, i keep my place small on purpose.", "fof", ["couch"]),
  kwame: od("no couch but i've got a car and i'll show marcus's lifting friends around atlanta. gym first, food after.", "fof", ["ride", "show-around"]),
  // ---------- Denver ----------
  noah: od("guest room in cap hill for friends and former coworkers. not on ski weekends, which is most of december, check with me. roommate's dog juniper is friendly and will be on the bed.", "fof", ["couch", "ride"], 2),
  ivy: od("you're family or you're maya's friend, either way the couch is yours. bring running shoes, we leave at 7. one person, i have one couch.", "fof", ["couch", "ride", "show-around"]),
  mateo: od("i don't host but if you ride bikes i'll loan you one and drive you to boulder trailheads. omar's cycling friends get priority.", "fof", ["ride", "show-around"]),
  jules: od("futon in rino for friends of ethan basically. two nights, walk to the climbing gym, i'll get you a guest pass. no one who's weird about pronouns.", "fof", ["couch", "show-around"]),
  // ---------- Chicago ----------
  arjun: od("couch in wicker park, blue line right there. friends and hackathon people. i'm allergic to cats so if you've got cat hair on everything, no. two nights.", "fof", ["couch"]),
  nadia: od("futon in hyde park for close friends only. i'm in the library most of the day so you get the apartment. NOT during exams (dec 7–18). guests who cook are my favorite guests.", "friends", ["couch"]),
  mei: od("air mattress in my pilsen studio. you will get drawn, that's the price. anime club and zoe's friends. one person, two nights, weekends.", "fof", ["couch", "show-around"]),
  // ---------- New Orleans ----------
  beau: od("shotgun house in the bywater, spare room, porch. run club people and anyone they vouch for. bring a bike or borrow mine. two people ok. not second line sundays, i'm marching.", "fof", ["couch", "ride", "show-around"], 2),
  camille: od("bar industry hours, so i can't promise a couch, but i can get you on lists and show you the real places. sam's friends.", "fof", ["show-around"]),
  elijah: od("couch in mid-city near the streetcar, friends and devon's nurse friends. i work nights so it's quiet during the day; i'm asleep until 3pm, plan around it. one person.", "fof", ["couch"]),
  // ---------- Los Angeles ----------
  dani: od("couch in ktown for my sister's friends. small place, big heart. three nights ok. i'll feed you.", "fof", ["couch", "show-around"]),
  theo: od("air mattress in silver lake when i'm not on set, which is unpredictable, so ask the week of. UT friends. one person. early mornings, i leave at 6.", "friends", ["couch", "ride"]),
  rosa: od("no room but i'll take you shooting film in east LA and drive you to the beach. lucas's photo friends.", "fof", ["ride", "show-around"]),
  // ---------- New York ----------
  wes: od("my studio IS my apartment, so no, but i will walk you around new york until your feet fall off. dumplings, museums, the whole thing. anyone i know.", "fof", ["show-around"]),
  ava: od("pull-out couch uptown, two nights, weekends only, my partner says hi. grace's people and theirs. one person, we're in a one-bedroom.", "fof", ["couch"]),
  // ---------- Dallas ----------
  cole: od("spare bedroom in lower greenville with a queen bed, plano east people and their friends. two people, three if someone takes the couch. i cook. any weekend i'm not at the lake or at my sister's wedding stuff in december.", "fof", ["couch", "ride", "show-around"], 3),
  harper: od("no spare room but the vintage market weekends i'll walk you through deep ellum and get you the friends discount. friends and their friends.", "fof", ["show-around"]),
  diego: od("couch in oak cliff, dinner included, for jordan's cousins' friends basically anyone jordan sends. one person. not thanksgiving week.", "fof", ["couch", "ride"]),
  // ---------- Houston ----------
  raj: od("guest room in montrose, always. friends, friends of friends, you name it. i have a ridiculous number of towels. two people fine. rodeo weekends in march i'm booked.", "network", ["couch", "ride", "show-around"], 2),
  tj: od("couch and my grill for raj's fantasy league and friends. one person. rodeo weekends i'm booked.", "fof", ["couch"]),
  maddie: od("i've got a car and i know every taco place in houston. aisha's people. no couch, roommate situation.", "fof", ["ride", "show-around"]),
  // ---------- San Antonio / Marfa ----------
  gabe: od("spare room in southtown, abuela lives downstairs and will cook whether you want it or not. UT design people and friends. two people. not the weekend before christmas.", "fof", ["couch", "ride", "show-around"], 2),
  june: od("casita behind the house, stars for free. anyone from the pottery studio or their friends. bring water and a jacket. two people. any weekend except chinati weekend in october.", "fof", ["couch"], 2),
  silas: od("i'll drive you to the lights and the prada store but there's no bed, june has the beds.", "fof", ["ride", "show-around"]),
};

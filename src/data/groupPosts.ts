import type { Post } from "@/types";
import { P } from "./builders";
import { photo } from "./helpers";

// Long, lived-in group histories. Newest posts have the smallest `when` (days ago).

const apartments: Post[] = [
  P("priya", 0.3, "ok update for everyone who's been following my saga: I signed. 2b/2b in Riverside, $1,450 each with my roommate, move in Dec 1. Thank you to literally everyone in this group who told me to avoid that 'luxury' place on Oltorf. Celebratory boba on me at the next meetup", {
    group: "g_apartments", likes: 38, love: 11, care: 4, images: [photo("riverside-apt", 800, 600)],
    comments: [
      ["aisha", "PRIYAAA 🎉 the saga is over. was the scam listing the one with the AI-looking kitchen photos?"],
      ["priya", "yes lmao the countertops had no seams and the window looked out onto nothing", [["aisha", "I knew it. ok dec 1 I'm helping you move, I have my cousin's truck"]]],
      ["ethan", "congrats! riverside is lowkey the move now. what complex?"],
      ["zoe", "boba?? 👀 I'm a member of this group technically"],
      ["hannah", "so happy for you. also $1,450 in riverside is good for a 2/2 rn, you did well"],
    ],
  }),
  P("tyler", 1, "⚠️ SCAM WARNING: someone is reposting real listings from Zillow in this group with a different phone number and asking for a $500 'holding deposit' via Zelle before a tour. Three people have DM'd me about it this week. Never pay before you've physically been inside the unit. Report posts with ⚠️ so Aisha or I see them.", {
    group: "g_apartments", likes: 64, care: 9, wow: 5, shares: 12,
    comments: [
      ["grace", "this almost got me in September 🙃 the 'landlord' said he was deployed overseas and couldn't do tours"],
      ["omar", "the deployed overseas one is a classic. Also 'my pastor has the keys'"],
      ["aisha", "pinning this. thank you ty"],
      ["lucas", "in france this would be illegal. here too I think? anyway thanks"],
    ],
  }),
  P("zoe", 2, "looking for a sublet jan–may (spring semester) near campus, budget $900 max, I have a cat (she's quiet and perfect). I'm clean and I'm in class or at work most of the day. West campus or north campus ideally but I'll take hyde park. pls 🙏", {
    group: "g_apartments", likes: 9,
    comments: [
      ["priya", "my friend Kavya is going abroad in the spring, her room in west campus is like $950 but she might negotiate. DMing you"],
      ["zoe", "omg yes please"],
      ["nina", "does the cat get along with plants? asking for a reason"],
    ],
  }),
  P("aisha", 4, "Roommate wanted!! Me + Nina have a 3b/2b house in Cherrywood, third room opening Jan 1. $825 + ~$60 utilities. Big backyard, washer/dryer, two bikes you can borrow, approximately 50 plants (Nina's). We're both in healthcare/grad school so we're quiet on weeknights and loud on exactly one weekend a month. Looking for a girl or nonbinary person 22-27, no smoking inside.", {
    group: "g_apartments", likes: 27, love: 6, images: [photo("cherrywood-house", 800, 600), photo("cherrywood-backyard", 800, 600)],
    comments: [
      ["grace", "the backyard 😭 my lease is up in feb though"],
      ["aisha", "we could maybe do feb 1 if the right person, DM me!"],
      ["hannah", "sharing this with my coworker Em, she's looking"],
      ["maya", "cherrywood is so nice. also 50 plants is undercounting"],
      ["nina", "it is 61 as of this morning"],
    ],
  }),
  P("ethan", 6, "Hot take but moving out of downtown was the best decision I made this year. $2,100 for a studio with a view of a parking garage → $1,650 for a 1b in Mueller with a yard and I can hear birds. Commute went from 10 min to 18 min. Worth it.", {
    group: "g_apartments", likes: 45, haha: 2,
    comments: [
      ["omar", "mueller is genuinely great if you don't mind every neighbor having a golden doodle"],
      ["tyler", "mueller rents are climbing though, lock in that renewal early. unsolicited real estate advice"],
      ["maya", "ok but the birds are a flex"],
      ["grace", "I need the yard. I need it."],
    ],
  }),
  P("hannah", 8, "First year teacher salary check: I make $58k, and after taxes + TRS I take home ~$3,500/mo. Rent is $1,200 (room in a 3/2 in North Loop). Posting because when I was looking I wished someone had just said numbers. Happy to answer questions about teaching + affording Austin.", {
    group: "g_apartments", likes: 71, love: 14, care: 3, shares: 6,
    comments: [
      ["priya", "the transparency we need. thank you"],
      ["aisha", "grad stipend is $32k so I feel this spiritually"],
      ["lucas", "barista: $19/hr + tips, rent $975 in a 4-bed in st. john's. sharing in solidarity"],
      ["marcus", "trainer here, income is wild month to month, rent $1,100 south lamar. the group chat for broke friends is growing"],
      ["grace", "thank you for this hannah fr. people are so weird about numbers"],
    ],
  }),
  P("omar", 11, "PSA for grad students: the UT Grad Student Assembly has an emergency housing fund that covers deposits up to $1,000 and almost nobody applies. Link in comments. I used it in 2023 and it saved me.", {
    group: "g_apartments", likes: 33, shares: 9,
    comments: [
      ["omar", "gsa.utexas.edu/housing-fund (it's a google form, takes 10 min)"],
      ["aisha", "WHAT. applying tonight"],
      ["priya", "undergrad equivalent anyone? 👀"],
      ["omar", "Student Emergency Services does something similar, ask them"],
    ],
  }),
  P("grace", 14, "Is $1,900 for a 1b at the new place on E 6th insane or is that just what it is now? It has a gym and a pool but the walls feel thin. First place I've toured that didn't smell like weed in the hallway", {
    group: "g_apartments", likes: 12,
    comments: [
      ["tyler", "that's about market for new build east side. ask for 6-8 weeks free, they almost always have concessions in winter"],
      ["grace", "wait they'd do that?? ok asking"],
      ["tyler", "they'll say no to 8 and give you 4-6. also ask for the admin fee waived"],
      ["ethan", "tyler single handedly saving this group thousands"],
      ["hannah", "thin walls would be a dealbreaker for me, I grade papers at 9pm and need silence"],
    ],
  }),
  P("lucas", 18, "my roommate's boyfriend has basically moved in. he's here 6 nights a week, uses my oat milk, and doesn't pay anything. how do I bring this up without it being a whole thing", {
    group: "g_apartments", likes: 24, haha: 8, care: 5,
    comments: [
      ["aisha", "it's already a whole thing, he just doesn't know yet. ask for a third of utilities, it's reasonable"],
      ["nina", "the oat milk is the real crime"],
      ["maya", "'hey, since X is here most of the time, can we split utilities 3 ways?' that's it. you don't have to over explain"],
      ["sam", "I'd just start drinking his beer"],
      ["lucas", "update: I asked, it went fine, he now pays $60/mo and bought me a 4 pack of oatly. society functions"],
    ],
  }),
  P("nina", 22, "Does anyone know a good moving company that's not $800 for 2 hours? Moving from Hyde Park to Cherrywood (10 min drive) end of the month, mostly plants and one very heavy dresser", {
    group: "g_apartments", likes: 7,
    comments: [
      ["devon", "I have a truck and I'm off sundays. tacos as payment"],
      ["nina", "devon you're the best 😭 jordan can make the tacos"],
      ["jordan", "I didn't agree to this"],
      ["tyler", "Einstein Moving is like $140/hr for 2 guys if you want a real company"],
    ],
  }),
  P("priya", 26, "Apartment hunt day 19. Toured 4 places today. One had a 'bedroom' that was a closet with a window decal. One wanted 3x rent in income (I'm a student??). One was great and already leased by the time I got to my car. I'm so tired", {
    group: "g_apartments", likes: 29, care: 12, haha: 6,
    comments: [
      ["maya", "the window decal is sending me. keep going, it's rough right now but it will click"],
      ["hannah", "the 3x income thing: ask if they take a cosigner or 2 months prepaid, some will"],
      ["aisha", "come over tonight I'll make jollof and we'll spreadsheet it"],
      ["priya", "a spreadsheet would help actually. omw after class"],
    ],
  }),
  P("tyler", 31, "Monthly reminder: when you renew, your landlord's first offer is not the number. Email back and say you've seen comparable units for X and ask them to match. Worst case they say no. I've watched this save friends $50-150/mo", {
    group: "g_apartments", likes: 52, shares: 7,
    comments: [
      ["ethan", "tried this last year, got $75 off. can confirm"],
      ["grace", "saving this for february"],
    ],
  }),
  P("maya", 36, "anyone else's complex 'upgrading' to a package locker system that charges you $4/mo for the privilege of getting your mail? bring back the mailroom guy, Gerald was a legend", {
    group: "g_apartments", likes: 19, haha: 11,
    comments: [
      ["omar", "justice for gerald"],
      ["hannah", "ours charges $25/mo for 'valet trash' that comes 3 nights a week and skips thursdays"],
      ["priya", "valet trash is the biggest scam in american housing"],
    ],
  }),
  P("aisha", 42, "For anyone moving to Austin from out of state and reading this (hi): neighborhoods in order of 'close to things' vs 'affordable' based on this group's collective suffering: East Riverside, North Loop/Hyde Park, Cherrywood, St John's, Mueller (pricier), South Lamar (pricier), Downtown (lol). Avoid anything that says 'luxury' in the name unless you want to pay $300/mo for a rooftop you use twice.", {
    group: "g_apartments", likes: 88, love: 10, shares: 21,
    comments: [
      ["lucas", "this is the post I needed in 2022"],
      ["zoe", "st johns is so underrated"],
      ["tyler", "mostly agree. I'd add Windsor Park to the middle tier"],
      ["ethan", "pinned material"],
    ],
  }),
  P("hannah", 50, "Lease signed on the North Loop spot!! 3/2 house with 2 other teachers, we're calling it the Faculty Lounge. Housewarming in a few weeks, you're all invited, bring a plant or a bottle", {
    group: "g_apartments", likes: 41, love: 8, images: [photo("north-loop-house", 800, 600)],
    comments: [
      ["nina", "I'll bring 3 plants and no bottle"],
      ["maya", "faculty lounge is such a good house name"],
      ["grace", "ok I'm coming for the name alone"],
    ],
  }),
  P("ethan", 58, "Does anyone have experience breaking a lease early? Got an offer in a different part of town and the commute would be 45 min. My lease has a 'reletting fee' of 85% of a month's rent + I'd be responsible until they find a tenant", {
    group: "g_apartments", likes: 8,
    comments: [
      ["tyler", "85% reletting is standard TAA lease. in this market they'll re-rent fast, usually 2-3 weeks. give 30 days notice in writing and help them show it"],
      ["ethan", "thank you! that's less scary than I thought"],
      ["omar", "also check if your new employer does relocation assistance, some cover lease break"],
    ],
  }),
  P("zoe", 65, "west campus rent for next fall is already $1,300 for a shared room?? a SHARED room. I'm going to live in the art building", {
    group: "g_apartments", likes: 22, haha: 9, sad: 0,
    comments: [
      ["priya", "the art building has better lighting anyway"],
      ["sofia", "riverside bus is 15 min and rent is half, I did it junior year"],
      ["zoe", "but my 8am 😭"],
    ],
  }),
  P("aisha", 80, "Welcome to the 200 new members this month! Quick reminders: post rent + neighborhood + move-in date, no brokers, flag scams with ⚠️. And be nice. We've helped like 40 people find places this year, which is cool.", {
    group: "g_apartments", likes: 35, love: 6,
    comments: [["grace", "found my current place through this group, forever grateful"], ["lucas", "same, best group on fb"]],
  }),
];

const runclub: Post[] = [
  P("maya", 0.5, "Tuesday run tonight 6:30 at the usual spot. Weather says 62 and clear so it's finally perfect out. Doing the 5 mile loop over Mopac, walk/jog group will do the 3 mile turnaround with Grace. Post-run: P. Terry's", {
    group: "g_runclub", likes: 18, love: 3,
    comments: [
      ["grace", "walk/jog group = my people. I'll be there"],
      ["omar", "coming straight from lab, might be 5 min late, start without me"],
      ["marcus", "can I do the 5 mile as a cooldown? I lifted legs this morning. this is a cry for help"],
      ["ethan", "in. P Terry's is the real reason"],
    ],
  }),
  P("omar", 3, "Austin Half registration is open and the early bird price ends Friday ($95 → $120). Who's in? I'm putting together a training plan for a 12-week block starting next Monday, will post it in the group. Thinking we do Saturday long runs together as the group run.", {
    group: "g_runclub", likes: 26, love: 4, shares: 3,
    comments: [
      ["maya", "IN. going for sub 1:50 this time"],
      ["aisha", "I've never run more than 6 miles but I'm signing up before I think about it"],
      ["hannah", "registered 🫡 first half ever"],
      ["lucas", "ok ok fine. I will do it for the finisher's taco"],
      ["devon", "if my schedule lets me. nights are brutal rn"],
      ["grace", "I'll do the 5K that same weekend and cheer for everyone!!"],
    ],
  }),
  P("marcus", 5, "PSA from your friendly neighborhood trainer: if your shins hurt every run, it's not 'just how running feels'. 80% of the time it's that you ramped mileage too fast or your shoes are 500 miles old. Add 10%/week max. That's the whole secret. ok bye", {
    group: "g_runclub", likes: 31, love: 5,
    comments: [
      ["grace", "my shoes are from 2021 so this is targeted"],
      ["marcus", "grace. GRACE."],
      ["hannah", "noted, bought new shoes today. $140 I did not have"],
    ],
  }),
  P("aisha", 8, "RAN 6 MILES WITHOUT STOPPING. Three months ago I couldn't run a mile. Shoutout to this group for not making me feel slow at my first Tuesday run. Crying a little", {
    group: "g_runclub", likes: 54, love: 22, care: 4, images: [photo("run-selfie-trail", 800, 800)],
    comments: [
      ["maya", "AISHA!!!! so proud of you"],
      ["omar", "this is what the group is for. incredible"],
      ["ethan", "6 miles is real distance, congrats"],
      ["grace", "you're my inspiration fr"],
      ["devon", "let's gooo"],
    ],
  }),
  P("ethan", 12, "Shoe review since people asked: Hoka Clifton 9 for easy days, Saucony Endorphin Speed 4 for tempo. Returned the Vaporflys because I'm not fast enough to justify $250 and my ego is fine. Anyone have thoughts on the new Novablast?", {
    group: "g_runclub", likes: 14,
    comments: [
      ["omar", "novablast 4 is my daily now, super bouncy, slightly wide fit"],
      ["lucas", "I run in whatever is on sale at Fleet Feet. no notes"],
      ["marcus", "the ego line got me"],
    ],
  }),
  P("maya", 16, "Saturday long run recap: 9 miles, 8 people, 1 near-miss with a scooter, 2 dogs petted, 0 people dropped. Mozart's after. Omar's new watch told us the humidity was 94% which felt accurate", {
    group: "g_runclub", likes: 29, love: 6, images: [photo("group-run-mozarts", 800, 600), photo("town-lake-sunrise", 800, 600)],
    comments: [
      ["omar", "the watch does not lie"],
      ["hannah", "I was the one who petted both dogs. no regrets"],
      ["grace", "next week I'm coming for the Mozart's part only"],
    ],
  }),
  P("devon", 21, "Night shift problem: by the time Tuesday 6:30 comes around I've been awake for 20 hours or asleep for 2. Anyone want to do an occasional 7am run on my off days? I'm usually off Sun/Mon/Thu", {
    group: "g_runclub", likes: 11,
    comments: [
      ["omar", "I'm down for Thursdays 7am, I ride before lab anyway"],
      ["lucas", "I open at 6 so no but respect"],
      ["maya", "Mondays could work!"],
    ],
  }),
  P("hannah", 27, "Does anyone else get anxious about running on the trail alone after dark? I love the Tuesday group but if I run solo it's always a treadmill. How do y'all handle it", {
    group: "g_runclub", likes: 17, care: 9,
    comments: [
      ["maya", "totally normal and valid. I stick to the lit section between 1st and Congress, and share my location with Priya"],
      ["aisha", "there's a women's running group that does Thursday 7pm from Austin Beerworks, lmk if you want to go together"],
      ["grace", "I run with one earbud and Strava beacon on. also want to do the Thursday one"],
      ["hannah", "Thursday sounds great, thank you both 🤍"],
    ],
  }),
  P("lucas", 34, "I made the mistake of running Tuesday after a double espresso and a croissant. I'm sharing this so you don't", {
    group: "g_runclub", likes: 21, haha: 15,
    comments: [["marcus", "a croissant is basically a gel"], ["omar", "it is not"]],
  }),
  P("omar", 40, "Garmin says my VO2 max went up 3 points this month. Not sure it means anything but I'm choosing to believe it. Tempo Tuesdays are working", {
    group: "g_runclub", likes: 16,
    comments: [["ethan", "it means something. nice"], ["maya", "post the training log!"]],
  }),
  P("grace", 48, "Hi! New here. I don't 'run' exactly, more like a brisk jog with feelings, but Maya said it's ok. See you Tuesday?", {
    group: "g_runclub", likes: 33, love: 9, care: 2,
    comments: [
      ["maya", "WELCOME. brisk jog with feelings is the official pace of the walk/jog group"],
      ["aisha", "that's how I started 3 months ago!!"],
      ["lucas", "bienvenue, we are not fast here"],
    ],
  }),
  P("maya", 60, "Cap10K recap! Group PRs: Omar 42:10, me 48:55 (!!!), Ethan 51:30, Marcus 'didn't look at the time'. Hannah ran her first race ever and Grace cheered so loud security asked her to step back. Love this club", {
    group: "g_runclub", likes: 47, love: 14, images: [photo("cap10k-finish", 800, 600), photo("cap10k-group", 800, 600)],
    comments: [
      ["omar", "42:10 was pain. worth it"],
      ["hannah", "I cried at mile 5 and then again at the finish"],
      ["grace", "I was not asked to step back. I was asked to 'maybe move over a little'"],
      ["marcus", "I ran it for the vibes"],
    ],
  }),
  P("ethan", 75, "Anyone want to split a Lululemon run belt? jk but actually, what do y'all use to carry your phone. Shorts pockets are failing me", {
    group: "g_runclub", likes: 9,
    comments: [["maya", "Flipbelt. I've had mine 3 years"], ["omar", "Naked band if you want to spend too much"], ["devon", "I just hold it like a caveman"]],
  }),
  P("omar", 95, "Group is officially 150 members. When Maya and I started this it was 4 people and a very confused Lucas. Thanks for showing up every Tuesday, rain or 105°", {
    group: "g_runclub", likes: 61, love: 18,
    comments: [["lucas", "I'm still confused"], ["maya", "4 people and we still went to P. Terry's after. some things don't change"]],
  }),
];

const cheapeats: Post[] = [
  P("jordan", 0.2, "ok y'all I've been quiet in here for a reason: the taco pop-up is happening. Saturday 11am-sellout at Hotel Vegas back patio (thanks Sam). Menu: birria ($4), al pastor ($3.50), a mushroom tinga one for the vegetarians ($3.50), aguas frescas $3. Everything under $15 if you order like a normal person. Come eat my food before I have to charge truck prices", {
    group: "g_cheapeats", likes: 72, love: 31, wow: 4, shares: 18, images: [photo("birria-tacos", 800, 800), photo("taco-menu-chalkboard", 800, 600)],
    comments: [
      ["maya", "JORDAN!!!!! finally. I'm bringing everyone"],
      ["sam", "patio is yours, I'm working the bar so come early before I eat all the birria"],
      ["devon", "will be there with the entire volleyball group"],
      ["priya", "mushroom tinga 👀 ok I'm sold"],
      ["lucas", "I'll bring the coffee. cold brew, free, for the line"],
      ["hannah", "this is the best post this group has ever had"],
      ["zoe", "SO proud. can I take photos for the group page"],
      ["nina", "can I get like 6"],
    ],
  }),
  P("lucas", 2, "Underrated: the $7 breakfast taco + drip coffee combo at Fleet before 9am. I'm biased (I make them) but the migas one is genuinely good and nobody orders it", {
    group: "g_cheapeats", likes: 24, haha: 3,
    comments: [["maya", "the self promo is allowed because the migas are in fact good"], ["jordan", "I'll allow it. once."], ["grace", "ok getting this tomorrow"]],
  }),
  P("priya", 4, "Found: $9 lunch special at Pho Thaison on Guadalupe, 11-3 weekdays, large pho + spring roll. Students get free tea if you ask nice. This is the deal of the semester", {
    group: "g_cheapeats", likes: 41, love: 5, images: [photo("pho-bowl", 800, 600)],
    comments: [["zoe", "I've been going here for 2 years and never knew about the tea"], ["devon", "that's a lot of pho for $9"], ["ethan", "adding to the map"]],
  }),
  P("hannah", 6, "Teacher budget edition: $4.50 HEB sushi is not 'good' but it's not bad either and sometimes that's enough. Would eat again (I will, on friday, because it's friday)", {
    group: "g_cheapeats", likes: 33, haha: 14,
    comments: [["sam", "the HEB sushi tier list is a conversation I'm ready to have"], ["nina", "spicy tuna roll > california roll and I'll die on this hill"], ["jordan", "as a cook I should be upset. I am not. HEB sushi is fine"]],
  }),
  P("devon", 9, "3am-after-shift tier list of 24hr spots because someone has to: 1) Kerbey Lane (the queso, $8) 2) Whataburger (honey butter chicken biscuit, $5) 3) the taco truck on Riverside by the HEB, name unknown, $2.50 tacos, no notes 4) Magnolia (RIP the old one)", {
    group: "g_cheapeats", likes: 38, love: 7, haha: 4,
    comments: [["jordan", "the riverside truck is 'Tacos El Charly', the guy is named Ramón, tip him"], ["devon", "RAMÓN. legend."], ["marcus", "honey butter chicken biscuit at 3am is the closest I've been to god"], ["sofia", "kerbey queso after a show is a ritual"]],
  }),
  P("zoe", 12, "Bubble tea price audit because I'm upset: Gong Cha $6.50, TP Tea $6.25, Tapioca House $5.50 but it's a trek, the new place on Guad $7.25 (!!). Teapioca Lounge still $5 for a regular and the brown sugar one slaps. support Teapioca", {
    group: "g_cheapeats", likes: 29, haha: 3, images: [photo("boba-lineup", 800, 600)],
    comments: [["priya", "the audit we needed"], ["grace", "$7.25 is a crime"], ["ethan", "Tapioca House is worth the trek fight me"]],
  }),
  P("jordan", 15, "Cooked for 6 for $22 last night. Chicken thighs (on sale at Fiesta $1.29/lb), rice, charred corn, a big salsa. Posting because 'cheap eats' also means cooking and I'm gonna start posting grocery hauls from Fiesta on Airport if y'all want", {
    group: "g_cheapeats", likes: 48, love: 11, images: [photo("chicken-thighs-rice", 800, 600), photo("fiesta-haul", 800, 600)],
    comments: [["hannah", "YES please. teaching me to cook on a budget is a public service"], ["maya", "I ate this and it was better than most $18 plates downtown"], ["nina", "fiesta produce is so slept on"], ["tyler", "recipe for the salsa or it didn't happen"], ["jordan", "the salsa is a family secret. jk it's 4 roma tomatoes 2 serranos half an onion garlic salt lime blended with a little oil"]],
  }),
  P("tyler", 19, "Hot take: Torchy's is $14 for two tacos now and it's not under $15 anymore and I move it be banned from this group alongside franklin", {
    group: "g_cheapeats", likes: 56, haha: 22, wow: 3,
    comments: [["jordan", "motion passes. torchy's is banned"], ["sam", "the trailer park tacos used to be $3.50 I'm so old"], ["lucas", "what is torchy's"], ["devon", "lucas how have you lived here 3 years"]],
  }),
  P("sofia", 23, "Jo's on South Congress is $5 for an iced turbo and you can sit outside all day pretending to write songs. I work there so this is biased but the mural is free", {
    group: "g_cheapeats", likes: 21,
    comments: [["lucas", "turbo is good. not fleet good. but good"], ["sofia", "lucas we're going to fight"], ["grace", "the mural is a tourist trap and I love it"]],
  }),
  P("ethan", 28, "Made the group a Google map. 84 pins so far, color coded by price. Link in comments. If you've posted a spot it's probably on there, tell me if I missed one", {
    group: "g_cheapeats", likes: 67, love: 19, shares: 14,
    comments: [["jordan", "ethan you're getting a free taco for life"], ["priya", "the engineer brain. thank you"], ["maya", "pinning this"], ["zoe", "add Teapioca!!"], ["ethan", "added"]],
  }),
  P("nina", 35, "Night shift snack haul from HEB for under $10: the cheese + salami packs ($3), cuties ($4 bag), a dark chocolate bar ($2). This is what keeps the ICU running", {
    group: "g_cheapeats", likes: 18, images: [photo("snack-haul", 800, 600)],
    comments: [["devon", "the cheese packs are elite"], ["aisha", "add the yogurt tubes and that's my whole shift"]],
  }),
  P("sam", 42, "Hotel Vegas does $3 Lone Stars and $2 tacos from the truck out back on Tuesdays. Not food exactly but it's calories. Also Porch Lights is playing this friday (@sofia)", {
    group: "g_cheapeats", likes: 26, love: 4,
    comments: [["sofia", "SAM 🫶 yes come to the show"], ["jordan", "the truck out back is where I learned al pastor isn't easy"]],
  }),
  P("maya", 50, "Pottery class ran late so I did the $6 banh mi at Baguette House on Burnet for dinner and honestly it's better than 3 of the 'elevated' sandwich places near my office. the pickled daikon ratio is perfect", {
    group: "g_cheapeats", likes: 31, images: [photo("banh-mi", 800, 600)],
    comments: [["lucas", "baguette house is where I go when I miss home. the bread is correct"], ["priya", "the #2 with the pâté changed me"]],
  }),
  P("jordan", 70, "Group is at 1,200 members. Reminder of the one rule: under $15 after tax. I've been removing posts about $19 'bowls'. Love y'all", {
    group: "g_cheapeats", likes: 44, haha: 6,
    comments: [["tyler", "the $19 bowl industrial complex"], ["hannah", "protect this group at all costs"]],
  }),
];

const thrift: Post[] = [
  P("zoe", 0.8, "FLIP OF THE MONTH: $4 Goodwill bins → cropped it, added the patches, sold on Depop for $48. Materials were like $6. The math is mathing. Tutorial Sunday at the meetup if people want", {
    group: "g_thrift", likes: 42, love: 12, wow: 5, images: [photo("denim-jacket-before", 800, 800), photo("denim-jacket-after", 800, 800)],
    comments: [["sofia", "teach me 😭 I have 3 jackets that need this"], ["grace", "the patches are so good"], ["sam", "ok I need you to do my denim vest"], ["maya", "that after photo is a whole brand"]],
  }),
  P("sofia", 3, "found a Pendleton wool shirt at the Salvation Army on Lamar for $9. the tag says 1980s. I will be buried in it", {
    group: "g_thrift", likes: 27, love: 6, images: [photo("pendleton-shirt", 800, 800)],
    comments: [["zoe", "9 DOLLARS?? that's a $90 shirt"], ["lucas", "this is the most austin outfit you've ever worn"]],
  }),
  P("hannah", 7, "Can anyone fix a zipper? My favorite jacket's zipper split and the tailor on Burnet wants $35. Will trade crocheted beanie", {
    group: "g_thrift", likes: 8,
    comments: [["zoe", "bring it sunday, zippers are 10 min, keep the beanie (actually no I want the beanie)"], ["nina", "the beanie economy in this group"]],
  }),
  P("grace", 11, "Is this worth anything? Found in my grandma's closet. Coach, leather, maybe 90s? The hardware is heavy", {
    group: "g_thrift", likes: 15, images: [photo("vintage-coach-bag", 800, 800)],
    comments: [["zoe", "YES. check the creed patch inside for a serial, if it's 'Made in United States' it's $80-150 on depop easy"], ["grace", "it says made in united states!!!"], ["sam", "do NOT sell it keep it"], ["grace", "keeping it"]],
  }),
  P("zoe", 15, "Sewing machine lending library update: we have 3 machines now (thanks Nina's mom). Borrow for a week, return clean, DM me. Also someone returned one with a bobbin full of glitter thread, I have questions", {
    group: "g_thrift", likes: 21, haha: 9,
    comments: [["sam", "the glitter thread was for a stage outfit and I regret nothing"], ["zoe", "I KNEW IT"]],
  }),
  P("maya", 20, "Thrifted my entire 'business casual' work wardrobe for under $100 over 3 months. Posting the breakdown because when I started my job I almost spent $600 at Aritzia. Blazer $12 (Goodwill), 4 tops $5-8 each (Buffalo Exchange), trousers $15 (Uptown Cheapskate), loafers $20 (Depop)", {
    group: "g_thrift", likes: 53, love: 11, shares: 8, images: [photo("thrift-workwear", 800, 800)],
    comments: [["grace", "I need this energy. starting a job next month"], ["hannah", "teacher wardrobe is 90% thrifted. welcome to the club"], ["lucas", "the loafers 👌"]],
  }),
  P("sam", 30, "Picked up a vintage bowling shirt with the name 'Earl' stitched on it. I am Earl now. Wearing it to every DJ set until further notice", {
    group: "g_thrift", likes: 34, haha: 18, images: [photo("bowling-shirt-earl", 800, 800)],
    comments: [["sofia", "EARL"], ["zoe", "Earl has aura"], ["jordan", "earl's set is gonna go hard"]],
  }),
  P("nina", 38, "Does anyone want a bag of fabric scraps? Lots of linen and cotton from my quilting phase (it lasted 3 weeks). Free, porch pickup in Cherrywood", {
    group: "g_thrift", likes: 11,
    comments: [["zoe", "yes!!! for patches"], ["hannah", "if zoe doesn't take it all I want some for a beanie liner"]],
  }),
  P("zoe", 55, "Sunday bins meetup was 11 people today!! Best find: Sofia's leather jacket ($7). Worst find: a single rollerblade. Someone bought it anyway (Sam)", {
    group: "g_thrift", likes: 29, haha: 8, images: [photo("goodwill-bins-crew", 800, 600)],
    comments: [["sam", "I'm going to find the other one. it's a journey"], ["sofia", "the jacket smells like cigarettes and destiny"]],
  }),
];

const volleyball: Post[] = [
  P("devon", 0.4, "Sunday 10am is ON. Weather 68 and sunny. I'll bring 2 balls and the net tension strap thing. We had 14 last week so bring friends but also don't bring 14 more friends", {
    group: "g_volleyball", likes: 15,
    comments: [["tyler", "bringing Grace, she's never played, be nice"], ["grace", "I have played. once. in 7th grade"], ["marcus", "I'll run warmups if people want, 5 min, not a workout I promise"], ["nina", "I'll be there after my shift, around 10:30"], ["jordan", "coming! but I have to leave by 12 to prep for the pop-up"]],
  }),
  P("tyler", 4, "Wednesday 6pm recap: Devon spiked a ball into the lake. Not near the lake. INTO the lake. We watched it float toward Barton Springs. RIP Wilson #2", {
    group: "g_volleyball", likes: 27, haha: 19, images: [photo("volleyball-sunset-court", 800, 600)],
    comments: [["devon", "the wind took it"], ["marcus", "there was no wind"], ["sam", "a moment of silence for wilson"], ["ethan", "I'll bring a new one sunday"]],
  }),
  P("marcus", 9, "For the people asking about their shoulders after Sunday: you're swinging with your arm, not your core. Come 10 min early this week and I'll show you. Free. I just can't watch Tyler do it anymore", {
    group: "g_volleyball", likes: 18, haha: 6,
    comments: [["tyler", "targeted harassment"], ["nina", "my shoulder thanks you in advance"]],
  }),
  P("nina", 14, "Can we do a sunset game this week instead of 6pm? It's getting dark earlier and the courts have no lights. Thinking 5pm Wed", {
    group: "g_volleyball", likes: 12,
    comments: [["devon", "5pm works, moving it"], ["ethan", "I can get there by 5:15"], ["sam", "I'll be late but I'll bring the speaker"]],
  }),
  P("ethan", 22, "Who's in for a 4v4 'tournament' (loosely defined) next month? Thinking Sunday the 23rd, we draft teams, loser team buys P. Terry's. Need 16 people to commit", {
    group: "g_volleyball", likes: 21, love: 3,
    comments: [["devon", "IN. I'm a captain"], ["tyler", "in. I'm also a captain. devon and I are not on the same team"], ["marcus", "in"], ["grace", "in but I'm a liability"], ["nina", "in"], ["jordan", "in if the pop-up is done by then"], ["sam", "in. DJing from the sidelines too"]],
  }),
  P("devon", 33, "Reminder that we rotate in by who's been waiting longest, not who's loudest (Tyler). Also pls call your own lines, we're adults and nobody is scouting us", {
    group: "g_volleyball", likes: 24, haha: 10,
    comments: [["tyler", "I feel attacked in this group a lot lately"], ["marcus", "it's because you're attackable"]],
  }),
  P("grace", 45, "I served a ball over the net today for the first time and six people cheered. This group is so nice it's almost suspicious", {
    group: "g_volleyball", likes: 36, love: 14, care: 3,
    comments: [["devon", "we were genuinely hyped"], ["nina", "GRACE'S SERVE"], ["tyler", "told you she'd be fine"]],
  }),
  P("devon", 70, "Started this group because I couldn't find pickup that wasn't either college kids who are too good or 40 year olds in knee braces who are also too good. We're a solid medium now. 60 members. Love it", {
    group: "g_volleyball", likes: 31, love: 8,
    comments: [["marcus", "a solid medium is all anyone can ask for"], ["sam", "put 'a solid medium' on the shirts"]],
  }),
];

const postgrad: Post[] = [
  P("grace", 0.6, "6 months into my first real job and I had my first 'I don't know what I'm doing and I'm faking it' spiral today in the bathroom at work. Is this normal. Be honest", {
    group: "g_postgrad", likes: 44, care: 26, love: 5,
    comments: [
      ["ethan", "3 years in. still happens. less often. the fact you care means you're probably doing fine"],
      ["hannah", "I cried in the supply closet on a Tuesday in September. it's normal. you're ok"],
      ["maya", "the bathroom spiral is a rite of passage. text me"],
      ["marcus", "nobody knows what they're doing. the confident ones just hide it better"],
      ["aisha", "normal!! also your brain is tired. go to bed early tonight, that's not nothing"],
      ["grace", "ok this helped a lot. thank you guys 🤍"],
    ],
  }),
  P("hannah", 2, "Win of the week thread! Mine: I set up my 403b and I only had to call my dad twice. Go.", {
    group: "g_postgrad", likes: 29, love: 6,
    comments: [
      ["priya", "got a return offer!!!! (starting after graduation, Dell, Round Rock, I'm going to be commuting but I'm EMPLOYED)"],
      ["hannah", "PRIYA!!!!"],
      ["devon", "picked up 2 extra shifts and didn't fall asleep driving home"],
      ["lucas", "got my green card interview date"],
      ["maya", "LUCAS?? huge"],
      ["tyler", "closed my first deal where I did most of the work. $600 bonus. buying a pickleball paddle"],
      ["omar", "my advisor said 'good' about a figure. it's been 4 years"],
      ["nina", "passed pharm. 2 semesters left"],
    ],
  }),
  P("ethan", 5, "Layoff rumors at work again. Third time this year. I'm fine (probably) but I started updating my resume and I hate that it's a 'normal' thing to do now. How is everyone handling job anxiety", {
    group: "g_postgrad", likes: 22, care: 15,
    comments: [
      ["priya", "the market is so weird rn. for what it's worth your github is scary good"],
      ["omar", "academia is just permanent layoff rumors so, welcome"],
      ["grace", "I keep a 'brag doc' of things I did each week so my resume isn't a panic project. helps a little"],
      ["maya", "brag doc is such a good call. also you'd get picked up in a week ethan"],
    ],
  }),
  P("maya", 9, "Making friends after college is HARD and I say this as someone who runs a run club. Most of my close friends are from UT or this group. If you're new to Austin and lonely: come to a Tuesday run, come to the volleyball thing, come to Jordan's pop-up Saturday. We're nice. That's the post", {
    group: "g_postgrad", likes: 61, love: 24, care: 6, shares: 5,
    comments: [
      ["lucas", "moved here knowing nobody in 2022. this is true. show up to things"],
      ["grace", "the run club was the first place I felt like I had friends here"],
      ["aisha", "'we're nice. that's the post' should be the group description"],
      ["marcus", "adding: the gym at 5am is weirdly friendly too"],
    ],
  }),
  P("tyler", 13, "Unpopular opinion but I love it here. Rent's bad, summer's hell, traffic is dumb, but I can be at a lake in 20 min and I have more friends than I did in college. Not everything has to be a crisis", {
    group: "g_postgrad", likes: 38, love: 9, haha: 2,
    comments: [["devon", "tyler the optimist"], ["hannah", "honestly needed this today"], ["omar", "lake in 20 min is doing a lot of lifting but agreed"]],
  }),
  P("aisha", 18, "Does anyone else's parents call every day asking when you're moving back home / getting married / going to med school instead of 'just public health'? Asking for me. It's me", {
    group: "g_postgrad", likes: 33, haha: 11, care: 8,
    comments: [["priya", "my mom sent me a matrimonial site profile 'just to look'. I'm 22"], ["omar", "4th year phd. my dad still asks when I'm getting 'a real job'"], ["nina", "nigerian parents + nursing school = 'when are you becoming a doctor'. every. call."], ["aisha", "nina we need to get coffee"]],
  }),
  P("devon", 24, "Night shift for 2 years now and I think it's slowly erasing my personality. I see my friends twice a month. I love the job. I don't love being 25 and feeling 40. Anyone made the switch to days? How'd you do it", {
    group: "g_postgrad", likes: 27, care: 19,
    comments: [["nina", "a few nurses at my unit went days after 2 years, it's usually seniority. put in for it now even if it takes 6 months"], ["marcus", "we're all here when you're off. sunday volleyball is for you"], ["maya", "the fact that you still show up to things on 2 hours sleep says a lot. we see you"], ["devon", "ok I put in the transfer request. feels weird but good"]],
  }),
  P("priya", 29, "I'm about to graduate and everyone in this group seems to have it together?? How do you know what to do when you're not a student anymore and there's no syllabus", {
    group: "g_postgrad", likes: 35, care: 12, haha: 5,
    comments: [["grace", "nobody has it together we just have more furniture"], ["ethan", "the no-syllabus thing hit me hard the first 6 months. pick one thing to get better at outside work. for me it was climbing. it gives shape to weeks"], ["hannah", "'nobody has it together we just have more furniture' please put this on a shirt"], ["omar", "I've been a student for 22 years so I'm the wrong person to ask"]],
  }),
  P("lucas", 36, "Three years in the US today. Things I still don't understand: tipping at a counter, 'how are you' not being a question, iced coffee in January. Things I love: y'all, breakfast tacos, the weird kindness of strangers here. Merci Austin", {
    group: "g_postgrad", likes: 58, love: 31, images: [photo("lucas-film-austin", 800, 600)],
    comments: [["maya", "LUCAS 🥹"], ["sofia", "iced coffee in January is a lifestyle"], ["sam", "we love you earl"], ["jordan", "tipping at a counter is a scam you're right"]],
  }),
  P("hannah", 44, "Did a budget check-in and I spent $340 on 'coffee + small treats' last month. I am a first year teacher. Launching a 'bring your own coffee' challenge if anyone wants accountability", {
    group: "g_postgrad", likes: 25, haha: 9,
    comments: [["lucas", "as a barista this hurts me but as your friend, yes"], ["grace", "in. my number was $410. don't tell anyone"], ["maya", "I'll join if pottery supplies don't count"], ["hannah", "pottery supplies don't count, treats count"]],
  }),
  P("marcus", 55, "Hit 10k followers on reels today. Quit my corporate gym job 14 months ago to train independently + make content and everyone thought I was insane. Not rich. Not close. But I like Mondays now. Keep going on the weird thing", {
    group: "g_postgrad", likes: 72, love: 28, wow: 6, images: [photo("marcus-gym-mirror", 800, 800)],
    comments: [["devon", "proud of you bro"], ["tyler", "the 'I like Mondays now' part is the whole thing"], ["zoe", "your reels are actually good too which is rare for gym content"], ["grace", "congrats!!! can I pick your brain about content stuff for work"]],
  }),
  P("grace", 68, "Welcome new members! Group's for people who graduated and stayed in Austin and are figuring it out. Post wins, post lows, no MLMs, no 'crypto opportunities'. Wednesday wins thread is weekly. DM me or Hannah to post anonymously", {
    group: "g_postgrad", likes: 30, love: 7,
    comments: [["hannah", "and be nice to each other. that's the whole rulebook"]],
  }),
];

export const groupPosts: Post[] = [...apartments, ...runclub, ...cheapeats, ...thrift, ...volleyball, ...postgrad];

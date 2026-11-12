// Travel seed: posts and reels from the wider network plus Austin friends on the road.
// Every photo is a licensed city shot from media.json; captions only describe what the
// photo notes (mediaIndex.json) say is actually visible. Visibility: anyone whose profile is
// "friends" posts friends-only; ~20% of everyone else does too.
import type { Post, Reel } from "@/types";
import { P, reactors, type PostOpts } from "./builders";
import { daysAgo } from "./helpers";
import { mediaUrl } from "./travel";

type Extra = { city: string; pic?: string; audience: "public" | "friends"; plus?: string[] };

/** A travel post: P() plus a city id, one photo, an explicit audience and optional forced likers (taste signals). */
function TP(authorId: string, days: number, text: string, x: Extra & Omit<PostOpts, "images" | "audience">): Post {
  const { city, pic, plus, ...o } = x;
  const post = P(authorId, days, text, { ...o, images: pic ? [pic] : undefined });
  if (plus) {
    const like = (post.reactions.like ??= []);
    for (const id of plus) if (id !== authorId && !like.includes(id)) like.push(id);
  }
  return { ...post, city };
}

export const travelPosts: Post[] = [
  // ---------------- Nashville ----------------
  TP("sofia", 38, "leah snuck me into a round last night. tiny room, red neon, the guy before her had hair down to his belt and a song about his truck that made me cry?? nobody talks during songs here. nobody. austin take notes\n\n$10 cover, 2 drink min, go on a tuesday", {
    city: "nashville", pic: mediaUrl("nash-bluebird"), audience: "public", love: 6, tagged: ["leah"], plus: ["maya", "sam", "lucas"],
    comments: [
      ["leah", "the truck song guy is named Dale and he's a legend. come back for the tuesday round, it's free"],
      ["maya", "ok I'm coming with you next time. the nobody-talks thing is my dream"],
      ["sam", "austin cannot take notes we are physically incapable"],
      ["kai", "you were IN TOWN and didn't text me?? Dolly is offended"],
    ],
  }),
  TP("kai", 61, "settling this once and for all. prince's. medium. this is medium. I couldn't feel my face for 20 minutes and I'd do it again. $14 with the potato salad and it comes on white bread like god intended. hattie b's is for people who like lines", {
    city: "nashville", pic: mediaUrl("nash-hotchicken"), audience: "public", haha: 4, love: 3, plus: ["maya", "jordan"],
    comments: [
      ["tess", "medium is a lie and you know it. I watched you sweat through your shirt"],
      ["andre", "hattie b's slander on main. the one near the belmont campus has no line btw"],
      ["maya", "the potato salad looks like it's doing a lot of work here. putting this on the list for when I visit"],
      ["marisol", "come to the one on nolensville next time, cash only, no tourists", [["kai", "ok THAT one is the real answer, fine"]]],
    ],
  }),
  TP("tess", 112, "took my mom to the ryman for her birthday. those are real church pews and they are not comfortable and she loved every second. we got balcony seats for like $40 and honestly the view was better than the floor. the stained glass hits different when the lights go down", {
    city: "nashville", pic: mediaUrl("nash-ryman"), audience: "public", love: 7, shares: 2,
    comments: [
      ["maya", "your mom in a pew for 3 hours is so plano east mom energy. tell her happy birthday"],
      ["kai", "balcony is the move, floor is for people who like standing behind tall men"],
    ],
  }),
  TP("ruben", 9, "day off. walked over the river on the pedestrian bridge instead of sleeping like a normal night cook. the skyline keeps growing more glass towers every month idk who's living in them. anyway the futon's free this month if anyone from austin wants to come eat my food", {
    city: "nashville", pic: mediaUrl("nash-skyline"), audience: "friends", likes: 5,
    comments: [
      ["jordan", "the futon offer is dangerous. me and sofia might actually take you up on that", [["ruben", "do it. I'll make the mole. you bring the salsa macha"]]],
    ],
  }),
  TP("marisol", 203, "estate sale find, $3. the bridge over the river before it was finished. steel truss, scaffolding, the whole thing held up by hope. the architect in me is losing it over the piers. gonna frame it next to the pottery shelf so the shelf feels bad about itself", {
    city: "nashville", pic: mediaUrl("nash-pedestrian-bridge"), audience: "public", wow: 3, love: 4, plus: ["maya", "lucas"],
    comments: [
      ["maya", "THREE DOLLARS. the scaffolding alone. also how's the wheel treating you, still collapsing bowls?", [["marisol", "collapsed 4 this week. biscuit ate one. come visit and we'll throw together"]]],
      ["kai", "I need to know what estate sale. east side? I have a poster problem"],
    ],
  }),
  TP("leah", 4, "reminder that the tuesday round at the listening room is FREE and starts at 7. you get 3 songs each and the sound guy is a saint. if you're visiting and broke this is the whole nashville experience in 90 minutes. come say hi after, I'm the one apologizing for my bridge", {
    city: "nashville", audience: "public", likes: 6, plus: ["sofia", "maya"],
    comments: [
      ["sofia", "the bridge is good. the bridge is the best part. stop"],
      ["kai", "I'll be there with the cheap beer and the crying"],
    ],
  }),

  // ---------------- Atlanta ----------------
  TP("andre", 27, "sunday beltline run turned into a sunday beltline walk turned into a sunday beltline sit. the container shops by the marketplace sign had a dog every 4 feet which is the correct amount of dogs. 6 miles if you go end to end on the eastside, totally flat, free, bring water bc the shade is a rumor", {
    city: "atlanta", pic: mediaUrl("atl-beltline"), audience: "public", likes: 8, love: 2, plus: ["maya", "ethan"],
    comments: [
      ["maya", "a dog every 4 feet is my ideal run cadence. booking a flight"],
      ["bri", "the gelato place in the containers is $6 and worth every cent"],
      ["kwame", "you said run. I see zero running in this photo"],
      ["kai", "come to nashville and I'll show you a trail with actual hills, soft boy"],
    ],
  }),
  TP("bri", 55, "the brick tower with the flag on top is the whole reason I moved to this side of town. went for a story on the food hall and spent $31 I don't have. $6 dumplings tho. go on a weekday, saturdays are unhinged", {
    city: "atlanta", pic: mediaUrl("atl-ponce"), audience: "public", likes: 5,
    comments: [
      ["andre", "which dumplings. I need specifics. this is journalism"],
      ["maya", "'writing about food I can't afford' remains the best bio on this app"],
    ],
  }),
  TP("aisha", 142, "simone did the thing where she said 'let's just walk through the park' and then produced a full picnic from her tote. the lake with the skyline in it, a pavilion, zero dollars. public health conference by day, public park by evening. she's right about everything", {
    city: "atlanta", pic: mediaUrl("atl-piedmont"), audience: "public", love: 8, tagged: ["simone"], plus: ["maya", "grace", "hannah"],
    comments: [
      ["simone", "the tote is load-bearing. come back and the spare room is yours (roommate's gone like half the time)"],
      ["hannah", "a free picnic with a skyline view is my entire love language"],
      ["grace", "okay but what was IN the tote"],
      ["nina", "simone sounds like my kind of person pls introduce"],
    ],
  }),
  TP("kwame", 88, "post-meet waffle house. 600 squat club initiation requires one (1) waffle with the butter melting exactly like this. $4.85 and the menu's still laminated. meet went fine. the waffle went better", {
    city: "atlanta", pic: mediaUrl("atl-waffle"), audience: "public", haha: 3, likes: 6,
    comments: [
      ["marcus", "the laminated menu is a feature not a bug. 600 is insane btw, coming up for the next one"],
      ["andre", "you drove past my place to get to a waffle house. there's one on my street"],
    ],
  }),
  TP("simone", 19, "roommate's in portland again so I went to the garden alone and sat on the stairs in front of the glass conservatory for an hour like a woman in a novel. membership pays for itself after two visits if you're a repeat sitter like me. spare room is open this month btw, aisha knows the drill", {
    city: "atlanta", pic: mediaUrl("atl-botanical"), audience: "friends", likes: 4,
    comments: [
      ["aisha", "woman in a novel is exactly right. also I'm telling maya about the room, she's been plotting a trip", [["simone", "tell her. early tho, I need to clear the yarn pile"]]],
    ],
  }),

  // ---------------- Denver ----------------
  TP("noah", 16, "the neon sign at union station is the most reliable thing in my life. plaza was empty at 8am which is the only time it's empty. free to wander inside, the benches in the great hall are a solid remote work spot if you buy one coffee ($5, ouch). also the guest room in cap hill is open any weekend I'm not on a mountain", {
    city: "denver", pic: mediaUrl("den-union"), audience: "public", likes: 7, plus: ["maya"],
    comments: [
      ["maya", "'any weekend I'm not on a mountain' so like never? miss you, desk neighbor"],
      ["jules", "the great hall wifi is bad and I will keep saying it"],
    ],
  }),
  TP("omar", 73, "rode up with mateo. 63 miles, 5,100 ft, he was talking the whole climb like it was a coffee shop. three beers in a paddle at the brewery after, $12, the hazy one was the best and I will not be taking questions. legs are gone", {
    city: "denver", pic: mediaUrl("den-brewery"), audience: "public", likes: 9, wow: 2, tagged: ["mateo"], plus: ["ethan", "lucas", "maya"],
    comments: [
      ["mateo", "63 miles at altitude on texas lungs is respectable. next time we do the real climb"],
      ["ethan", "the beer paddle after the suffering is the only correct training plan"],
      ["lucas", "$12 for three is better than austin. everything is better than austin for beer prices"],
      ["aisha", "hydrate omar. with water. I know you know this"],
    ],
  }),
  TP("ethan", 131, "jules handed me his old pentax before we hiked and the scan finally came back. one roll, black and white, the peak coming out of the pines with the clouds sitting right on top. I cannot explain how this came out of a camera held together with tape. film people I get it now", {
    city: "denver", pic: mediaUrl("den-flatirons"), audience: "public", love: 9, wow: 3, tagged: ["jules"], plus: ["maya", "lucas", "sofia"],
    comments: [
      ["lucas", "the grain on the clouds. ok. what film", [["ethan", "jules says tri-x, I say 'the one in the camera'"]]],
      ["maya", "this is so good ethan. the pines in the foreground doing all the work"],
      ["jules", "the tape is structural. you're not getting the camera back btw it chose you"],
      ["priya", "a software engineer discovers analog. we love a redemption arc"],
    ],
  }),
  TP("ivy", 311, "mom mailed me a box of dad's old slides and this one's red rocks, totally empty, from the air, maybe '88? you can see the whole amphitheatre sitting between the rock slabs and the little winding road to the lot. scanned it on a $40 thrift scanner. gonna cry about it on my run tomorrow", {
    city: "denver", pic: mediaUrl("den-redrocks"), audience: "friends", love: 6, plus: ["maya"],
    comments: [
      ["maya", "IVY. the slabs. uncle k would be so proud you scanned these. also couch still open for december?", [["ivy", "always. bring your trail shoes, we're doing the ridge at sunrise"]]],
      ["mateo", "empty red rocks is a cursed image for anyone who's done the parking there"],
    ],
  }),

  // ---------------- Chicago ----------------
  TP("priya", 46, "arjun: 'the bean is a tourist trap' \narjun 90 seconds later: takes 40 photos of the bean\n\nthe reflection warps the whole skyline and I'm not above it. the towers all glassy in the sun, trees underneath. hackathon reunion tour continues. he still won't admit we should've used postgres", {
    city: "chicago", pic: mediaUrl("chi-bean"), audience: "public", haha: 7, likes: 6, tagged: ["arjun"], plus: ["zoe", "ethan"],
    comments: [
      ["arjun", "it IS a tourist trap and it's ALSO good. both things. also postgres would not have saved us"],
      ["zoe", "come back with deep dish pics or don't come back"],
      ["nadia", "you're in my city and I found out from a post about a bean"],
      ["ethan", "40 photos is restraint honestly"],
    ],
  }),
  TP("nadia", 23, "study break walk to the point. rocky shoreline, the old wooden posts in the water, skyline all hazy across the lake. free therapy. the library can wait 40 minutes. also the futon in hyde park is open after the 15th when finals are over, maya I'm looking at you", {
    city: "chicago", pic: mediaUrl("chi-lakefront"), audience: "public", likes: 6, love: 3, plus: ["maya"],
    comments: [
      ["maya", "the wooden posts in the water!! ok yes. after the 15th. I'll bring the good matcha"],
      ["arjun", "the point is the only correct study break and I don't even go to your school"],
    ],
  }),
  TP("zoe", 97, "mei took me for deep dish after drawing me for 2 hours (she captured my eyebags perfectly). $9 lunch special for a personal one at a place with green walls in pilsen. it's a casserole. it's a good casserole. budget trip total so far: $38 including the train from the airport", {
    city: "chicago", pic: mediaUrl("chi-deepdish"), audience: "public", likes: 8, haha: 2, tagged: ["mei"], plus: ["maya", "hannah"],
    comments: [
      ["mei", "the eyebags were the best part of the drawing. come back, the air mattress misses you"],
      ["hannah", "$38 including transit is an achievement. teach me"],
      ["jordan", "casserole is correct and I'm proud of you for saying it"],
      ["priya", "wait were you in chicago the same week as me?? we could've gotten casserole together"],
    ],
  }),
  TP("mei", 14, "drew strangers on the riverwalk all afternoon. the couple walking with their coffees let me sketch them and then bought me a coffee from the cart ($3.50, strong). kayaks going by under the blue umbrellas. this city gives me a new face every 10 feet. private post bc some of the faces are in here and I didn't ask all of them", {
    city: "chicago", pic: mediaUrl("chi-riverwalk"), audience: "friends", love: 5,
    comments: [
      ["zoe", "I want the coffee couple drawing framed. name your price (my price is $0 I'm a student)"],
      ["arjun", "the cart by the kayak rental is the good one, the one further east is burnt"],
    ],
  }),
  TP("arjun", 6, "public service announcement: the couch in wicker park is open most weekends through winter. blue line is literally outside. no cats (allergic), one very loud radiator. if you're a UT person or know priya you basically already have a key", {
    city: "chicago", audience: "public", likes: 7,
    comments: [
      ["priya", "the radiator is louder than the hackathon alarm and I say that with love"],
      ["nadia", "the radiator is a roommate at this point"],
      ["maya", "noting this. you + nadia = a whole chicago week"],
    ],
  }),

  // ---------------- New Orleans ----------------
  TP("devon", 208, "elijah's cousin's boil. like 40 lbs of crawfish dumped on a table, plastic cups of beer, paper towels as the only utensil. I ate until my hands hurt. cost me $0 because I was 'the nurse from texas.' this is the best weekend I've had off nights in a year", {
    city: "new-orleans", pic: mediaUrl("nola-crawfish"), audience: "public", love: 10, likes: 7, tagged: ["elijah"], plus: ["jordan", "nina"],
    comments: [
      ["elijah", "you ate more than my uncle and he's a professional. come back in april, peak season"],
      ["jordan", "40 lbs is a serious boil. did they do the corn and potatoes in the pot or on the side", [["devon", "in the pot. the potatoes were the sleeper hit"]]],
      ["nina", "devon having a weekend off is the real headline"],
      ["tj", "viet-cajun in houston still wins and I'll die on this hill"],
    ],
  }),
  TP("elijah", 31, "my commute. the streetcar stuck behind traffic at the crosswalk under the oaks, same as every day. $1.25 a ride, $3 for a day pass, and it's slower than walking sometimes but you get to look at houses. couch in mid-city is right off this line if anyone's coming down", {
    city: "new-orleans", pic: mediaUrl("nola-streetcar"), audience: "public", likes: 6, plus: ["maya"],
    comments: [
      ["devon", "slower than walking but you get to look at houses is the most new orleans sentence ever written"],
      ["beau", "day pass + a borrowed bike and you can do the whole city for under $10"],
    ],
  }),
  TP("camille", 44, "the spot. teal building, yellow curtains, the sign that's seen things. two little white statues out front judging everybody who walks up. frenchmen 5 nights a week and I'm still not tired of it. tell me you're coming and you're on the list. no cover for my people", {
    city: "new-orleans", pic: mediaUrl("nola-frenchmen"), audience: "public", likes: 8, love: 3,
    comments: [
      ["sam", "putting 'on the list' as my new year's resolution. booking shows down there in the spring maybe?"],
      ["beau", "the statues have names btw. you have to earn them"],
      ["sofia", "porch lights needs a frenchmen gig. make it happen camille"],
    ],
  }),
  TP("sam", 268, "camille got us on a balcony for mardi gras and I didn't take a single photo of myself, just the boys with their beads and their drinks in jars and the streamers on the railing. 11am. we were already behind. austin nightlife is a children's menu and I say that as someone who works in it", {
    city: "new-orleans", pic: mediaUrl("nola-balcony"), audience: "public", haha: 6, love: 5, tagged: ["camille"], plus: ["zoe", "jordan"],
    comments: [
      ["camille", "11am is LATE for a balcony. amateurs. love you"],
      ["sofia", "the drinks in jars are so important to me"],
      ["zoe", "children's menu is brutal and correct"],
      ["lucas", "did you shoot any of it on the point and shoot I lent you", [["sam", "half a roll. mostly beads. I'll bring it by the shop"]]],
    ],
  }),
  TP("beau", 11, "second line sunday. bring cash for the cooler guy ($3 beers, $2 waters), wear shoes you can walk 4 miles in, don't ask where it ends because nobody knows. the spare room in the bywater is open and so is the porch. come down", {
    city: "new-orleans", audience: "public", likes: 9, plus: ["maya", "sam"],
    comments: [
      ["maya", "'don't ask where it ends' as a travel philosophy. I'm in. spring?"],
      ["elijah", "the cooler guy near the bridge takes venmo now. progress"],
      ["camille", "4 miles is a lie it's 6 and you know it"],
    ],
  }),

  // ---------------- Los Angeles ----------------
  TP("theo", 52, "7am or don't bother. the observatory from the dirt path below it, two domes, dry hillside, nobody around yet. by 10 it's 85 degrees and a parking lot. free to walk the grounds, free to look through the big telescope at night if you wait in line. air mattress in silver lake is open for anyone who can wake up", {
    city: "los-angeles", pic: mediaUrl("la-griffith"), audience: "public", likes: 8, plus: ["maya", "ethan"],
    comments: [
      ["maya", "7am I can do. 7am is my whole personality"],
      ["dani", "you say 7am like it's a normal time. film school people don't know morning exists"],
      ["rosa", "the dirt path light at 7 is unbeatable. shoot it"],
    ],
  }),
  TP("jordan", 84, "dani walked me to a truck at 11pm and I'm not the same. two al pastor, onion cilantro green salsa, lemon wedge not lime bc that's how they do it here, $2.50 each. ate them standing on the sidewalk next to a guy in flip flops who clearly does this every night. taking notes for the truck. austin we need to talk", {
    city: "los-angeles", pic: mediaUrl("la-tacos"), audience: "public", love: 9, likes: 8, tagged: ["dani"], plus: ["maya", "devon", "zoe"],
    comments: [
      ["dani", "the flip flop guy is there every night. he's basically the owner's uncle"],
      ["maya", "$2.50 standing on a sidewalk at 11pm is peak. this is the dream"],
      ["sofia", "my sister feeding my friend tacos at 11pm. family"],
      ["devon", "what's the salsa situation. is it a green that hurts or a green that's friendly", [["jordan", "it hurts. in a loving way"]]],
      ["ruben", "the lemon wedge thing is real in LA. don't fight it"],
    ],
  }),
  TP("rosa", 176, "runyon on portra, hazy day, the whole city spread out under a sky that couldn't decide. trees in the foreground saving the frame. the hike is free and short and full of people in matching sets but the top is the top. horchata after from the cart at the bottom, $3", {
    city: "los-angeles", pic: mediaUrl("la-runyon"), audience: "public", love: 6, plus: ["maya", "lucas", "sofia"],
    comments: [
      ["lucas", "the haze is doing the portra thing where it looks like a memory. send me the scan"],
      ["theo", "matching sets is generous. it's a runway up there"],
    ],
  }),
  TP("sofia", 119, "little sister took me for kbbq in ktown and paid with her film school money which means I owe her forever. the charcoal grill with the glowing coals right on the table, the little bowls, the green bottle. $25 all you can eat and we tested that claim. then I cried a little. she's doing so good out here", {
    city: "los-angeles", pic: mediaUrl("la-ktown"), audience: "public", love: 11, tagged: ["dani"], plus: ["maya", "grace"],
    comments: [
      ["dani", "you cried in a kbbq restaurant and the waiter brought you more soju. that's hospitality"],
      ["grace", "sister trip content is the only content I want"],
      ["jordan", "which spot. I'm there in a month and need the coals"],
      ["lucas", "I'm emotional about the coals and the sisters in equal measure"],
    ],
  }),

  // ---------------- New York ----------------
  TP("grace", 66, "ava took me to the high line and we sat on the wooden bleachers that face the windows over the street and watched taxis for an hour like it was television. free. a couple posed in front of the glass the whole time and honestly good for them. then brunch which was NOT free ($34 for eggs, I'm fine)", {
    city: "new-york", pic: mediaUrl("nyc-highline"), audience: "public", likes: 8, haha: 2, tagged: ["ava"], plus: ["hannah", "maya"],
    comments: [
      ["ava", "the taxi tv is the best show in the city and I will die on that bleacher"],
      ["hannah", "$34 eggs. grace. GRACE."],
      ["maya", "sitting and watching a street for an hour is my kind of tourism actually"],
      ["sienna", "brunch for $34 is a crime and also I'd pay it"],
    ],
  }),
  TP("ava", 8, "sunday slice. two squares, tomato and cheese, paper plate, red mesh table outside, the sun cutting a shadow across it like it's art. $3.50 a square. this is the only reason I stay in this city and I work in advertising so I know a thing about reasons", {
    city: "new-york", pic: mediaUrl("nyc-pizza"), audience: "friends", likes: 5, love: 2,
    comments: [
      ["grace", "the shadow across the plate. you can't help yourself, you had to art direct a slice"],
      ["wes", "which corner. there are 3 square slice places I'd defend and 1 I'd fight"],
    ],
  }),
  TP("wes", 145, "the dumbo shot. the one everyone takes. the cobblestones, the brick, the bridge tower filling the end of the street with the spire poking through the arch. I took it, I'm not above it, I went at 6:50am and there were 4 people and 30 pigeons. my studio is literally one room but I'll walk you here anytime", {
    city: "new-york", pic: mediaUrl("nyc-dumbo"), audience: "public", likes: 9, love: 4, plus: ["maya", "lucas"],
    comments: [
      ["maya", "6:50am and 30 pigeons is so you. miss our studio desk. coming up in the spring and you're walking me everywhere"],
      ["ava", "this is the shot. everyone takes it because it's correct"],
    ],
  }),
  TP("ibrahim", 29, "walked the bridge instead of biking it for once. the stone tower, the cables going every direction, people shuffling across the walkway at golden hour. still a bike commuter, still convinced this city wants me dead, but the walk is free and the light was worth getting off the saddle", {
    city: "new-york", pic: mediaUrl("nyc-brooklyn-bridge"), audience: "public", likes: 6, plus: ["omar"],
    comments: [
      ["omar", "you? walking? is the bike ok. blink twice", [["ibrahim", "the bike is fine. the bike is always fine. it's me who's not"]]],
    ],
  }),

  // ---------------- Marfa ----------------
  TP("lucas", 95, "silas drove me out to the long buildings at chinati. curved metal roof, brick base, gravel path, nothing but dry grass and sky for miles. shot it on the 4x5 he lent me and I was shaking the whole time. the tour is around $25 but walking the outside at golden hour cost nothing and might have been better", {
    city: "marfa", pic: mediaUrl("marfa-chinati"), audience: "public", love: 8, wow: 2, tagged: ["silas"], plus: ["maya", "sofia", "ethan"],
    comments: [
      ["silas", "you only shook on the first sheet. the second one is the keeper, I'll print it this week"],
      ["maya", "the gravel path and the sky. I need to get out there. june said the casita is open", [["lucas", "it is. we drove by. she has a dog now"]]],
      ["sofia", "shaking while holding a $3000 camera in the desert is a very lucas way to spend a saturday"],
      ["omar", "how many sheets did you shoot in total. 4x5 math is scary"],
    ],
  }),
  TP("kenji", 58, "6th time at the prada store that isn't a store. there was a guy in a tie dye shirt just standing next to it, which is the most marfa thing possible. 7.5 hrs from austin, subaru did fine, split gas 4 ways and it's $35 each. go at night after for the stars, pull over anywhere, turn off the headlights", {
    city: "marfa", pic: mediaUrl("marfa-prada"), audience: "public", likes: 7, haha: 3, plus: ["maya"],
    comments: [
      ["june", "you drove past my house and didn't stop?? the casita was EMPTY"],
      ["maya", "$35 each for the gas is so reasonable. ok when's time 7, I'm claiming a seat"],
      ["cole", "the subaru vs my truck on 90 is a race I'd win and you know it"],
    ],
  }),
  TP("june", 3, "casita's open through the winter. stars are free, the cold is also free, bring a real jacket. there's a kiln in the back if anyone from clay studio wants to come throw in the desert. nearest grocery is 30 min so bring snacks. no wifi in the casita, that's a feature", {
    city: "marfa", audience: "public", likes: 8, love: 3, plus: ["maya", "lucas"],
    comments: [
      ["maya", "a kiln. in the desert. june you can't just say that"],
      ["silas", "the no wifi thing has ended friendships. fair warning to the austin kids"],
      ["kenji", "december trip. I'm driving. who's in"],
    ],
  }),

  // ---------------- Austin (home) ----------------
  TP("maya", 12, "water's back at the greenbelt!! the trail under the cliff, the creek showing through the trees, somebody carrying a lime green float like they know something I don't. ran 6 miles before it hit 90. free, obviously. the trailhead parking fills by 8 so go at 7 or bike", {
    city: "austin", pic: mediaUrl("atx-greenbelt"), audience: "public", likes: 10, love: 4,
    comments: [
      ["ethan", "the float person is the smartest one on that trail"],
      ["omar", "bike is the move, the lot is a war zone"],
      ["ivy", "6 before 90 degrees. that's my cousin. see you on the ridge in december"],
      ["yara", "wait was this before run club? did you run twice??", [["maya", "...yes. don't tell my knees"]]],
    ],
  }),
  TP("maya", 41, "the vegan ones. refried beans, the white crema, pineapple on top and the dark sauce drizzle. $4 each. everyone fights me on pineapple on a breakfast taco and everyone is wrong. sunday pottery then this then nothing. perfect day", {
    city: "austin", pic: mediaUrl("atx-tacos"), audience: "public", likes: 9, love: 5, haha: 2,
    comments: [
      ["jordan", "pineapple on a breakfast taco is fine. the crema is what I'd fight you on"],
      ["hannah", "$4 is a budget win. where. I need the where"],
      ["grace", "pottery then tacos then nothing is the whole lifestyle"],
      ["marisol", "come throw in nashville and I'll find you a worse taco"],
    ],
  }),
  TP("yara", 5, "run club tuesdays, 6:30am, town lake trail, starts at the dog park, free forever. we do 4 easy and then coffee. if you're new in town this is how you get friends who'll also drive you to houston. maya hasn't missed one in 3 months and it shows", {
    city: "austin", audience: "public", likes: 7, plus: ["maya", "ethan", "omar"],
    comments: [
      ["maya", "the 'it shows' is doing a lot. see you tuesday"],
      ["raj", "'friends who'll drive you to houston' put some respect on my guest room"],
    ],
  }),

  // ---------------- Dallas ----------------
  TP("cole", 71, "deep ellum on a sunday afternoon when it's quiet. the overpass pillars painted like trees, then actual trees and grass in the little park past them, brick buildings behind. nobody's out yet. truck's in the lot, spare bedroom in lower greenville's empty, come up", {
    city: "dallas", pic: mediaUrl("dal-deepellum"), audience: "public", likes: 6, plus: ["maya"],
    comments: [
      ["harper", "sunday afternoon deep ellum is the only deep ellum I'll do"],
      ["maya", "the painted pillars next to the real trees is kind of a perfect dallas joke. coming up for a plano reunion soon?"],
      ["kenji", "the truck seats 5 and I'm one of them. marfa in december"],
    ],
  }),
  TP("grace", 298, "sienna made brunch at hers and then we walked to the park downtown with the food trucks lined up on the lawn and the glass towers behind. january so the trees were bare but it was 65 out bc texas. $9 for a second lunch from the trucks because brunch is a personality but so is a snack", {
    city: "dallas", pic: mediaUrl("dal-klyde"), audience: "friends", likes: 6, love: 2, tagged: ["sienna"], plus: ["hannah"],
    comments: [
      ["sienna", "brunch at mine then food trucks is the official uptown weekend. come back when the trees have leaves"],
      ["hannah", "second lunch is a budget line item I respect"],
      ["tyler", "which trucks. I'm up there for a closing next month"],
    ],
  }),
  TP("harper", 36, "big tex standing over the cacti with his arms out like he's about to hug 100k people. cotton bowl behind him, texas flag, the whole fair. fletcher's corny dog is $10 now which is a crime but I paid it. go on a weekday, parking's $25 on weekends, ride the dart instead, $6 all day", {
    city: "dallas", pic: mediaUrl("dal-state-fair"), audience: "public", likes: 8, haha: 2, plus: ["zoe"],
    comments: [
      ["cole", "$10 corny dog and you still went back for a second. I saw you"],
      ["owen", "dart is the move. we did it from the vintage market in oak cliff and it was easy"],
      ["maya", "big tex looks so pleased with himself. plano kids forever"],
    ],
  }),

  // ---------------- Houston ----------------
  TP("raj", 21, "the banh mi on bellaire. $4.50. shredded pork, pickled carrots, cucumber sticks, a fistful of cilantro, on paper like it should be. this is the first stop on my official night market tour (the tour is me, driving you, for free). guest room in montrose has a ridiculous number of towels, come use them", {
    city: "houston", pic: mediaUrl("hou-viet"), audience: "public", likes: 9, love: 4, plus: ["maya", "priya", "jordan"],
    comments: [
      ["maya", "$4.50 and a fistful of cilantro. you had me at the paper wrapper"],
      ["priya", "the tour is 'me driving you for free' is the most raj thing ever. I'm in for thanksgiving week"],
      ["yara", "the one two doors down has a better baguette and I'll fight you", [["raj", "wrong but I respect the energy"]]],
      ["jordan", "paper wrap is the only correct packaging for a sandwich"],
    ],
  }),
  TP("layla", 108, "the saturn v lying down in its hangar is the whole museum for me. stages stretched out on black supports, the burnt capsule at the front, info signs on fake grass. it's like $30 to get in which is steep but the rocket alone is worth 20 of it. sundays I'm usually at the museum district instead, half those are free", {
    city: "houston", pic: mediaUrl("hou-space"), audience: "public", likes: 6, wow: 3,
    comments: [
      ["omar", "a rocket on its side is a materials science lecture I'd actually attend. visiting next month, we're going"],
    ],
  }),
  TP("maddie", 196, "crawfish season check in: viet-cajun at the spot in the heights is $6.99/lb right now, garlic butter, extra corn. it goes up to $9 by may. this is your window. aisha come home for a weekend I'll order 10 lbs and we'll not talk about work", {
    city: "houston", audience: "public", likes: 7, plus: ["aisha", "devon"],
    comments: [
      ["aisha", "$6.99 is the signal. coming the 2nd weekend. not talking about work is a lie and we both know it"],
      ["tj", "the heights spot is good but third ward has a guy. I'll text you"],
    ],
  }),

  // ---------------- San Antonio ----------------
  TP("lena", 63, "took my out of town cousin to the river walk against my will. dusk is the only acceptable time: stone bridge, trees lit purple and green, a boat with red lights way down the water. still not a fan but I get it for 20 minutes. go eat at the pearl after, don't eat down here", {
    city: "san-antonio", pic: mediaUrl("sa-riverwalk"), audience: "public", likes: 5, haha: 3,
    comments: [
      ["tyler", "'against my will' and then you post the prettiest photo of it. the river walk won"],
      ["gabe", "don't eat down here is the most important sentence on this app. pearl or southtown, nothing else"],
    ],
  }),
  TP("gabe", 125, "mission san josé with abuela on a cloudy sunday. the long wall of stone arches, two rows, green bushes in front, weathered like it's been there 300 years because it has. free. national park. she lit a candle and then made me drive her to h-e-b. spare room in southtown is open, she WILL cook for you", {
    city: "san-antonio", pic: mediaUrl("sa-missions"), audience: "public", love: 9, likes: 6, plus: ["maya"],
    comments: [
      ["maya", "the arches are so good. also 'she will cook for you' is the strongest hosting pitch in the network"],
      ["lena", "abuela's food vs the pearl food hall. abuela, every time"],
    ],
  }),
  TP("tyler", 17, "drove to SA to lose to lena at pickleball 11-4, 11-6, 11-9 (improving). courts at the park are free if you get there before the retirees. pearl after for tacos and then the fountains lit up at dusk which I did not expect to care about. 80 min from austin, worth it even losing", {
    city: "san-antonio", audience: "public", likes: 7, haha: 4, tagged: ["lena"], plus: ["grace", "devon"],
    comments: [
      ["lena", "11-9 was a gift. come back for a rematch, the retirees are getting faster"],
      ["grace", "'did not expect to care about' the fountains. you cared. you cared a lot"],
      ["devon", "pickleball in another city. you have a problem and I love it"],
      ["owen", "we're doing doubles next time. I need to see this 11-4"],
    ],
  }),
];

// ---------------- Reels ----------------
type ReelSpec = {
  id: string; authorId: string; pic: string; caption: string; audio: string; likeN: number; commentCount: number; shares: number; views: number;
  tags: string[]; saved: string[]; days: number; city: string; audience: "public" | "friends";
};
const R = (r: ReelSpec): Reel => ({
  id: r.id, authorId: r.authorId, image: r.pic, caption: r.caption, audio: r.audio,
  likes: reactors(r.id, r.likeN, [r.authorId]), commentCount: r.commentCount, shares: r.shares, views: r.views,
  savedBy: r.saved, tags: r.tags, createdAt: daysAgo(r.days), city: r.city, audience: r.audience,
});

export const travelReels: Reel[] = [
  R({ id: "tr_broadway", authorId: "kai", pic: mediaUrl("nash-broadway"), city: "nashville", audience: "public",
    caption: "broadway at midnight. neon on every bar, pedicabs in the crosswalk, a bachelorette party every 10 ft. I live here and I go once a year. do it once, then go find a round #nashville #broadway", audio: "Original audio · Kai Brennan", likeN: 11, commentCount: 34, shares: 52, views: 14200, tags: ["nashville", "nightlife"], saved: ["sam", "tyler", "zoe"], days: 7 }),
  R({ id: "tr_krog", authorId: "andre", pic: mediaUrl("atl-krog"), city: "atlanta", audience: "public",
    caption: "krog tunnel at 11pm, nobody around, every pillar covered. the graffiti changes every week so this is already gone. walk through from the beltline side, it's free and kind of eerie #atlanta #streetart", audio: "trending · lofi night walk", likeN: 12, commentCount: 41, shares: 77, views: 19800, tags: ["atlanta", "streetart", "photography"], saved: ["maya", "lucas", "zoe", "kai"], days: 22 }),
  R({ id: "tr_ridge", authorId: "mateo", pic: mediaUrl("den-snow-trail"), city: "denver", audience: "public",
    caption: "the ridge road before the storm came in. 8% for 4 miles, evergreens below, peaks stacking up into the clouds. rain hit us at the top. strava says it happened #cycling #colorado", audio: "Original audio · Mateo Ruiz", likeN: 13, commentCount: 28, shares: 39, views: 9100, tags: ["cycling", "denver", "mountains"], saved: ["omar", "ethan", "maya", "ivy"], days: 75 }),
  R({ id: "tr_ltrain", authorId: "colin", pic: mediaUrl("chi-l-train"), city: "chicago", audience: "public",
    caption: "the L cutting between the towers downtown, one blossom tree trying its best on the street. $2.50 a ride, the best view of the city is from a train window #chicago #housemusic", audio: "Colin Byrne · unreleased edit", likeN: 10, commentCount: 19, shares: 24, views: 6700, tags: ["chicago", "music"], saved: ["sam", "arjun"], days: 190 }),
  R({ id: "tr_brass", authorId: "beau", pic: mediaUrl("nola-brass"), city: "new-orleans", audience: "public",
    caption: "second line sunday. trombone guy in the white tee led the whole block for 2 hours. free, loud, nobody knows where it ends. come down #neworleans #secondline #brassband", audio: "Original audio · live in the Bywater", likeN: 15, commentCount: 88, shares: 210, views: 43000, tags: ["music", "neworleans", "free"], saved: ["maya", "sam", "sofia", "camille", "devon"], days: 13 }),
  R({ id: "tr_venice", authorId: "dani", pic: mediaUrl("la-venice"), city: "los-angeles", audience: "public",
    caption: "venice skatepark at 4pm. concrete bowls, kids dropping in, the ocean and the mountains just sitting behind it like a backdrop I didn't pay for. free to watch all day #venice #la", audio: "trending · surf rock loop", likeN: 12, commentCount: 37, shares: 61, views: 16300, tags: ["losangeles", "skate"], saved: ["zoe", "theo", "jordan"], days: 48 }),
  R({ id: "tr_subway", authorId: "ibrahim", pic: mediaUrl("nyc-subway"), city: "new-york", audience: "public",
    caption: "125th, waiting on the C uptown. green and white tile, two people on the bench, 22 minutes. the bike was in the shop. never again #nyc #subway", audio: "Original audio · platform ambience", likeN: 8, commentCount: 15, shares: 9, views: 3800, tags: ["nyc", "transit"], saved: ["omar", "wes"], days: 33 }),
  R({ id: "tr_barton", authorId: "maya", pic: mediaUrl("atx-barton"), city: "austin", audience: "public",
    caption: "barton springs from above on a 102 degree saturday. hundreds of people, every inflatable ring in travis county, green water that's 68 degrees year round. $5 in for residents, free before 8am. go before 8am #bartonsprings #austin", audio: "Original audio · Maya Chen", likeN: 14, commentCount: 52, shares: 95, views: 21000, tags: ["austin", "swimming", "summer"], saved: ["hannah", "grace", "ethan", "ivy", "noah"], days: 101 }),
  R({ id: "tr_pearl", authorId: "gabe", pic: mediaUrl("sa-pearl"), city: "san-antonio", audience: "public",
    caption: "pearl at dusk. the ground fountains lit up, trees wrapped in string lights, a kid and a dog losing their minds in the spray, the old brewery chimney behind it all. saturday ritual. free to walk, $12 tacos if you cave #sanantonio #thepearl", audio: "trending · golden hour acoustic", likeN: 11, commentCount: 23, shares: 31, views: 7900, tags: ["sanantonio", "food", "free"], saved: ["maya", "lena", "tyler", "grace"], days: 40 }),
  R({ id: "tr_budgettacos", authorId: "hannah", pic: mediaUrl("atx-tacos"), city: "austin", audience: "public",
    caption: "budget week day 4: maya's $4 vegan tacos. beans, crema, pineapple, the dark drizzle. three of them is $12 and that's lunch AND dinner if you're me. teacher salary content #budget #austintacos", audio: "trending · frugal girl piano", likeN: 10, commentCount: 44, shares: 70, views: 12800, tags: ["budget", "food", "austin"], saved: ["maya", "zoe", "grace", "ella"], days: 30 }),
  R({ id: "tr_heat", authorId: "tess", pic: mediaUrl("nash-hotchicken"), city: "nashville", audience: "public",
    caption: "heat level ranking from a nurse who's seen things: mild (coward), medium (this one, on white bread w the pickles and the potato salad, correct), hot (brave), XXX (please don't, I've triaged you) #hotchicken #nashville", audio: "Original audio · Tess Okonkwo", likeN: 12, commentCount: 61, shares: 102, views: 24500, tags: ["food", "nashville"], saved: ["maya", "kai", "jordan", "devon"], days: 15 }),
  R({ id: "tr_dayoff", authorId: "ruben", pic: mediaUrl("nash-skyline"), city: "nashville", audience: "friends",
    caption: "day off walk across the river. glass towers on one side, old brick on the other, the white truss bridge under my feet. free. futon's open #nashville #dayoff", audio: "Original audio · Ruben Castillo", likeN: 5, commentCount: 6, shares: 2, views: 900, tags: ["nashville", "walk"], saved: ["jordan"], days: 9 }),
];

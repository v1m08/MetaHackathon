import type { Post, Story } from "@/types";
import { P } from "./builders";
import { hoursAgo, photo } from "./helpers";

// Personal (non-group) posts that show up on friends' feeds and profiles.
export const feedPosts: Post[] = [
  P("jordan", 1.5, "48 hours until the pop-up. 14 lbs of birria braising as we speak. If you've ever eaten my food at a party and said 'you should sell this', Saturday is your chance to put your money where your mouth is. Hotel Vegas back patio, 11am 🌮", {
    hours: true, likes: 61, love: 24, wow: 3, shares: 11, images: [photo("birria-pot", 800, 800)], audience: "public",
    comments: [["maya", "I have said this at minimum 11 times. I'll be first in line"], ["devon", "bringing cash and an appetite"], ["sofia", "we're playing the night before so the whole band is coming hungover, be gentle"], ["sam", "patio's clean, chairs are out, let's go"]],
  }),
  P("maya", 4, "first bowl that didn't collapse 🏺 only took 7 weeks. it's lopsided and I love her", {
    hours: true, likes: 48, love: 19, images: [photo("pottery-bowl-first", 800, 800)], location: "Clay Studio ATX",
    comments: [["lucas", "she's perfect"], ["priya", "ok but can I have a mug next"], ["grace", "the lopsided ones are the ones with personality"], ["hannah", "framing this"]],
  }),
  P("sofia", 9, "PORCH LIGHTS at Hotel Vegas FRIDAY 10pm with Sun June and a secret guest (it's not secret it's Sam DJing after). $10 at the door. we have new songs. one of them is about an ex who's going to be there. come watch me be brave", {
    hours: true, likes: 73, love: 31, haha: 6, shares: 15, images: [photo("porch-lights-flyer", 800, 1000)], audience: "public",
    comments: [["sam", "the after set is going to be nasty. in a good way"], ["zoe", "which ex 👀"], ["sofia", "zoe."], ["lucas", "bringing the camera, you'll have photos by sunday"], ["maya", "wouldn't miss it"], ["jordan", "cooking all night but I'll make the last song"]],
  }),
  P("devon", 14, "post-shift sunrise from the parking garage. 13 hours, 2 codes, 1 kid who drew me a picture of a 'nurse dinosaur'. going to sleep for 9 hours and then volleyball", {
    hours: true, likes: 54, love: 22, care: 9, images: [photo("parking-garage-sunrise", 800, 600)],
    comments: [["nina", "the nurse dinosaur drawing is going on your fridge or I'm reporting you"], ["marcus", "rest up. sunday's gonna be good"], ["aisha", "you're a hero and you need an iron supplement"], ["tyler", "see you at 10. I'm bringing Grace"]],
  }),
  P("priya", 22, "I SIGNED A LEASE. 19 days, 14 tours, 1 scam, 0 tears (lie). Riverside, 2b/2b, moving Dec 1. Thank you to the apartment group and to Aisha for the spreadsheet intervention", {
    hours: true, likes: 67, love: 28, care: 4, images: [photo("lease-signing-selfie", 800, 800)],
    comments: [["aisha", "the spreadsheet did it"], ["zoe", "housewarming when"], ["ethan", "congrats priya!! welcome to the adult world of paying for internet"], ["hannah", "so proud 🥹"], ["omar", "riverside club 🤝"]],
  }),
  P("ethan", 30, "finally sent the V5 I've been projecting since August. 11 sessions. no video because my hands were shaking too much to film after", {
    hours: true, likes: 39, wow: 7, location: "Austin Bouldering Project",
    comments: [["priya", "ok teach me, I've plateaued at V3 and my ego can't take it"], ["omar", "11 sessions is dedication"], ["tyler", "I don't know what a V5 is but I'm proud of you"], ["marcus", "finger strength 📈"]],
  }),
  P("hannah", 1.4, "one of my 4th graders asked if I was 'like 40' today. I'm 22. I'm taking it as a compliment to my authority", {
    likes: 44, haha: 31,
    comments: [["grace", "the authority of a 40 year old on a 22 year old's salary"], ["maya", "you have teacher energy and it's powerful"], ["aisha", "kids are so unhinged I love them"]],
  }),
  P("lucas", 1.7, "roll #41. walked from Fleet to the river at golden hour. Portra 400. Austin looks better on film, I don't make the rules", {
    likes: 58, love: 21, images: [photo("film-austin-1", 800, 1000), photo("film-austin-2", 800, 1000), photo("film-austin-3", 800, 1000)], audience: "public",
    comments: [["sofia", "the second one. frame it"], ["maya", "I want one for my apartment. for real, I'll pay"], ["lucas", "no payment, I'll print you one"], ["omar", "what scanner are you using? the colors are so clean"], ["lucas", "the lab on Burnet, I don't scan myself yet"]],
  }),
  P("marcus", 2.2, "unpopular trainer opinion: you don't need a 5am routine. you need a routine. mine is 5am because I like empty gyms, not because it's magic. go at 7pm if that's when you'll actually go. consistency > aesthetics", {
    likes: 83, love: 14, shares: 9, audience: "public",
    comments: [["devon", "7pm club rise up (after I wake up at 6pm)"], ["grace", "needed this. I keep failing at 6am and then skipping entirely"], ["tyler", "the only trainer I trust"]],
  }),
  P("zoe", 2.5, "hit plat 2 in val and immediately lost 4 games in a row. the universe keeps me humble. anyway who wants to play tonight, I need a healer (I know there's no healers in val I mean a sage)", {
    likes: 22, haha: 9,
    comments: [["devon", "I'm free after 10, I'll sage"], ["priya", "I'm bronze and proud, I'll be the reason we lose"], ["marcus", "I'll watch. I don't understand it but I'll watch"]],
  }),
  P("aisha", 3, "the community health fair I've been planning for 4 months is in 2 weeks. we have 22 vendors, free flu shots, a bounce house (unrelated to health but kids), and Jordan's doing tacos. Dove Springs Rec Center, Saturday the 22nd. if you can volunteer for a 2 hour shift the sign-up is in the event", {
    likes: 59, love: 23, shares: 14, images: [photo("health-fair-flyer", 800, 1000)], audience: "public",
    comments: [["hannah", "signed up for 10-12!"], ["nina", "I can do blood pressure checks, put me down"], ["maya", "I made you a poster draft, check your DMs"], ["omar", "volunteering 12-2"], ["jordan", "tacos confirmed. 200 of them."]],
  }),
  P("tyler", 3.5, "lake day was a success. 6 people, 1 boat (borrowed), 0 sunburns (lie, Ethan). pickleball tournament sign-ups close friday btw", {
    likes: 47, haha: 4, images: [photo("lake-travis-boat", 800, 600), photo("lake-travis-group", 800, 600)], tagged: ["ethan", "grace", "marcus", "devon"],
    comments: [["ethan", "I was told the sunscreen was 'water resistant'"], ["grace", "the boat almost didn't start and nobody's talking about it"], ["marcus", "best day"]],
  }),
  P("nina", 4.2, "monstera finally put out a fenestrated leaf after 8 months of me talking to it. she's a late bloomer. so am I", {
    likes: 41, love: 17, images: [photo("monstera-leaf", 800, 1000)],
    comments: [["devon", "'so am I' took me out"], ["aisha", "the house is officially a jungle, I live in a jungle"], ["zoe", "can I buy a cutting"], ["nina", "zoe you're the 4th person this week, yes, $15, check marketplace"]],
  }),
  P("sam", 5, "booked my first out-of-town set. Houston, December. SAMANTHA_VR goes on tour (one city). also Earl the bowling shirt is coming", {
    likes: 52, love: 20, images: [photo("dj-booth-neon", 800, 800)], audience: "public",
    comments: [["sofia", "SAM!!!! road trip"], ["jordan", "I'll cook for the green room"], ["zoe", "earl must go"], ["lucas", "I'll come shoot it"]],
  }),
  P("grace", 5.5, "first farmers market of fall. spent $38 on 'ingredients' and will cook none of it. the tomatoes are decorative", {
    likes: 33, haha: 12, images: [photo("farmers-market-haul", 800, 800)], location: "Mueller Farmers Market",
    comments: [["hannah", "coffee + treats challenge says this counts"], ["grace", "it's PRODUCE"], ["jordan", "bring them to me I'll make something"]],
  }),
  P("omar", 6, "100 mile ride done. 6h12m. ate 9 gels, 2 bananas, 1 gas station burrito that saved my life at mile 70. the 360 bridge climb at mile 85 is a war crime", {
    likes: 45, wow: 12, images: [photo("cycling-360-bridge", 800, 600)], location: "Pennybacker Bridge",
    comments: [["ethan", "100 miles is insane. congrats"], ["lucas", "the burrito is the real MVP"], ["maya", "run club is slow for you now huh"], ["omar", "never. tuesdays are sacred"]],
  }),
  P("maya", 7, "shipped the onboarding redesign I've been fighting for since March. 6% lift in activation. small number, big feeling. first time my name is on a launch post", {
    likes: 71, love: 25, care: 2,
    comments: [["priya", "MAYA that's huge. design is hard to get credit for"], ["ethan", "6% on activation is not small, that's a real win"], ["grace", "we celebrating? jo's at 6?"], ["aisha", "so proud of you"]],
  }),
  P("devon", 8, "2K rematch with Tyler tonight. he's 0-7. I'm telling everyone because he told everyone about the volleyball", {
    likes: 29, haha: 18,
    comments: [["tyler", "I was 0-6 and the 7th one was a glitch"], ["marcus", "I'll stream it"], ["sam", "put money on it"]],
  }),
  P("sofia", 9, "wrote a song in 20 minutes at 2am and it's either the best thing I've written or I'm sleep deprived. playing it friday either way", {
    likes: 38, love: 14,
    comments: [["lucas", "2am songs are always the real ones"], ["sam", "if it's about the ex I need a heads up for the lighting cue"]],
  }),
  P("priya", 11, "hackathon #9 done. 36 hours, 4 energy drinks, 2nd place, 1 new friend who turned out to be my future roommate's cousin. austin is a small town pretending to be a city", {
    likes: 56, love: 12, haha: 5, images: [photo("hackathon-team", 800, 600)], location: "Gates Dell Complex",
    comments: [["ethan", "what'd you build?"], ["priya", "a tool that reads your syllabus and auto-blocks study time. it sort of worked"], ["zoe", "2nd place!!"], ["maya", "the small town thing is so real"]],
  }),
  P("hannah", 13, "crocheted 14 beanies for my class because 'ms kim can you make me one' became a movement. my hands hurt. worth it", {
    likes: 64, love: 29, images: [photo("crochet-beanies", 800, 800)],
    comments: [["grace", "ms kim is the moment"], ["nina", "the kids are going to remember this forever"], ["zoe", "pattern?"]],
  }),
  P("ethan", 16, "cooked something that wasn't eggs. it was pasta. it was fine. growth", {
    likes: 31, haha: 14, images: [photo("pasta-attempt", 800, 800)],
    comments: [["jordan", "add salt to the water. more than you think"], ["ethan", "I did add salt"], ["jordan", "more"]],
  }),
  P("marcus", 19, "client of 8 months deadlifted 225 today. she started at the bar. she cried, I cried, the guy next to us cried a little. this is why I quit the corporate gym", {
    likes: 92, love: 41, care: 6, audience: "public",
    comments: [["devon", "this is it man"], ["grace", "ok I'm signing up"], ["hannah", "crying in the teacher's lounge"]],
  }),
  P("zoe", 23, "anime club movie night this friday, we're watching Perfect Blue, bring a blanket and snacks, room ART 1.102, 7pm. (I made the poster in 10 min please don't judge)", {
    likes: 26, love: 5, images: [photo("anime-night-poster", 800, 1000)], audience: "public",
    comments: [["priya", "perfect blue before a hackathon is not a decision I'd make but I'll be there"], ["marcus", "is this the scary one"], ["zoe", "yes"]],
  }),
  P("aisha", 27, "finished my thesis proposal defense. committee said 'ambitious'. choosing to believe that's good", {
    likes: 49, love: 15, care: 3,
    comments: [["omar", "'ambitious' is academic for 'good luck'. congrats"], ["maya", "jollof celebration?"], ["aisha", "jollof celebration."]],
  }),
  P("lucas", 31, "3 years in austin today. still can't find a proper croissant. still staying", {
    likes: 68, love: 33, haha: 7,
    comments: [["maya", "🥐🫶"], ["sofia", "we're so lucky you stayed"], ["jordan", "I'll learn to make croissants for you"]],
  }),
  P("tyler", 38, "signed up for a pickleball league. I'm 24. my knees are 24. this is fine", {
    likes: 35, haha: 21,
    comments: [["marcus", "I'll see you in 6 months for the knee rehab"], ["grace", "pickleball is just tennis for people who want to talk more"], ["tyler", "yes. exactly."]],
  }),
  P("nina", 45, "one year with Devon's cousin (my boyfriend, long story, it's fine, we're fine). celebrating with the cheapest nice dinner we could find. love you Kai 🤍", {
    likes: 77, love: 44, images: [photo("anniversary-dinner", 800, 800)], tagged: ["devon"],
    comments: [["devon", "I still take credit for this"], ["aisha", "happy anniversary!! I'll water the plants tonight"], ["hannah", "the cheapest nice dinner is the most 'us' thing ever"]],
  }),
];

export const stories: Story[] = [
  { id: "s1", userId: "jordan", image: photo("story-birria-prep", 720, 1280), caption: "48 hrs 🌮", createdAt: hoursAgo(1) },
  { id: "s2", userId: "sofia", image: photo("story-soundcheck", 720, 1280), caption: "soundcheck friday", createdAt: hoursAgo(2) },
  { id: "s3", userId: "lucas", image: photo("story-latte-art", 720, 1280), caption: "6am opener", createdAt: hoursAgo(3) },
  { id: "s4", userId: "maya", image: photo("story-pottery-wheel", 720, 1280), caption: "bowl #2", createdAt: hoursAgo(5) },
  { id: "s5", userId: "marcus", image: photo("story-gym-5am", 720, 1280), caption: "5am club", createdAt: hoursAgo(6) },
  { id: "s6", userId: "nina", image: photo("story-plant-shelf", 720, 1280), caption: "61 and counting", createdAt: hoursAgo(8) },
  { id: "s7", userId: "zoe", image: photo("story-thrift-rack", 720, 1280), caption: "bins day", createdAt: hoursAgo(10) },
  { id: "s8", userId: "tyler", image: photo("story-pickleball", 720, 1280), caption: "league night", createdAt: hoursAgo(12) },
  { id: "s9", userId: "omar", image: photo("story-cycling-dawn", 720, 1280), caption: "60 mi before lab", createdAt: hoursAgo(14) },
  { id: "s10", userId: "grace", image: photo("story-matcha", 720, 1280), caption: "treat challenge day 3", createdAt: hoursAgo(16) },
];

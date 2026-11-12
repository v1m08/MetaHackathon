import type { FBEvent } from "@/types";
import { addHours, daysAgo, inDays, photo } from "./helpers";

export const events: FBEvent[] = [
  {
    id: "e_taco_popup", title: "Jordan's Taco Pop-Up (Birria Edition)", cover: photo("event-taco-popup", 1200, 600),
    startsAt: inDays(2, 11), endsAt: inDays(2, 15), location: "Hotel Vegas (back patio)", address: "1502 E 6th St, Austin, TX",
    hostId: "jordan", category: "Food & Drink", price: "Pay per taco ($3.50–$4)",
    description: "First official pop-up. Birria (consommé included), al pastor off the trompo, mushroom tinga for the vegetarians, horchata and jamaica. Cash and Venmo. Sam's working the bar. Come early, I'm making 400 tacos and that's it.",
    going: ["maya", "devon", "sam", "priya", "sofia", "lucas", "hannah", "zoe", "nina", "tyler", "marcus", "grace", "aisha"],
    interested: ["ethan", "omar"], invited: ["ethan", "omar"],
  },
  {
    id: "e_porch_lights", title: "Porch Lights + Sun June (+ SAMANTHA_VR after)", cover: photo("event-porch-lights", 1200, 600),
    startsAt: inDays(1, 22), endsAt: addHours(inDays(1, 22), 4), location: "Hotel Vegas", address: "1502 E 6th St, Austin, TX",
    hostId: "sofia", category: "Music", price: "$10 at the door",
    description: "New songs. One of them is about someone who will be in the room. Doors 9, Sun June 9:30, us at 10:30, Sam spins after until close. 21+.",
    going: ["sam", "lucas", "maya", "zoe", "grace", "jordan", "priya"], interested: ["devon", "ethan", "hannah", "aisha", "tyler"],
  },
  {
    id: "e_volleyball_sunday", title: "Sunday Pickup Volleyball", cover: photo("event-volleyball", 1200, 600),
    startsAt: inDays(3, 10), endsAt: inDays(3, 12), location: "Zilker Park Sand Courts", address: "2100 Barton Springs Rd, Austin, TX",
    hostGroupId: "g_volleyball", hostId: "devon", category: "Sports", price: "Free",
    description: "Weekly pickup. All levels. Rotate in by wait time. Bring water. We lost a ball to the lake last week so if you have one, bring it.",
    going: ["devon", "tyler", "marcus", "nina", "grace", "ethan", "sam"], interested: ["jordan"],
  },
  {
    id: "e_health_fair", title: "Dove Springs Community Health Fair", cover: photo("event-health-fair", 1200, 600),
    startsAt: inDays(11, 10), endsAt: inDays(11, 15), location: "Dove Springs Recreation Center", address: "5801 Ainez Dr, Austin, TX",
    hostId: "aisha", category: "Community", price: "Free",
    description: "Free flu shots, blood pressure and glucose screenings, 22 local vendors, kids' activities, free tacos (Jordan). Volunteer shifts: 9–11, 11–1, 1–3. Sign up in the discussion. Organized with Dell Med and Austin Public Health.",
    going: ["hannah", "nina", "maya", "omar", "jordan", "priya"], interested: ["grace", "ethan", "devon", "lucas", "sam"],
  },
  {
    id: "e_run_club_tue", title: "Town Lake Tuesday Run", cover: photo("event-town-lake-run", 1200, 600),
    startsAt: inDays(0, 18), endsAt: inDays(0, 20), location: "Auditorium Shores (the sign)", address: "900 W Riverside Dr, Austin, TX",
    hostGroupId: "g_runclub", hostId: "maya", category: "Fitness", price: "Free",
    description: "6:30pm. 5 mile loop over Mopac, or 3 mile turnaround with the walk/jog group. P. Terry's after. All paces, nobody gets dropped.",
    going: ["maya", "omar", "grace", "ethan", "marcus", "aisha"], interested: ["hannah", "lucas"],
  },
  {
    id: "e_friendsgiving", title: "Friendsgiving at Maya's", cover: photo("event-friendsgiving", 1200, 600),
    startsAt: inDays(16, 17), endsAt: inDays(16, 23), location: "Maya's apartment", address: "Mueller, Austin, TX",
    hostId: "maya", category: "Party", price: "Bring a dish",
    description: "Potluck. I'm doing the turkey (first time, pray). Sign up for a dish in the discussion so we don't get 6 mac and cheeses again (we will get 6 mac and cheeses again). Lucas is bringing wine. Devon is bringing the speaker and leaving by 9 for work.",
    going: ["jordan", "priya", "lucas", "aisha", "hannah", "grace", "ethan", "sofia", "devon", "omar"], interested: ["nina", "sam", "zoe", "marcus", "tyler"],
  },
  {
    id: "e_pickleball_tourney", title: "Fall Pickleball Round Robin", cover: photo("event-pickleball", 1200, 600),
    startsAt: inDays(8, 9), endsAt: inDays(8, 13), location: "Austin Pickle Ranch", address: "10611 Metric Blvd, Austin, TX",
    hostId: "tyler", category: "Sports", price: "$15 (covers courts + balls)",
    description: "Round robin, 2.5–3.5 skill level, doubles, partners rotate. Winner gets a $50 gift card to Jordan's taco truck future. Sign-ups close Friday.",
    going: ["tyler", "grace", "marcus", "ethan"], interested: ["devon", "hannah", "nina"],
  },
  {
    id: "e_anime_night", title: "Anime Club Movie Night: Perfect Blue", cover: photo("event-anime-night", 1200, 600),
    startsAt: inDays(1, 19), endsAt: inDays(1, 21), location: "UT Art Building, Room 1.102", address: "2301 San Jacinto Blvd, Austin, TX",
    hostId: "zoe", category: "Film", price: "Free (snacks $2 donation)",
    description: "Perfect Blue (1997). Bring a blanket. It's the scary one. Discussion after for whoever isn't too shaken.",
    going: ["zoe", "priya", "marcus"], interested: ["sofia", "sam"],
  },
  {
    id: "e_trail_cleanup", title: "Butler Trail Cleanup + Breakfast Tacos", cover: photo("event-trail-cleanup", 1200, 600),
    startsAt: inDays(5, 8), endsAt: inDays(5, 11), location: "Lamar Pedestrian Bridge (south end)", address: "Austin, TX",
    hostGroupId: "g_runclub", hostId: "omar", category: "Volunteering", price: "Free",
    description: "The Trail Conservancy gives us bags and grabbers, we give the trail two hours. Run club is covering breakfast tacos after (Fleet, thanks Lucas).",
    going: ["omar", "maya", "lucas", "aisha", "hannah"], interested: ["grace", "ethan", "priya"],
  },
  {
    id: "e_housewarming", title: "Faculty Lounge Housewarming", cover: photo("event-housewarming", 1200, 600),
    startsAt: daysAgo(12, 19), endsAt: daysAgo(12, 23), location: "Hannah's house (North Loop)", address: "North Loop, Austin, TX",
    hostId: "hannah", category: "Party", price: "Bring a plant or a bottle",
    description: "We moved in. Come see the house. Three teachers live here so it ends at 11 sharp.",
    going: ["maya", "grace", "nina", "aisha", "priya", "tyler", "lucas", "jordan"], interested: ["ethan", "devon"],
  },
];

export const eventById = (id: string) => events.find((e) => e.id === id);

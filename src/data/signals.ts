// Availability signals, as real content: posts and chat lines in which people say, in their own words, when they
// are away or around. The `busyDates` field is no longer read by any code path; availability is inferred from
// signals like these (plus event RSVPs) and then confirmed by asking. Several lines flip someone from
// "likely free" to "busy" on purpose so the inference has something to find.
import type { Message, Post } from "@/types";
import { P } from "./builders";
import { hoursAgo, uid } from "./helpers";
import { weekendLabel } from "./travel";

export const signalPosts: Post[] = [
  // Noah (Denver): skiing w3 and w5 → away both weekends
  P("noah", 3, `season pass activated. opening weekend ${weekendLabel(3)} at a-basin, then ${weekendLabel(5)} at copper with the roommates. phone goes in the glovebox. don't text me about design reviews`, { likes: 14 }),
  // Theo (LA): on set w2 and w4
  P("theo", 2, `call sheet says ${weekendLabel(2)} AND ${weekendLabel(4)} are shoot weekends. 5am calls. if i owe you a hang it's ${weekendLabel(3)} or january`, { likes: 9 }),
  // Nadia (Chicago): parents in town w2, exams dec 7–18 (policy)
  P("nadia", 4, `parents land in chicago the ${weekendLabel(2)} weekend for thanksgiving part two and i have been asked to "have the apartment look like an adult lives in it". then exams until dec 18. see you all in 2027`, { likes: 11 }),
  // Elijah (New Orleans): on shift w2
  P("elijah", 5, `picked up the whole ${weekendLabel(2)} holiday weekend in the unit (triple time, i'm not a saint). ${weekendLabel(3)} i am OFF and i will be on a porch`, { likes: 7 }),
  // June (Marfa): away w2
  P("june", 6, `driving to el paso ${weekendLabel(2)} for family. casita's empty that weekend, but so am i, so no visitors. back for the new moon`, { likes: 8 }),
  // Marisol (Nashville): wedding w3
  P("marisol", 4, `${weekendLabel(3)} we're in birmingham for a wedding, biscuit goes to the sitter. the weekend after we're home and the guest room is made up`, { likes: 12 }),
  // Kai (Nashville): away w4
  P("kai", 7, `flying home to fort worth ${weekendLabel(4)} for my mom's thing. every other december weekend i'm in nashville and bored, come visit`, { likes: 10 }),
  // Raj (Houston): explicitly around w2 → likely free
  P("raj", 1, `night market ${weekendLabel(2)} and i'm doing nothing else that weekend. guest room's made up, towels are folded, i'm bored`, { likes: 6 }),
  // Andre (Atlanta): work travel midweek, around weekends; one away weekend
  P("andre", 3, `in nyc for work tue–thu for the next month. weekends i'm in atlanta except ${weekendLabel(4)} (brother's graduation in houston)`, { likes: 8 }),
  // Gabe (San Antonio): home w2
  P("gabe", 2, `abuela is making tamales ${weekendLabel(2)} and has asked how many people are coming. the answer she wants is "many"`, { likes: 15 }),
];

/** Chat lines added to existing conversations: [conversationId, senderId, hoursAgo, text]. */
export const signalMessages: [string, string, number, string][] = [
  ["c_maya_kai", "kai", 40, `oh also i'm in fort worth ${weekendLabel(4)}, mom's birthday. any other weekend the air mattress is yours`],
  ["c_maya_kai", "maya", 39, "noted!! not that weekend then"],
];

export function appendSignalMessages(conversations: { id: string; participantIds: string[]; messages: Message[] }[]) {
  for (const [cid, sender, h, text] of signalMessages) {
    const c = conversations.find((x) => x.id === cid);
    if (!c) continue;
    c.messages.push({ id: uid("m"), senderId: sender, text, createdAt: hoursAgo(h), readBy: c.participantIds });
    c.messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
}

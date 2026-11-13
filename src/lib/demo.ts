// The hackathon demo: 5 judge accounts (our team, living around SF) in one group chat, plus the Muse bot that
// sends the group a game and then suggests a plan. Shared by server and client, so constants only.

/** Judge accounts in the order judges pick them (1-5). Nivan, Vedansh and Keira hike. */
export const DEMO_IDS = ["nivan", "armaan", "vedansh", "keira", "abishek"] as const;
export const DEMO_CHAT = "c_weekend_plans";
export const MUSE_ID = "muse";
/** Events Muse can pick from at the end. */
export const DEMO_EVENT_IDS = ["e_lands_end_hike", "e_burrito_crawl"] as const;

/** Muse sends its plan once this many people have finished the group's first game. */
export const PLAN_AFTER_PLAYERS = 2;

export const isDemoUser = (id?: string | null) => !!id && (DEMO_IDS as readonly string[]).includes(id);
export const demoNumber = (id: string) => (DEMO_IDS as readonly string[]).indexOf(id) + 1;

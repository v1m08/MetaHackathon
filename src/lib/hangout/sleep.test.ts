import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CHATS, FRIENDS, GATHERINGS, PHOTOS, REACTIONS } from "@/data/hangout/seed";
import { buildTimeline, chatEvents, rhythmDays, sleepState, stateForRatio } from "./sleep";
import type { ChatSnippet, TimelineEvent } from "./types";

const msg = (id: string, date: string, sender: string, friendId = "f"): ChatSnippet => ({ id, friendId, date, sender, text: "hi" });
const ev = (date: string, type: TimelineEvent["type"] = "two_way_chat"): TimelineEvent => ({ date, type, sourceIds: [] });

describe("two-way chat detection", () => {
  it("counts a reply within 48 hours as two-way", () => {
    const out = chatEvents([msg("a", "2026-01-01T10:00:00", "me"), msg("b", "2026-01-02T20:00:00", "f")]);
    assert.deepEqual(out.map((e) => e.type), ["two_way_chat"]);
    assert.equal(out[0].date, "2026-01-02");
  });

  it("does not count a reply after 48 hours", () => {
    const out = chatEvents([msg("a", "2026-01-01T10:00:00", "me"), msg("b", "2026-01-03T10:01:00", "f")]);
    assert.deepEqual(out.map((e) => e.type), ["one_way", "one_way"]);
  });

  it("treats several messages from one side as one-way", () => {
    const out = chatEvents([msg("a", "2026-01-01T10:00:00", "me"), msg("b", "2026-01-01T11:00:00", "me")]);
    assert.deepEqual(out.map((e) => e.type), ["one_way"]);
  });

  it("ignores likes and reactions, even right after a message", () => {
    const timeline = buildTimeline({
      friendId: "f",
      chats: [msg("a", "2026-01-01T10:00:00", "me")],
      reactions: [{ id: "r", friendId: "f", date: "2026-01-01", by: "f", emoji: "❤️", target: "a" }],
      gatherings: [],
      photos: [],
    });
    assert.deepEqual(timeline.map((e) => e.type), ["one_way"]);
  });
});

describe("rhythm", () => {
  it("defaults to 30 with fewer than 3 real events", () => {
    assert.equal(rhythmDays([ev("2026-01-01"), ev("2026-02-01")]), 30);
    assert.equal(rhythmDays([]), 30);
  });

  it("is the median gap between real contacts", () => {
    // gaps: 10, 20, 40 → median 20
    assert.equal(rhythmDays([ev("2026-01-01"), ev("2026-01-11"), ev("2026-01-31", "meetup"), ev("2026-03-12")]), 20);
  });

  it("ignores one-way messages", () => {
    assert.equal(rhythmDays([ev("2026-01-01"), ev("2026-01-02", "one_way"), ev("2026-01-21"), ev("2026-02-10")]), 20);
  });

  it("clamps to 7..120", () => {
    assert.equal(rhythmDays([ev("2026-01-01"), ev("2026-01-02"), ev("2026-01-03")]), 7);
    assert.equal(rhythmDays([ev("2020-01-01"), ev("2021-01-01"), ev("2022-01-01")]), 120);
  });

  it("dedupes events on the same day", () => {
    assert.equal(rhythmDays([ev("2026-01-01"), ev("2026-01-01", "meetup"), ev("2026-01-21"), ev("2026-02-10")]), 20);
  });
});

describe("state thresholds", () => {
  it("maps ratios to states", () => {
    assert.equal(stateForRatio(0), "awake");
    assert.equal(stateForRatio(0.99), "awake");
    assert.equal(stateForRatio(1), "sleepy");
    assert.equal(stateForRatio(1.5), "sleepy");
    assert.equal(stateForRatio(1.51), "napping");
  });

  const tl = [ev("2026-01-01"), ev("2026-01-21"), ev("2026-02-10")]; // rhythm 20

  it("computes days since / rhythm", () => {
    assert.equal(sleepState(tl, "2026-02-20").state, "awake"); // 10/20
    assert.equal(sleepState(tl, "2026-03-04").state, "sleepy"); // 22/20
    assert.equal(sleepState(tl, "2026-03-25").state, "napping"); // 43/20
  });

  it("celebrates for 3 days after a meetup", () => {
    const withMeetup = [...tl, ev("2026-03-20", "meetup")];
    assert.equal(sleepState(withMeetup, "2026-03-20").state, "celebrating");
    assert.equal(sleepState(withMeetup, "2026-03-22").state, "celebrating");
    assert.equal(sleepState(withMeetup, "2026-03-23").state, "awake");
  });

  it("resting never changes", () => {
    assert.equal(sleepState(tl, "2030-01-01", { isResting: true }).state, "resting");
    assert.equal(sleepState([...tl, ev("2026-03-20", "meetup")], "2026-03-20", { isResting: true }).state, "resting");
  });

  it("ignores events after the demo date (time travel)", () => {
    assert.equal(sleepState([...tl, ev("2026-06-01")], "2026-03-25").state, "napping");
  });
});

describe("seeded cast on the demo date", () => {
  const today = "2026-11-14";
  const stateOf = (id: string) => {
    const f = FRIENDS.find((x) => x.id === id)!;
    return sleepState(buildTimeline({ friendId: id, chats: CHATS, gatherings: GATHERINGS, photos: PHOTOS, reactions: REACTIONS }), today, { isResting: f.isResting });
  };

  it("Maya is napping, last real chat in March 2026", () => {
    const s = stateOf("maya");
    assert.equal(s.state, "napping");
    assert.equal(s.lastTwoWayChat?.date, "2026-03-08");
  });
  it("Dev is sleepy", () => assert.equal(stateOf("dev").state, "sleepy"));
  it("Priya is awake", () => assert.equal(stateOf("priya").state, "awake"));
  it("Jess is awake (she texted about the Austin job in September)", () => assert.equal(stateOf("jess").state, "awake"));
  it("Alex is resting", () => assert.equal(stateOf("alex").state, "resting"));
});

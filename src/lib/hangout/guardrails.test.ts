import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findMoodHealthWord, nudgeGuard, statusGuard } from "./guardrails";
import type { Friend } from "./types";

const base: Friend = { id: "f", name: "F", avatarPhoto: "", isCloseCircle: true, isBlocked: false, isResting: false, isFriend: true, replies: [] };
const ok = { reason: "You two came here 9 times junior year." };

describe("status guard", () => {
  it("passes a close friend", () => assert.deepEqual(statusGuard(base), { ok: true }));
  it("drops blocked", () => assert.equal(statusGuard({ ...base, isBlocked: true }).ok, false));
  it("drops unfriended", () => assert.deepEqual(statusGuard({ ...base, isFriend: false }), { ok: false, reason: "unfriended" }));
  it("drops resting", () => assert.deepEqual(statusGuard({ ...base, isResting: true }), { ok: false, reason: "resting" }));
  it("drops people outside the close circle", () => assert.deepEqual(statusGuard({ ...base, isCloseCircle: false }), { ok: false, reason: "not_close_circle" }));
  it("drops unknown people", () => assert.equal(statusGuard(undefined).ok, false));
  it("blocked wins over everything", () => assert.deepEqual(statusGuard({ ...base, isBlocked: true, isResting: true }), { ok: false, reason: "blocked" }));
});

describe("nudge guard", () => {
  it("allows the first nudge of the day", () => assert.deepEqual(nudgeGuard(base, ok, [], "2026-11-14"), { ok: true }));
  it("caps at one nudge per day", () => {
    const r = nudgeGuard(base, ok, [{ createdAt: "2026-11-14" }], "2026-11-14");
    assert.equal(r.ok, false);
    assert.equal(!r.ok && r.reason, "daily_cap");
  });
  it("yesterday's nudge doesn't count", () => assert.deepEqual(nudgeGuard(base, ok, [{ createdAt: "2026-11-13" }], "2026-11-14"), { ok: true }));
  it("drops mood and health guesses", () => {
    for (const reason of ["Maya seems sad lately", "Dev might be lonely", "Jess is struggling with the move", "Chris was sick", "sounds like burned out"]) {
      const r = nudgeGuard(base, { reason }, [], "2026-11-14");
      assert.equal(!r.ok && r.reason, "mood_health_words", reason);
    }
  });
  it("doesn't flag innocent words that contain blocked ones", () => {
    assert.equal(findMoodHealthWord("Sadie's back at the pillow fort"), null);
    assert.equal(findMoodHealthWord("You two did the Illinois trip"), null);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CHATS, GATHERINGS, PHOTOS } from "@/data/hangout/seed";
import { buildEvidenceIndex, checkEvidence, sharedItems } from "./evidence";

const index = buildEvidenceIndex({ photos: PHOTOS, chats: CHATS, gatherings: GATHERINGS });

describe("evidence check", () => {
  it("accepts real shared photos", () => {
    assert.equal(checkEvidence({ evidenceIds: ["ph_maya_01", "ph_maya_07"], action: "send_photo", photoId: "ph_maya_07" }, "maya", index).ok, true);
  });
  it("rejects an injected fake ID", () => {
    const r = checkEvidence({ evidenceIds: ["ph_maya_01", "ph_fake_999"] }, "maya", index);
    assert.equal(r.ok, false);
    assert.deepEqual(!r.ok && r.badIds, ["ph_fake_999"]);
  });
  it("rejects evidence that belongs to another friend", () => {
    assert.equal(checkEvidence({ evidenceIds: ["ph_dev_01"] }, "maya", index).ok, false);
  });
  it("rejects an empty citation list", () => {
    assert.equal(checkEvidence({ evidenceIds: [] }, "maya", index).ok, false);
  });
  it("doesn't let the trigger post count as shared evidence", () => {
    assert.equal(checkEvidence({ evidenceIds: ["post_maya_ramen"] }, "maya", index, { triggerId: "post_maya_ramen" }).ok, false);
  });
  it("send_photo needs a cited photo", () => {
    assert.equal(checkEvidence({ evidenceIds: ["ph_maya_01"], action: "send_photo", photoId: "ph_maya_02" }, "maya", index).ok, false);
    assert.equal(checkEvidence({ evidenceIds: ["ph_maya_01"], action: "send_photo" }, "maya", index).ok, false);
  });
  it("chat snippets count for their own thread only", () => {
    const devChat = CHATS.find((c) => c.friendId === "dev")!.id;
    assert.equal(checkEvidence({ evidenceIds: [devChat] }, "dev", index).ok, true);
    assert.equal(checkEvidence({ evidenceIds: [devChat] }, "maya", index).ok, false);
  });
  it("shared items include the group photo for Sam but no blocked-friend items for others", () => {
    assert.ok(sharedItems(index, "sam").some((e) => e.id === "ph_runclub_01"));
    assert.ok(!sharedItems(index, "maya").some((e) => e.id.includes("jordan")));
  });
});

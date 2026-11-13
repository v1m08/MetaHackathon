import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import { GET as convRoute } from "@/app/api/conversations/[id]/route";
import { GET as eventDetailRoute } from "@/app/api/events/[id]/route";
import { GET as streakDetailRoute, POST as streakDetailPost } from "@/app/api/streaks/[friendId]/route";
import { GET as streaksRoute } from "@/app/api/streaks/route";
import { clearFeedbackSignals } from "@/lib/context";
import { streakDetail, streaksFor } from "@/lib/streaks/streaks";
import { resetDb, sendMessage } from "@/server/db";

function resetAll() {
  clearFeedbackSignals();
  resetDb();
}

test("Hangout streaks reflect all 6 critter states across Maya's Sidequest DM history", () => {
  resetAll();
  const view = streaksFor("maya");
  const byFriend = Object.fromEntries(view.friends.map((f) => [f.friendId, f]));

  // Sofia: 7d Sketch Off streak + Sofia drew today -> yourTurn (awake)
  assert.equal(byFriend.sofia.streak, 7);
  assert.equal(byFriend.sofia.status, "yourTurn");
  assert.equal(byFriend.sofia.state, "awake");

  // Ethan: 2d Ghost Run streak + Ethan raced today -> yourTurn (awake)
  assert.equal(byFriend.ethan.streak, 2);
  assert.equal(byFriend.ethan.status, "yourTurn");

  // Jordan: 3d Order Up! + Deep Cuts streak, neither played today yet -> atRisk (sleepy)
  assert.equal(byFriend.jordan.streak, 3);
  assert.equal(byFriend.jordan.status, "atRisk");
  assert.equal(byFriend.jordan.state, "sleepy");

  // Hannah: 3d Sketch Off streak + Maya played today -> theirTurn (awake)
  assert.equal(byFriend.hannah.streak, 3);
  assert.equal(byFriend.hannah.status, "theirTurn");

  // Aisha: 7d Deep Cuts streak, both played today -> done (celebrating)
  assert.equal(byFriend.aisha.streak, 7);
  assert.equal(byFriend.aisha.status, "done");
  assert.equal(byFriend.aisha.state, "celebrating");

  // Lucas: never played -> new (egg in nest)
  assert.equal(byFriend.lucas.streak, 0);
  assert.equal(byFriend.lucas.status, "new");
  assert.equal(byFriend.lucas.state, "egg");

  // Grace: played 4 days ago, missed since -> lost (resting in hammock)
  assert.equal(byFriend.grace.streak, 0);
  assert.equal(byFriend.grace.status, "lost");
  assert.equal(byFriend.grace.state, "resting");
});

test("playing a Sidequest game today in c_maya_jordan flips Jordan from atRisk (3d) -> theirTurn -> done (4d celebrating)", async () => {
  resetAll();
  const before = streakDetail("maya", "jordan");
  assert.equal(before.streak, 3);
  assert.equal(before.status, "atRisk");
  assert.equal(before.days.length, 14);
  assert.equal(before.days.at(-2)?.mark, "both", "yesterday had both Maya and Jordan");

  // Maya plays an Order Up! game today
  sendMessage("c_maya_jordan", "maya", "🎮 Order Up!: Burgers", { type: "sqgame", ref: "k:sqmjtd9" });
  sendMessage("c_maya_jordan", "maya", "played Bun Voyage · $212", { type: "sqgamelog", ref: "k:sqmjtd9" });

  const mid = streakDetail("maya", "jordan");
  assert.equal(mid.status, "theirTurn");
  assert.deepEqual(mid.today, { gameId: "k:sqmjtd9", me: true, them: false });

  // Jordan plays via POST /api/streaks/jordan { action: "friendPlays" }
  const req = new NextRequest("http://localhost/api/streaks/jordan", {
    method: "POST",
    headers: { "x-user-id": "maya", "content-type": "application/json" },
    body: JSON.stringify({ action: "friendPlays" }),
  });
  const res = await streakDetailPost(req, { params: Promise.resolve({ friendId: "jordan" }) });
  assert.equal(res.status, 200);
  const after = await res.json();
  assert.equal(after.streak, 4, "streak increments from 3 to 4 once both finish today");
  assert.equal(after.status, "done");
  assert.equal(after.state, "celebrating");
  assert.equal(after.days.at(-1)?.mark, "both");
});

test("in-thread chatContext and Event detail match callout expose streak + matched Event bridge", async () => {
  resetAll();
  const req = (url: string, user = "maya") => new NextRequest(url, { headers: { "x-user-id": user } });

  assert.equal((await streaksRoute(req("http://localhost/api/streaks"), { params: Promise.resolve({}) })).status, 200);
  assert.equal((await streakDetailRoute(req("http://localhost/api/streaks/sofia"), { params: Promise.resolve({ friendId: "sofia" }) })).status, 200);

  const thread = await (await convRoute(req("http://localhost/api/conversations/c_maya_jordan"), { params: Promise.resolve({ id: "c_maya_jordan" }) })).json();
  assert.equal(thread.chatContext.streakDays, 3);
  assert.equal(thread.chatContext.critterFriendId, "jordan");
  assert.ok(thread.chatContext.matchedEvent?.id, "Maya & Jordan cross the 60+ Event threshold and surface a matched Event bridge in-thread");

  const evDetail = await (await eventDetailRoute(req("http://localhost/api/events/e_trail_cleanup"), { params: Promise.resolve({ id: "e_trail_cleanup" }) })).json();
  assert.ok((evDetail.fit ?? 0) > 0.15);
  assert.equal(evDetail.shareTarget?.conversationId, "c_maya_jordan");
});

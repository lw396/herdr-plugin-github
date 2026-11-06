import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parseActivity, issueTimeline, activityText } from "../../src/github/core/activity.ts";

// Times and event ids from the real /issues/13/timeline capture.
test("simultaneous label changes form one row before assignment and later comments", () => {
  const events = parseActivity(JSON.parse(readFileSync(new URL("../fixtures/timeline-plugin-13.json", import.meta.url), "utf8")));
  const timeline = issueTimeline([
    { id: 6688056796, author: "lw396", createdAt: "2026-11-06T15:08:17Z", body: "Comment", reactions: [] },
  ], events);
  expect(timeline.map(item => item.type === "comment" ? `comment-${item.comment.id}` : `activity-${item.activity.id}`))
    .toEqual(["activity-35331262662", "activity-35356295613", "comment-6688056796"]);
  const first = timeline[0];
  expect(first?.type === "activity" && "labels" in first.activity ? first.activity.labels : null).toEqual([
    { name: "wayfinder:task", color: "#0e8a16" }, { name: "ready-for-agent", color: "#006b75" },
  ]);
  expect(activityText(events[2]!)).toBe("self-assigned this");
});

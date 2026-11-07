import { expect, test } from "bun:test";
import { parseChecks, pullTimeline } from "../../src/github/core/pull-timeline.ts";

test("merge comments and commits by time, omit unsupported events", () => {
	const items = pullTimeline(
		[],
		[
			{ event: "committed", sha: "abc", message: "Fix", author: { name: "A", date: "2026-01-01T00:00:00Z" } },
			{ event: "closed", id: 2, actor: { login: "B" }, created_at: "2026-01-02T00:00:00Z" },
		],
		[],
		[],
		"https://github.com/a/b/pull/1",
	);
	expect(items.map((x) => x.verb)).toEqual(["committed", "closed this"]);
	expect(items.map((x) => x.kind)).toEqual(["event", "event"]);
});
test("reviews carry inline code, replies and reactions, pending reviews are excluded", () => {
	const url = "https://github.com/a/b/pull/1";
	const items = pullTimeline(
		[],
		[],
		[
			{ id: 1, state: "APPROVED", submitted_at: "2026-01-01", user: { login: "reviewer" }, body: "Good" },
			{ id: 2, state: "PENDING", submitted_at: null },
			{ id: 3, state: "COMMENTED", submitted_at: "2026-01-02", user: { login: "author" }, body: "" },
		],
		[
			{
				id: 10,
				pull_request_review_id: 1,
				path: "a.ts",
				diff_hunk: "@@ -1 +1 @@\n-old\n+new",
				body: "Fix",
				created_at: "2026-01-01",
				user: { login: "reviewer" },
				reactions: { "+1": 2 },
			},
			{
				id: 11,
				pull_request_review_id: 3,
				in_reply_to_id: 10,
				path: "a.ts",
				body: "Done",
				created_at: "2026-01-02",
				user: { login: "author" },
			},
		],
		url,
	);
	expect(items).toHaveLength(1);
	expect(items[0]?.kind).toBe("review");
	expect(items[0]?.discussion.map((d) => d.root)).toEqual([10, 10]);
	expect(items[0]?.discussion.map((d) => [d.comment.body, d.snippet, d.comment.reactions])).toEqual([
		["Fix", "@@ -1 +1 @@\n-old\n+new", [{ emoji: "👍", count: 2 }]],
		["Done", "", []],
	]);
});

test("label, assignment, force-push and merge events sort together, without duplicate comments or reviews", () => {
	const items = pullTimeline(
		[],
		[
			{ id: 4, event: "merged", created_at: "2026-01-04", actor: { login: "owner" }, commit_id: "123456789" },
			{ id: 2, event: "assigned", created_at: "2026-01-02", actor: { login: "owner" }, assignee: { login: "dev" } },
			{ id: 1, event: "labeled", created_at: "2026-01-01", actor: { login: "owner" }, label: { name: "ready" } },
			{
				id: 3,
				event: "head_ref_force_pushed",
				created_at: "2026-01-03",
				actor: { login: "dev" },
				commit_id: "abcdefghi",
			},
			{ id: 5, event: "commented", created_at: "2026-01-05" },
			{ id: 6, event: "reviewed", created_at: "2026-01-06" },
		],
		[],
		[],
		"https://github.com/a/b/pull/1",
	);
	expect(items.map((x) => [x.verb, x.body])).toEqual([
		["added", "ready"],
		["assigned dev", ""],
		["force-pushed the branch", "abcdefg"],
		["merged this", "1234567"],
	]);
});

test("checks include duration and browser target", () => {
	expect(
		parseChecks(
			[
				{
					check_runs: [
						{
							id: 1,
							name: "test",
							status: "completed",
							conclusion: "success",
							started_at: "2026-01-01T00:00:00Z",
							completed_at: "2026-01-01T00:01:05Z",
							html_url: "https://github.com/a/b/actions/runs/1",
						},
					],
				},
			],
			[],
		),
	).toEqual([
		{ id: "check-1", name: "test", status: "success", duration: "1m 5s", url: "https://github.com/a/b/actions/runs/1" },
	]);
});

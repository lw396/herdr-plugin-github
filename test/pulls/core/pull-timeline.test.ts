import { expect, test } from "bun:test";
import { pullTimeline, timelineKey } from "../../../src/github/pulls/core/pull-timeline.ts";

test("commit activity shows only its subject and keeps multiline details available separately", () => {
	const [commit] = pullTimeline(
		[],
		[
			{
				event: "committed",
				sha: "1f7e702abcdef",
				author: { name: "pi-agent-action[bot]", date: "2026-01-01T00:00:00Z" },
				message:
					"Add PR merge confirmation and remote branch deletion\r\n\r\nRefs #33.\r\n\r\nCo-authored-by: Valian <dev@example.com>",
			},
		],
		[],
		[],
		"https://github.com/a/b/pull/39",
	);
	expect(commit?.body).toBe("1f7e702 Add PR merge confirmation and remote branch deletion");
	expect(commit?.markdown).not.toContain("Co-authored-by");
	expect(commit?.details).toEqual({
		body: "Refs #33.\n\nCo-authored-by: Valian <dev@example.com>",
		markdown: "Refs [#33](<https://github.com/a/b/issues/33>).\n\nCo-authored-by: Valian <dev@example.com>",
	});
});

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
	expect(items[0]).toMatchObject({ body: "abc Fix", markdown: "abc Fix" });
	expect(items[0]?.details).toBeUndefined();
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
		["added", ""],
		["assigned dev", ""],
		["force-pushed the branch", "abcdefg"],
		["merged this", "1234567"],
	]);
});

test("label events show colored labels, grouped per person and second like GitHub's timeline", () => {
	// cli/cli#13340: the triage bot's label changes, two seconds apart.
	const bot = { login: "github-actions[bot]" };
	const label = (id: number, event: string, created_at: string, name: string, color: string) => ({
		id,
		event,
		created_at,
		actor: bot,
		label: { name, color },
	});
	const items = pullTimeline(
		[],
		[
			label(1, "labeled", "2026-05-04T05:10:11Z", "external", "2700AF"),
			label(2, "labeled", "2026-05-04T05:10:11Z", "needs-triage", "D6393F"),
			label(3, "labeled", "2026-05-04T05:10:13Z", "unmet-requirements", "ee2329"),
			label(4, "unlabeled", "2026-05-04T05:10:13Z", "needs-triage", "D6393F"),
		],
		[],
		[],
		"https://github.com/cli/cli/pull/13340",
	);
	expect(items.map((x) => [x.verb, x.body, x.labels?.map((l) => `${l.name} ${l.color}`)])).toEqual([
		["added", "", ["external #2700af", "needs-triage #d6393f"]],
		["added", "", ["unmet-requirements #ee2329"]],
		["removed", "", ["needs-triage #d6393f"]],
	]);
});

test("commit identities survive inserted activity and distinguish identical messages on different SHAs", () => {
	const commit = {
		event: "committed",
		sha: "aaaaaaa",
		message: "Same subject",
		author: { name: "author", date: "2026-01-01T00:00:00Z" },
	};
	const url = "https://github.com/o/r/pull/1";
	const before = pullTimeline([], [commit], [], [], url)[0]!;
	const after = pullTimeline(
		[],
		[{ event: "closed", id: 5, created_at: "2025-01-01T00:00:00Z" }, commit, { ...commit, sha: "bbbbbbb" }],
		[],
		[],
		url,
	);
	expect(after.map(timelineKey)).toContain(timelineKey(before));
	expect(new Set(after.map(timelineKey)).size).toBe(3);
});

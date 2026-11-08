import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { type PullReplies, parsePullDetail } from "../../../src/github/pulls/core/pull-detail.ts";

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../../fixtures/${name}`, import.meta.url), "utf8"));
const replies = (pull: unknown, more: Partial<PullReplies> = {}): PullReplies => ({
	pull,
	issue: { reactions: {} },
	repository: {},
	comments: [],
	reviews: [],
	events: [],
	inline: [],
	checkRuns: { check_runs: [] },
	statuses: [],
	...more,
});
const parse = (name: string) => parsePullDetail(replies(fixture(name)));

test("ready, draft, closed and merged PRs have distinct states", () => {
	expect(parse("pull-plugin-35.json")).toMatchObject({
		state: "open",
		head: "test/pr-fixture-a",
		headSha: "63f52f1dddd87eecbe02a9013523124921ee4345",
		base: "master",
	});
	expect(parse("pull-plugin-36.json").state).toBe("draft");
	expect(parse("pull-cli-14974.json").state).toBe("closed");
	expect(parse("pull-cli-14976.json").state).toBe("merged");
});

test("PR Markdown keeps images as browser links, references as issue links, and both post reaction counts", () => {
	const pull = fixture("pull-plugin-35.json");
	pull.body =
		"See #25 and [another PR](https://github.com/lw396/herdr-plugin-github/pull/36). ![screenshot](https://example.com/a.png)";
	pull.assignees = [{ login: "lw396" }];
	pull.milestone = { title: "First review" };
	const comment = {
		id: 100,
		user: null,
		created_at: "2026-11-07T12:00:00Z",
		body: "![image](a.png)",
		reactions: { heart: 2, "+1": 0 },
	};
	const parsed = parsePullDetail(replies(pull, { issue: { reactions: { "+1": 3 } }, comments: [comment] }));
	expect(parsed.markdown).toContain("[#25](<https://github.com/lw396/herdr-plugin-github/issues/25>)");
	expect(parsed.markdown).toContain("[🖼 图片](<https://example.com/a.png>)");
	expect(parsed.reactions).toEqual([{ emoji: "👍", count: 3 }]);
	expect(parsed.timeline[0]).toMatchObject({
		verb: "commented",
		author: "deleted user",
		markdown: "[🖼 图片](<a.png>)",
		reactions: [{ emoji: "❤️", count: 2 }],
	});
	expect(parsed).toMatchObject({ assignees: ["lw396"], milestone: "First review" });
});

test("as in the VS Code extension, the latest submitted review wins and re-requests override it", () => {
	// Specification-shaped review sequence; all states and fields are from the REST reviews endpoint.
	const pull = fixture("pull-plugin-35.json");
	pull.requested_reviewers = [{ login: "again" }];
	pull.requested_teams = [{ slug: "maintainers" }];
	const reviews = [
		{ id: 1, user: { login: "approved" }, state: "APPROVED", submitted_at: "2026-11-07T12:00:00Z" },
		{ id: 2, user: { login: "approved" }, state: "COMMENTED", submitted_at: "2026-11-07T13:00:00Z" },
		{ id: 3, user: { login: "again" }, state: "CHANGES_REQUESTED", submitted_at: "2026-11-07T12:00:00Z" },
		{ id: 4, user: { login: "dismissed" }, state: "DISMISSED", submitted_at: "2026-11-07T12:00:00Z" },
		{ id: 5, user: { login: "private" }, state: "PENDING", submitted_at: null },
		{ id: 6, user: { login: "lw396" }, state: "COMMENTED", submitted_at: "2026-11-07T14:00:00Z" },
	];
	expect(parsePullDetail(replies(pull, { reviews })).reviewers).toEqual([
		{ name: "approved", state: "commented", team: false },
		{ name: "dismissed", state: "dismissed", team: false },
		{ name: "again", state: "requested", team: false },
		{ name: "maintainers", state: "requested", team: true },
	]);
});

test("branch protection names the reviews and checks that can block the merge", () => {
	const pull = {
		...fixture("pull-plugin-35.json"),
		mergeable: false,
		mergeable_state: "blocked",
		requested_reviewers: [],
	};
	const reviews = [{ id: 1, user: { login: "r" }, state: "CHANGES_REQUESTED", submitted_at: "2026-11-07T12:00:00Z" }];
	const checkRuns = { check_runs: [{ id: 1, name: "CI", status: "in_progress", conclusion: null, html_url: "" }] };
	expect(parsePullDetail(replies(pull, { reviews, checkRuns })).merge.reason).toBe(
		"Merging is blocked by branch protection rules (required checks or reviews): Changes requested; Checks have not passed",
	);
	expect(parsePullDetail(replies(pull)).merge.reason).toBe(
		"Merging is blocked by branch protection rules (required checks or reviews)",
	);
});

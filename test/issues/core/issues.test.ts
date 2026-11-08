// Issue groups: the GraphQL query, and its `data` turned into the sidebar's rows.
// Replies are real gh 2.96 output (`gh api graphql`), 2026-11-06.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { applyChange, issueGroupQuery, parseIssueGroup } from "../../../src/github/issues/core/issues.ts";
import { appendPage } from "../../../src/github/sidebar/core/page.ts";

/** A real reply saved from gh (test/fixtures), as `data`. */
const fixtureData = (name: string): unknown =>
	JSON.parse(readFileSync(join(import.meta.dir, "../../fixtures", name), "utf8")).data;

const MINE = {
	repository: {
		hasIssuesEnabled: true,
		issues: {
			totalCount: 1,
			pageInfo: { hasNextPage: false, endCursor: "Y3Vyc29yOnYyOpK0MjAyNi0xMS0wNlQxMzowMToxM1rPAAAAAXPrZ54=" },
			nodes: [
				{
					number: 11,
					title: 'Issues 标签页："指派给我的"一组',
					updatedAt: "2026-11-06T13:01:13Z",
					url: "https://github.com/lw396/herdr-plugin-github/issues/11",
					assignees: { nodes: [{ login: "lw396" }] },
				},
			],
		},
	},
};

const LINUX = {
	repository: {
		hasIssuesEnabled: false,
		issues: { totalCount: 0, pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] },
	},
};

describe("issueGroupQuery: the page of a group gh asks GitHub for (the replies in test/fixtures answered these)", () => {
	const REMOTE = { remote: "origin", host: "github.com", owner: "lw396", repo: "herdr-plugin-github" };
	const issuesArgs = (q: string) => /issues\(([^)]*)\)/.exec(q)?.[1];

	test("Assigned: open, filtered by the gh account's login", () => {
		const { query, variables } = issueGroupQuery("assigned", REMOTE, "lw396", null);
		expect(issuesArgs(query)).toBe(
			"first: 30, after: $after, states: OPEN, filterBy: {assignee: $assignee}, orderBy: {field: UPDATED_AT, direction: DESC}",
		);
		expect(variables).toEqual({ owner: "lw396", name: "herdr-plugin-github", after: null, assignee: "lw396" });
	});

	test("Open and Closed: every open or closed issue, not filtered by assignee", () => {
		const open = issueGroupQuery("open", REMOTE, "lw396", null);
		expect(issuesArgs(open.query)).toBe(
			"first: 30, after: $after, states: OPEN, orderBy: {field: UPDATED_AT, direction: DESC}",
		);
		expect(open.variables).toEqual({ owner: "lw396", name: "herdr-plugin-github", after: null });
		expect(issuesArgs(issueGroupQuery("closed", REMOTE, "lw396", null).query)).toBe(
			"first: 30, after: $after, states: CLOSED, orderBy: {field: UPDATED_AT, direction: DESC}",
		);
	});

	test("the next page starts after the last one's end cursor", () => {
		expect(issueGroupQuery("open", REMOTE, "lw396", "Y3Vyc29y").variables).toMatchObject({ after: "Y3Vyc29y" });
	});
});

describe("parseIssueGroup", () => {
	test("rows: number, title, assignees, when updated, link", () => {
		expect(parseIssueGroup(MINE)).toEqual({
			issuesEnabled: true,
			total: 1,
			more: false,
			cursor: "Y3Vyc29yOnYyOpK0MjAyNi0xMS0wNlQxMzowMToxM1rPAAAAAXPrZ54=",
			rows: [
				{
					number: 11,
					title: 'Issues 标签页："指派给我的"一组',
					assignees: ["lw396"],
					updatedAt: "2026-11-06T13:01:13Z",
					url: "https://github.com/lw396/herdr-plugin-github/issues/11",
				},
			],
		});
	});

	test("Issues turned off (torvalds/linux): no rows, and says so", () => {
		expect(parseIssueGroup(LINUX)).toEqual({ issuesEnabled: false, total: 0, more: false, cursor: null, rows: [] });
	});
});

describe("appendPage: Load more", () => {
	const first = parseIssueGroup(fixtureData("open-cli-1.json"));
	const second = parseIssueGroup(fixtureData("open-cli-2.json"));

	test("the next page's rows follow the loaded ones; where the next page starts comes from it", () => {
		const both = appendPage(first, second);
		expect(both.rows).toHaveLength(60);
		expect(both.rows.slice(28, 32).map((i) => i.number)).toEqual([
			...first.rows.slice(28).map((i) => i.number),
			14895,
			14856,
		]);
		expect(both).toMatchObject({
			total: 1058,
			more: true,
			cursor: "Y3Vyc29yOnYyOpK0MjAyNi0xMC0yNVQxNToxNzozNVrPAAAAAS_2QAQ=",
		});
	});

	test("an issue updated between the two loads, in both pages: shown once, where it was", () => {
		const moved = { ...second, rows: [first.rows[3]!, ...second.rows] };
		const both = appendPage(first, moved);
		expect(both.rows).toHaveLength(60);
		expect(both.rows.filter((i) => i.number === 14615)).toHaveLength(1);
	});
});

describe("applyChange: a group after an issue was closed or reopened in a reader", () => {
	const row = (number: number, assignees: string[] = [], updatedAt = "2026-11-01T00:00:00Z") => ({
		number,
		title: `issue ${number}`,
		assignees,
		updatedAt,
		url: `https://github.com/o/r/issues/${number}`,
	});
	const group = (total: number, ...issues: ReturnType<typeof row>[]) => ({
		issuesEnabled: true,
		total,
		more: true,
		cursor: "c",
		rows: issues,
	});
	const closed20 = { repo: "o/r", state: "closed" as const, issue: row(20, ["lw396"], "2026-11-06T18:23:20Z") };
	const reopened20 = { repo: "o/r", state: "open" as const, issue: row(20, ["lw396"], "2026-11-06T18:23:21Z") };

	test("closed: it leaves Assigned and Open, one fewer each, and heads Closed, one more", () => {
		expect(applyChange("assigned", group(42, row(1), row(20, ["lw396"])), closed20, "lw396")).toEqual(
			group(41, row(1)),
		);
		expect(applyChange("open", group(42, row(20, ["lw396"]), row(2)), closed20, "lw396")).toEqual(group(41, row(2)));
		expect(applyChange("closed", group(41, row(3)), closed20, "lw396")).toEqual(group(42, closed20.issue, row(3)));
	});

	test("reopened: it leaves Closed, heads Open, and heads Assigned only when assigned to this login", () => {
		expect(applyChange("closed", group(42, row(20), row(3)), reopened20, "lw396")).toEqual(group(41, row(3)));
		expect(applyChange("open", group(41, row(2)), reopened20, "lw396")).toEqual(group(42, reopened20.issue, row(2)));
		expect(applyChange("assigned", group(41, row(1)), reopened20, "LW396")).toEqual(
			group(42, reopened20.issue, row(1)),
		);
		expect(applyChange("assigned", group(41, row(1)), reopened20, "someone")).toEqual(group(41, row(1)));
	});

	test("applied twice, or already shown where it belongs: nothing more changes", () => {
		const once = applyChange("closed", group(41, row(3)), closed20, "lw396");
		expect(applyChange("closed", once, closed20, "lw396")).toEqual(once);
		// Not among the loaded rows (a later page): the next load corrects the count.
		expect(applyChange("open", group(41, row(2)), closed20, "lw396")).toEqual(group(41, row(2)));
	});
});

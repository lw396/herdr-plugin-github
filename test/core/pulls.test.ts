// Pull Requests rows from real `gh api graphql` replies (gh 2.96 on center, 2026-11-07):
// lw396/herdr-plugin-github#35 (ready) and #36 (draft) are test PRs; cli/cli has two pages of open PRs.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	appendPullPage,
	localPullRequest,
	parseLocalPulls,
	parsePullGroup,
	pullSearch,
} from "../../src/github/core/pulls.ts";

const data = (name: string): unknown =>
	(JSON.parse(readFileSync(join(import.meta.dir, "../fixtures", name), "utf8")) as { data: unknown }).data;

test("a draft and a ready PR as rows: state, author and where they open", () => {
	expect(parsePullGroup(data("pulls-all-plugin.json"))).toEqual({
		total: 2,
		more: false,
		cursor: "Y3Vyc29yOnYyOpK0MjAyNi0xMS0wN1QwODo0MTowMlrPAAAAATXxBLM=",
		pulls: [
			{
				number: 36,
				title: "测试用，可删：draft PR fixture",
				author: "lw396",
				state: "draft",
				updatedAt: "2026-11-07T08:41:05Z",
				url: "https://github.com/lw396/herdr-plugin-github/pull/36",
			},
			{
				number: 35,
				title: "测试用，可删：PR fixture",
				author: "lw396",
				state: "open",
				updatedAt: "2026-11-07T08:41:02Z",
				url: "https://github.com/lw396/herdr-plugin-github/pull/35",
			},
		],
	});
});

test("Load more appends the next page; a PR that moved up between loads is not shown twice", () => {
	const first = parsePullGroup(data("pulls-all-cli-1.json"));
	const second = parsePullGroup(data("pulls-all-cli-2.json"));
	expect(first).toMatchObject({ total: 59, more: true });
	const both = appendPullPage(first, second);
	expect(both.pulls).toHaveLength(59);
	expect(both.more).toBe(false);
	const again = appendPullPage(first, { ...second, pulls: [first.pulls[0]!, ...second.pulls] });
	expect(again.pulls).toHaveLength(59);
});

test("Waiting For My Review and Created By Me search the repository's open PRs for the gh account, newest update first", () => {
	const r = { remote: "upstream", host: "github.com", owner: "cli", repo: "cli" };
	expect(pullSearch("review", r, "babakks")).toBe(
		"repo:cli/cli is:pr is:open review-requested:babakks sort:updated-desc",
	);
	expect(pullSearch("mine", r, "lw396")).toBe("repo:cli/cli is:pr is:open author:lw396 sort:updated-desc");
});

test("local branch names are GraphQL variables, never query syntax, and include every PR state", () => {
	const request = localPullRequest(
		{ remote: "origin", host: "github.com", owner: "lw396", repo: "herdr-plugin-github" },
		['topic/"quoted"', "fix/$branch"],
	);
	expect(request.variables).toEqual({
		owner: "lw396",
		name: "herdr-plugin-github",
		branch0: 'topic/"quoted"',
		branch1: "fix/$branch",
	});
	expect(request.query).toContain("branch0: pullRequests(");
	expect(request.query).toContain("branch1: pullRequests(");
	expect(request.query).not.toContain('topic/"quoted"');
	expect(request.query).toContain("states: [OPEN, CLOSED, MERGED]");
});

test("local matches omit empty branches and sort matching heads by update", () => {
	expect(
		parseLocalPulls(data("pulls-local-plugin.json"), {
			remote: "origin",
			host: "github.com",
			owner: "LW396",
			repo: "HERDR-PLUGIN-GITHUB",
		}).pulls.map((p) => p.number),
	).toEqual([36, 35]);
	expect(
		parseLocalPulls(data("pulls-local-plugin.json"), {
			remote: "origin",
			host: "github.com",
			owner: "other",
			repo: "herdr-plugin-github",
		}).pulls,
	).toEqual([]);
});

test("a search reply parses into the same rows as a repository list", () => {
	expect(parsePullGroup(data("pulls-mine-plugin.json"))).toMatchObject({
		total: 2,
		more: false,
		pulls: [
			{ number: 36, state: "draft", author: "lw396" },
			{ number: 35, state: "open", author: "lw396" },
		],
	});
});

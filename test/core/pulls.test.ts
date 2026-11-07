// Pull Requests rows from real `gh api graphql` replies (gh 2.96 on center, 2026-11-07):
// lw396/herdr-plugin-github#35 (ready) and #36 (draft) are test PRs; cli/cli has two pages of open PRs.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { appendPullPage, parsePullGroup } from "../../src/github/core/pulls.ts";

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

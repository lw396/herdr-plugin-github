import { expect, test } from "bun:test";
import * as detail from "../../../src/github/detail/core/detail.ts";
import * as markdown from "../../../src/github/detail/core/markdown.ts";

test("links classify same-repository PRs and issues, never another repository or unsafe URL", () => {
	const base = "https://github.com/o/r/pull/35";
	expect(markdown.detailLink("https://github.com/O/R/pull/36#discussion-1", base)).toEqual({
		kind: "pr",
		repo: "o/r",
		number: 36,
	});
	expect(markdown.detailLink("../issues/25", base)).toEqual({ kind: "issue", repo: "o/r", number: 25 });
	expect(markdown.detailLink("https://github.com/other/r/pull/36", base)).toBeNull();
	expect(markdown.detailLink("javascript:alert(1)", base)).toBeNull();
});

test("one tab can follow PR → issue → PR, go Back across kinds, and reset history on a sidebar open", () => {
	const navigation = new detail.DetailNavigation();
	const first = { kind: "pr", repo: "o/r", number: 35 } as const;
	const issue = { kind: "issue", repo: "o/r", number: 25 } as const;
	const next = { kind: "pr", repo: "o/r", number: 36 } as const;
	expect(navigation.ref).toBeNull();
	navigation.open(first);
	navigation.follow(issue);
	navigation.follow(next);
	expect(navigation.previous).toEqual(issue);
	expect(navigation.back()).toEqual(issue);
	expect(navigation.back()).toEqual(first);
	expect(navigation.back()).toBeNull();
	navigation.follow(issue);
	navigation.open(next);
	expect(navigation.previous).toBeNull();
	expect(navigation.ref).toEqual(next);
});

import { expect, test } from "bun:test";
import { parsePatch } from "../../src/github/core/diff.ts";
import { mergeDraftThreads, parseThreads, threadRow } from "../../src/github/core/review-threads.ts";
import drafts from "../fixtures/pull-plugin-35-review-comments.json";

test("private pending-review comments join their diff thread and are marked as drafts", () => {
	const result = parseThreads(
		[
			{
				id: "thread",
				path: "docs/pr-fixture.md",
				diffSide: "RIGHT",
				line: 2,
				isOutdated: false,
				isResolved: false,
				viewerCanResolve: false,
				viewerCanUnresolve: false,
				comments: { nodes: [{ databaseId: 4504980203 }] },
			},
		],
		[],
		"https://github.com/lw396/herdr-plugin-github/pull/35",
		drafts.flat(),
	);
	expect(result[0]?.comments).toMatchObject([{ id: 4504980203, author: "lw396", draft: true }]);
});

test("an acknowledged draft reply joins its existing conversation without duplicating the thread", () => {
	const thread = parseThreads(
		[
			{
				id: "thread",
				path: "file",
				diffSide: "RIGHT",
				line: 2,
				isOutdated: false,
				isResolved: false,
				viewerCanResolve: false,
				viewerCanUnresolve: false,
				comments: { nodes: [{ databaseId: 4504980203 }] },
			},
		],
		drafts.flat(),
		"https://github.com/lw396/herdr-plugin-github/pull/35",
	)[0]!;
	const reply = { ...thread.comments[0]!, id: 1, draft: true, body: "Reply" };
	expect(mergeDraftThreads([thread], [{ ...thread, comments: [reply] }])).toEqual([
		{ ...thread, comments: [...thread.comments, reply] },
	]);
	expect(
		mergeDraftThreads([{ ...thread, comments: [...thread.comments, reply] }], [{ ...thread, comments: [reply] }]),
	).toHaveLength(1);
});

test("threads attach by side and current line, including LEFT context; outdated and missing lines stay unplaced", () => {
	const rows = parsePatch("@@ -7,2 +7,2 @@\n same\n-old\n+new");
	expect(threadRow(rows, { side: "LEFT", line: 7, outdated: false })).toBe(1);
	expect(threadRow(rows, { side: "RIGHT", line: 7, outdated: false })).toBe(1);
	expect(threadRow(rows, { side: "LEFT", line: 8, outdated: false })).toBe(2);
	expect(threadRow(rows, { side: "RIGHT", line: 8, outdated: false })).toBe(3);
	expect(threadRow(rows, { side: "RIGHT", line: 9, outdated: false })).toBeNull();
	expect(threadRow(rows, { side: "RIGHT", line: null, outdated: true })).toBeNull();
	expect(threadRow(rows, { side: "RIGHT", line: 8, outdated: true })).toBeNull();
});

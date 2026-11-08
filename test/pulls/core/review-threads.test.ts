import { expect, test } from "bun:test";
import { parsePatch } from "../../../src/github/pulls/core/diff.ts";
import { parseThreads, threadRow } from "../../../src/github/pulls/core/review-threads.ts";
import drafts from "../../fixtures/pull-plugin-35-review-comments.json";

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

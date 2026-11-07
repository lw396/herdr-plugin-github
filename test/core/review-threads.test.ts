import { expect, test } from "bun:test";
import { parsePatch } from "../../src/github/core/diff.ts";
import { threadRow } from "../../src/github/core/review-threads.ts";

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

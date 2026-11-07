import { expect, test } from "bun:test";
import { parsePatch } from "../../src/github/core/diff.ts";
import files from "../fixtures/pull-plugin-35-files.json";

test("new and deleted files start on the correct side, including zero-length hunk ranges", () => {
	const added = parsePatch((files[2]![0]! as { patch: string }).patch);
	expect(added.slice(1).map((r) => [r.oldLine, r.newLine, r.comment])).toEqual([
		[null, 1, { side: "RIGHT", line: 1 }],
		[null, 2, { side: "RIGHT", line: 2 }],
		[null, 3, { side: "RIGHT", line: 3 }],
	]);
	const removed = parsePatch((files[1]![0]! as { patch: string }).patch);
	expect(removed.slice(1).map((r) => r.comment)).toEqual([
		{ side: "LEFT", line: 1 },
		{ side: "LEFT", line: 2 },
		{ side: "LEFT", line: 3 },
		{ side: "LEFT", line: 4 },
		{ side: "LEFT", line: 5 },
	]);
});

test("replacement lines target opposite sides and no-newline markers are never commentable", () => {
	const rows = parsePatch(
		"@@ -4 +4 @@ function f()\n-old\n\\ No newline at end of file\n+new\n\\ No newline at end of file\n",
	);
	expect(rows.map((r) => [r.kind, r.oldLine, r.newLine, r.comment])).toEqual([
		["hunk", null, null, null],
		["delete", 4, null, { side: "LEFT", line: 4 }],
		["notice", null, null, null],
		["add", null, 4, { side: "RIGHT", line: 4 }],
		["notice", null, null, null],
	]);
	expect(parsePatch("")).toEqual([]);
	expect(parsePatch("+outside a hunk")).toEqual([]);
});

test("a real multi-hunk patch keeps old/new line numbers and GitHub comment targets", () => {
	const rows = parsePatch((files[3]![0]! as { patch: string }).patch);
	expect(rows.slice(0, 4)).toEqual([
		{ kind: "hunk", text: "@@ -1,4 +1,5 @@", oldLine: null, newLine: null, comment: null },
		{
			kind: "context",
			text: "// Times as the sidebar shows them.",
			oldLine: 1,
			newLine: 1,
			comment: { side: "RIGHT", line: 1 },
		},
		{
			kind: "add",
			text: "// PR fixture: an added line near the top.",
			oldLine: null,
			newLine: 2,
			comment: { side: "RIGHT", line: 2 },
		},
		{ kind: "context", text: "", oldLine: 2, newLine: 3, comment: { side: "RIGHT", line: 3 } },
	]);
	expect(rows.slice(-2)).toEqual([
		{
			kind: "add",
			text: "// PR fixture: a line added at the end.",
			oldLine: null,
			newLine: 19,
			comment: { side: "RIGHT", line: 19 },
		},
		{ kind: "notice", text: "\\ No newline at end of file", oldLine: null, newLine: null, comment: null },
	]);
});

import { expect, test } from "bun:test";
import { commentTarget, parsePatch } from "../../../src/github/pulls/core/diff.ts";
import pages from "../../fixtures/pull-plugin-35-files.json";

test("either context gutter targets its own side; headers and notices cannot open a composer", () => {
	const rows = parsePatch("@@ -4,2 +9,2 @@\n same\n-old\n+new\n\\ No newline at end of file");
	expect(commentTarget(rows[1]!, "LEFT")).toEqual({ side: "LEFT", line: 4 });
	expect(commentTarget(rows[1]!, "RIGHT")).toEqual({ side: "RIGHT", line: 9 });
	expect(commentTarget(rows[2]!, "RIGHT")).toBeNull();
	expect(commentTarget(rows[3]!, "LEFT")).toBeNull();
	expect(commentTarget(rows[0]!, "LEFT")).toBeNull();
	expect(commentTarget(rows[4]!, "RIGHT")).toBeNull();
});

function patch(path: string): string {
	const file = pages.flat().find((f) => f.filename === path);
	if (!file || !("patch" in file) || typeof file.patch !== "string")
		throw new Error(`Fixture has no patch for ${path}`);
	return file.patch;
}

test("new and deleted files start on the correct side, including zero-length hunk ranges", () => {
	const added = parsePatch(patch("docs/pr-fixture.md"));
	expect(added.slice(1).map((r) => [r.oldLine, r.newLine, r.comment])).toEqual([
		[null, 1, { side: "RIGHT", line: 1 }],
		[null, 2, { side: "RIGHT", line: 2 }],
		[null, 3, { side: "RIGHT", line: 3 }],
	]);
	const removed = parsePatch(patch("docs/adr/0006-poll-with-conditional-requests.md"));
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
	const rows = parsePatch(patch("src/github/core/time.ts"));
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

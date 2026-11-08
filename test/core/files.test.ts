import { expect, test } from "bun:test";
import { fileTree, flatFiles, parseFiles } from "../../src/github/core/files.ts";
import pages from "../fixtures/pull-plugin-35-files.json";

const files = parseFiles(pages.flat());

test("hiding viewed files removes empty directories in both layouts without changing the source", () => {
	const marked = files.map((f) => ({ ...f, viewed: f.path !== "src/github/core/time.ts" }));
	expect(flatFiles(marked, true).map((n) => n.path)).toEqual(["src/github/core/time.ts"]);
	expect(fileTree(marked, true)).toMatchObject([
		{ kind: "directory", name: "src/github/core", children: [{ kind: "file", name: "time.ts" }] },
	]);
	expect(flatFiles(marked)).toHaveLength(4);
	expect(
		fileTree(
			marked.map((f) => ({ ...f, viewed: true })),
			true,
		),
	).toEqual([]);
});

test("directory trees merge single-child folders without swallowing the filename", () => {
	const tree = fileTree(files);
	expect(tree.map((n) => [n.kind, n.name, n.path])).toEqual([
		["directory", "docs", "docs"],
		["directory", "src/github/core", "src/github/core"],
	]);
	if (tree[0]?.kind !== "directory" || tree[1]?.kind !== "directory") throw new Error("expected folders");
	expect(tree[0].children.map((n) => [n.kind, n.name])).toEqual([
		["directory", "adr"],
		["file", "pr-fixture.md"],
	]);
	expect(tree[1].children[0]).toMatchObject({ kind: "file", name: "time.ts", file: { status: "modified" } });
});

test("flat lists show paths, preserve rename details, and do not mutate the API order", () => {
	const reversed = [...files].reverse();
	expect(flatFiles(reversed).map((n) => n.name)).toEqual([
		"docs/adr/0005-one-repository-renamed.md",
		"docs/adr/0006-poll-with-conditional-requests.md",
		"docs/pr-fixture.md",
		"src/github/core/time.ts",
	]);
	expect(reversed[0]?.path).toBe("src/github/core/time.ts");
	expect(flatFiles(files)[0]?.file.previousPath).toBe("docs/adr/0005-one-repository.md");
});

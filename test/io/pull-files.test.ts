// gh api pulls/35/files, captured 2026-11-07 with per_page=1 to record real pagination.
import { afterEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { readPullFiles } from "../../src/github/io/pulls.ts";
import { machine, reset } from "../fake-herdr.ts";

afterEach(reset);
const stdout = readFileSync(new URL("../fixtures/pull-plugin-35-files.json", import.meta.url), "utf8");
const command = "~$ gh api repos/lw396/herdr-plugin-github/pulls/35/files?per_page=100 --paginate --slurp";

test("a missing remote gh never falls back to local changed files", async () => {
	machine("center", {});
	machine(null, { [command]: { stdout } });
	await expect(readPullFiles("lw396/herdr-plugin-github", 35, "center")).rejects.toThrow("cannot start gh");
});

test("a failed page read is an error rather than an empty file list", async () => {
	machine("center", { [command]: { code: 1, stderr: "gh: Not Found (HTTP 404)" } });
	await expect(readPullFiles("lw396/herdr-plugin-github", 35, "center")).rejects.toMatchObject({ notFound: true });
});

test("all changed-file pages are read on the PR machine, including a rename with no patch", async () => {
	machine("center", { [command]: { stdout } });
	const files = await readPullFiles("lw396/herdr-plugin-github", 35, "center");
	expect(files.map((f) => [f.path, f.status, f.previousPath])).toEqual([
		["docs/adr/0005-one-repository-renamed.md", "renamed", "docs/adr/0005-one-repository.md"],
		["docs/adr/0006-poll-with-conditional-requests.md", "removed", null],
		["docs/pr-fixture.md", "added", null],
		["src/github/core/time.ts", "modified", null],
	]);
	expect(files[0]).toMatchObject({ patch: null, additions: 0, deletions: 0 });
	expect(files[2]).toMatchObject({
		additions: 3,
		deletions: 0,
		patch: "@@ -0,0 +1,3 @@\n+# 测试用，可删\n+\n+A new file for PR fixtures.",
	});
	expect(files[0]?.url).toBe(
		"https://github.com/lw396/herdr-plugin-github/blob/63f52f1dddd87eecbe02a9013523124921ee4345/docs%2Fadr%2F0005-one-repository-renamed.md",
	);
});

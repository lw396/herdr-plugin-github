import { afterEach, expect, test } from "bun:test";
import { Notices } from "../../src/github/io/changes.ts";
import { addPullComment } from "../../src/github/io/pulls.ts";
import { execCalls, machine, reset } from "../fake-herdr.ts";
import invalid from "../fixtures/pull-plugin-35-comment-invalid.json";
import left from "../fixtures/pull-plugin-35-comment-left.json";
import right from "../fixtures/pull-plugin-35-comment-right.json";

afterEach(reset);
const repo = "lw396/herdr-plugin-github";
const commit = "63f52f1dddd87eecbe02a9013523124921ee4345";

for (const failure of [
	{ code: 1, stdout: JSON.stringify(invalid), stderr: "gh: Validation Failed (HTTP 422)" },
	{ code: 1, stderr: 'Post "https://api.github.com/repos/lw396/herdr-plugin-github/pulls/35/comments": EOF' },
]) {
	test(`a rejected standalone comment surfaces ${failure.stderr} without retrying or falling back locally`, async () => {
		const notices = new Notices();
		machine("center", {
			[`~$ gh api repos/${repo}/pulls/35/comments -X POST -F line=999999 -f body=hello -f commit_id=${commit} -f path=docs/pr-fixture.md -f side=RIGHT`]:
				failure,
		});
		await expect(
			addPullComment(repo, 35, { commit, path: "docs/pr-fixture.md", side: "RIGHT", line: 999999 }, "hello", "center"),
		).rejects.toThrow(failure.stderr);
		expect(notices.take()).toEqual(
			failure.stderr.endsWith("EOF") ? [{ repo, number: 35, threads: { on: "center" } }] : [],
		);
		expect(execCalls()).toHaveLength(1);
		expect(execCalls()[0]?.on).toBe("center");
	});
}

for (const fixture of [right, left]) {
	test(`a standalone ${fixture.side} comment returns the published comment and notifies the PR machine`, async () => {
		const notices = new Notices();
		machine("center", {
			[`~$ gh api repos/${repo}/pulls/35/comments -X POST -F line=2 -f body=${fixture.body} -f commit_id=${commit} -f path=${fixture.path} -f side=${fixture.side}`]:
				{ stdout: JSON.stringify(fixture) },
		});
		const result = await addPullComment(
			repo,
			35,
			{ commit, path: fixture.path, side: fixture.side as "LEFT" | "RIGHT", line: 2 },
			fixture.body,
			"center",
		);
		expect(result).toMatchObject({
			id: fixture.id,
			body: fixture.body,
			author: "lw396",
			createdAt: fixture.created_at,
		});
		expect(notices.take()).toEqual([{ repo, number: 35, threads: { on: "center" } }]);
		expect(execCalls().every((c) => c.on === "center")).toBe(true);
	});
}

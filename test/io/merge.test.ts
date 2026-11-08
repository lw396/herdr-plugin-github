import { afterEach, expect, test } from "bun:test";
import { deletePullBranch, mergePull } from "../../src/github/io/pulls.ts";
import { execCalls, machine, reset } from "../fake-herdr.ts";

afterEach(reset);
test("merge pins the reviewed SHA and method on the reader machine", async () => {
	machine("remote", {
		"~$ gh api repos/a/b/pulls/1/merge -X PUT -f merge_method=squash -f sha=abc": {
			stdout: '{"merged":true,"message":"Pull Request successfully merged"}',
		},
	});
	await mergePull("a/b", 1, "squash", "abc", "remote");
});
test("merge rejection preserves gh error and never retries writes", async () => {
	machine("remote", {
		"~$ gh api repos/a/b/pulls/1/merge -X PUT -f merge_method=merge -f sha=abc": {
			code: 1,
			stderr: "gh: Required status check is expected (HTTP 405)",
		},
	});
	await expect(mergePull("a/b", 1, "merge", "abc", "remote")).rejects.toThrow("Required status check");
	expect(execCalls()).toHaveLength(1);
});
test("delete targets the fork's remote ref, never a local branch", async () => {
	machine("remote", { "~$ gh api repos/fork/b/git/refs/heads/feature/topic -X DELETE": { stdout: "" } });
	await deletePullBranch(
		"a/b",
		1,
		{ methods: [], reason: null, sha: "abc", headRepo: "fork/b", headRef: "feature/topic", deletable: true },
		"remote",
	);
});

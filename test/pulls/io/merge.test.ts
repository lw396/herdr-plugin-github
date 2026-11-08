import { afterEach, expect, test } from "bun:test";
import { Notices } from "../../../src/github/detail/io/changes.ts";
import { deletePullBranch, mergePull } from "../../../src/github/pulls/io/pulls.ts";
import { execCalls, machine, reset } from "../../fake-herdr.ts";

afterEach(reset);
test("merge pins the reviewed SHA and method on the reader machine", async () => {
	machine("remote", {
		"~$ gh api repos/a/b/pulls/1/merge -X PUT -f merge_method=squash -f sha=abc": {
			stdout: '{"merged":true,"message":"Pull Request successfully merged"}',
		},
	});
	const notices = new Notices();
	await mergePull("a/b", 1, "squash", "abc", "remote");
	expect(notices.take()).toEqual([{ repo: "a/b", number: 1, pull: true }]);
});
test("a merge GitHub answers without merging is a failure with its message", async () => {
	machine("remote", {
		"~$ gh api repos/a/b/pulls/1/merge -X PUT -f merge_method=merge -f sha=abc": {
			stdout: '{"merged":false,"message":"Head branch was modified. Review and try the merge again."}',
		},
	});
	const notices = new Notices();
	await expect(mergePull("a/b", 1, "merge", "abc", "remote")).rejects.toThrow("Head branch was modified");
	expect(notices.take()).toEqual([]);
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
	expect(execCalls()).toHaveLength(1);
});
test("a branch GitHub says cannot be deleted is never asked about", async () => {
	machine("remote", {});
	const info = { methods: [], reason: null, sha: "abc", headRepo: "fork/b", headRef: "main", deletable: false };
	await expect(deletePullBranch("a/b", 1, info, "remote")).rejects.toThrow("cannot be deleted");
	expect(execCalls()).toHaveLength(0);
});

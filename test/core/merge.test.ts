import { expect, test } from "bun:test";
import { mergeInfo } from "../../src/github/core/merge.ts";

const p = {
	state: "open",
	mergeable: true,
	mergeable_state: "clean",
	head: { sha: "abc", ref: "feature", repo: { full_name: "fork/repo", default_branch: "main" } },
};
test("allowed methods keep merge/squash/rebase order and first default", () => {
	expect(mergeInfo(p, { allow_squash_merge: true, allow_rebase_merge: true }).methods).toEqual(["squash", "rebase"]);
	expect(mergeInfo(p, { allow_merge_merge: true }).reason).toBeNull();
});
test("conflicts, checks, protection, drafts and unknown states cannot merge", () => {
	for (const state of ["dirty", "unstable", "blocked", "behind", "unknown"])
		expect(mergeInfo({ ...p, mergeable_state: state }, { allow_merge_merge: true }).reason).not.toBeNull();
	expect(mergeInfo({ ...p, draft: true }, {}).reason).toContain("draft");
	expect(mergeInfo({ ...p, mergeable: null }, {}).reason).not.toBeNull();
});
test("only merged non-default heads can be deleted, including forks", () => {
	expect(mergeInfo({ ...p, merged: true }, {})).toMatchObject({ deletable: true, headRepo: "fork/repo" });
	expect(mergeInfo({ ...p, merged: true, head: { ...p.head, ref: "main" } }, {}).deletable).toBe(false);
	expect(mergeInfo(p, {}).deletable).toBe(false);
});

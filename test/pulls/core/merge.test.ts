import { expect, test } from "bun:test";
import { mergeInfo, selectedMergeMethod } from "../../../src/github/pulls/core/merge.ts";
import repository from "../../fixtures/repository-plugin-merge-methods.json";

// REST pull request fields (mergeable, mergeable_state) and repository allow_*_merge settings.
const p = {
	state: "open",
	mergeable: true,
	mergeable_state: "clean",
	head: { sha: "abc", ref: "feature", repo: { full_name: "fork/repo", default_branch: "main" } },
};
test("merge defaults to the first allowed method, respects a selection and falls back when it is disabled", () => {
	expect(selectedMergeMethod(["merge", "squash", "rebase"], null)).toBe("merge");
	expect(selectedMergeMethod(["squash", "rebase"], null)).toBe("squash");
	expect(selectedMergeMethod(["merge", "squash"], "merge")).toBe("merge");
	expect(selectedMergeMethod(["merge", "rebase"], "squash")).toBe("merge");
	expect(selectedMergeMethod(["rebase"], null)).toBe("rebase");
	expect(selectedMergeMethod([], "squash")).toBeNull();
});

test("the real repository settings enable all three methods with Create Merge Commit as default", () => {
	// Captured with gh api repos/lw396/herdr-plugin-github --jq '{allow_merge_commit,allow_squash_merge,allow_rebase_merge}'.
	const info = mergeInfo(p, repository);
	expect(info.methods).toEqual(["merge", "squash", "rebase"]);
	expect(selectedMergeMethod(info.methods, null)).toBe("merge");
});

test("allowed methods keep merge/squash/rebase order", () => {
	expect(mergeInfo(p, { allow_squash_merge: true, allow_rebase_merge: true }).methods).toEqual(["squash", "rebase"]);
	expect(mergeInfo(p, { allow_merge_commit: true }).methods).toEqual(["merge"]);
	expect(mergeInfo(p, { allow_merge_commit: true }).reason).toBeNull();
	expect(mergeInfo(p, {}).reason).toBe("No merge methods are enabled");
});
test("conflicts, checks, protection, drafts and unknown states each say why they cannot merge", () => {
	const reason = (more: object) => mergeInfo({ ...p, ...more }, { allow_merge_commit: true }).reason;
	expect(reason({ mergeable: false, mergeable_state: "dirty" })).toBe(
		"This branch has conflicts that must be resolved",
	);
	expect(reason({ mergeable_state: "unstable" })).toBe("Checks have not passed");
	expect(reason({ mergeable_state: "behind" })).toBe("This branch is out-of-date with the base branch");
	expect(reason({ mergeable_state: "blocked" })).toBe(
		"Merging is blocked by branch protection rules (required checks or reviews)",
	);
	expect(reason({ mergeable: null, mergeable_state: "unknown" })).toBe("Checking mergeability…");
	expect(reason({ mergeable_state: "something_new" })).toBe("Merging is blocked: something_new");
	expect(reason({ draft: true })).toBe("This pull request is still a draft");
	expect(reason({ state: "closed" })).toBe("Pull request is closed");
	expect(reason({ merged: true, state: "closed" })).toBe("Pull request successfully merged");
});
test("only merged non-default heads can be deleted, including forks", () => {
	expect(mergeInfo({ ...p, merged: true }, {})).toMatchObject({ deletable: true, headRepo: "fork/repo" });
	expect(mergeInfo({ ...p, merged: true, head: { ...p.head, ref: "main" } }, {}).deletable).toBe(false);
	expect(mergeInfo(p, {}).deletable).toBe(false);
});

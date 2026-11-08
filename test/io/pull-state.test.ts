import { afterEach, expect, test } from "bun:test";
import { Notices } from "../../src/github/io/changes.ts";
import { readyPull, setPullState } from "../../src/github/io/pulls.ts";
import { execCalls, machine, reset } from "../fake-herdr.ts";
import closed from "../fixtures/pull-plugin-36-closed.json";
import ready from "../fixtures/pull-plugin-36-ready.json";
import rejected from "../fixtures/pull-plugin-36-reopen-rejected.json";
import reopened from "../fixtures/pull-plugin-36-reopened.json";

// Captured on test PR #36: reopen, close, reopen, mark ready, comment;
// restored to closed/draft and removed the temporary branch refs afterwards.
const repo = "lw396/herdr-plugin-github";
afterEach(reset);

test("a refused reopen preserves GitHub's reason and does not invalidate views", async () => {
	const notices = new Notices();
	machine("center", {
		[`~$ gh api repos/${repo}/pulls/36 -X PATCH -f state=open`]: {
			code: 1,
			stdout: JSON.stringify(rejected),
			stderr:
				"gh: Validation Failed (HTTP 422)\nstate cannot be changed. The test/pr-fixture-a and test/pr-fixture-draft branches have been deleted.",
		},
	});
	await expect(setPullState(repo, 36, "open", "center")).rejects.toThrow("branches have been deleted");
	expect(notices.take()).toEqual([]);
	expect(execCalls()).toHaveLength(1);
});

for (const action of ["state", "ready"] as const) {
	test(`${action}: a dropped write requests a refresh but is never repeated or sent locally`, async () => {
		const notices = new Notices();
		machine("center", {
			"~$ gh api graphql -F number=36 -f query=query($owner:String!,$repo:String!,$number:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$number){id}}} -f owner=lw396 -f repo=herdr-plugin-github":
				{
					stdout: JSON.stringify({ data: { repository: { pullRequest: { id: "PR_kwDOVkv4288AAAABNfEFwA" } } } }),
				},
			[action === "state"
				? `~$ gh api repos/${repo}/pulls/36 -X PATCH -f state=closed`
				: `~$ gh api graphql -f query=mutation($id:ID!){markPullRequestReadyForReview(input:{pullRequestId:$id}){pullRequest{id state isDraft}}} -f id=PR_kwDOVkv4288AAAABNfEFwA`]:
				{
					code: 1,
					stderr: 'Post "https://api.github.com/": EOF',
				},
		});
		await expect(
			action === "state" ? setPullState(repo, 36, "closed", "center") : readyPull(repo, 36, "center"),
		).rejects.toThrow("EOF");
		expect(execCalls()).toHaveLength(action === "state" ? 1 : 2);
		expect(execCalls().every((c) => c.on === "center")).toBe(true);
		expect(notices.take()).toEqual([{ repo, number: 36, pull: true }]);
	});
}

for (const [state, reply, expected] of [
	["closed", closed, "closed"],
	["open", reopened, "draft"],
] as const) {
	test(`${state} returns the confirmed PR state and invalidates sidebar groups and readers`, async () => {
		const notices = new Notices();
		machine("center", {
			[`~$ gh api repos/${repo}/pulls/36 -X PATCH -f state=${state}`]: { stdout: JSON.stringify(reply) },
		});
		expect(await setPullState(repo, 36, state, "center")).toBe(expected);
		expect(notices.take()).toEqual([{ repo, number: 36, pull: true }]);
		expect(execCalls().every((c) => c.on === "center")).toBe(true);
	});
}

test("Ready for Review returns the confirmed non-draft state on the reader's machine", async () => {
	const notices = new Notices();
	machine("center", {
		"~$ gh api graphql -F number=36 -f query=query($owner:String!,$repo:String!,$number:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$number){id}}} -f owner=lw396 -f repo=herdr-plugin-github":
			{
				stdout: JSON.stringify({ data: { repository: { pullRequest: { id: "PR_kwDOVkv4288AAAABNfEFwA" } } } }),
			},
		"~$ gh api graphql -f query=mutation($id:ID!){markPullRequestReadyForReview(input:{pullRequestId:$id}){pullRequest{id state isDraft}}} -f id=PR_kwDOVkv4288AAAABNfEFwA":
			{ stdout: JSON.stringify(ready) },
	});
	expect(await readyPull(repo, 36, "center")).toBe("open");
	expect(notices.take()).toEqual([{ repo, number: 36, pull: true }]);
});

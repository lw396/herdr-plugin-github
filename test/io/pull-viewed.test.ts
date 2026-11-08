// GraphQL shape captured from fixture PR #35; DISMISSED is GitHub's invalidated viewed state.
import { afterEach, expect, test } from "bun:test";
import { Notices } from "../../src/github/io/changes.ts";
import { readPullViewed, setPullFileViewed } from "../../src/github/io/pulls.ts";
import { execCalls, machine, reset } from "../fake-herdr.ts";

afterEach(reset);

test("viewed state cannot fall back from a remote machine to local credentials", async () => {
	machine("center", {});
	machine(null, {});
	await expect(readPullViewed("lw396/herdr-plugin-github", 35, "center")).rejects.toThrow("cannot start gh");
	expect(execCalls().every((c) => c.on === "center")).toBe(true);
});

test("a dropped mark reply reports the error, requests reconciliation, and is not retried", async () => {
	const notices = new Notices();
	const mutation =
		"mutation($id:ID!,$path:String!){markFileAsViewed(input:{pullRequestId:$id,path:$path}){pullRequest{id}}}";
	machine("center", {
		[idCommand]: reply([]),
		[`~$ gh api graphql -f query=${mutation} -f id=PR_kwDOVkv4288AAAABNfEEsw -f path=docs/pr-fixture.md`]: {
			code: 1,
			stderr: 'Post "https://api.github.com/graphql": EOF',
		},
	});
	await expect(
		setPullFileViewed("lw396/herdr-plugin-github", 35, "docs/pr-fixture.md", true, "center"),
	).rejects.toThrow("EOF");
	expect(notices.take()).toEqual([{ repo: "lw396/herdr-plugin-github", number: 35, files: { on: "center" } }]);
	expect(execCalls().filter((c) => c.args.some((a) => a.startsWith("query=mutation")))).toHaveLength(1);
});

test("a definitively rejected mark does not announce a change", async () => {
	const notices = new Notices();
	const mutation =
		"mutation($id:ID!,$path:String!){markFileAsViewed(input:{pullRequestId:$id,path:$path}){pullRequest{id}}}";
	machine("center", {
		[idCommand]: reply([]),
		[`~$ gh api graphql -f query=${mutation} -f id=PR_kwDOVkv4288AAAABNfEEsw -f path=docs/pr-fixture.md`]: {
			stdout: JSON.stringify({ errors: [{ message: "Resource not accessible by integration" }] }),
		},
	});
	await expect(
		setPullFileViewed("lw396/herdr-plugin-github", 35, "docs/pr-fixture.md", true, "center"),
	).rejects.toThrow("Resource not accessible");
	expect(notices.take()).toEqual([]);
});

test("a GraphQL permission failure is not interpreted as all files unviewed", async () => {
	machine("center", {
		[command]: { stdout: JSON.stringify({ errors: [{ message: "Resource not accessible by integration" }] }) },
	});
	await expect(readPullViewed("lw396/herdr-plugin-github", 35, "center")).rejects.toThrow("Resource not accessible");
});
const query =
	"query($owner:String!,$repo:String!,$number:Int!,$after:String){repository(owner:$owner,name:$repo){pullRequest(number:$number){id files(first:100,after:$after){nodes{path viewerViewedState} pageInfo{hasNextPage endCursor}}}}}";
const command = `~$ gh api graphql -F number=35 -F after=null -f query=${query} -f owner=lw396 -f repo=herdr-plugin-github`;
const idCommand =
	"~$ gh api graphql -F number=35 -f query=query($owner:String!,$repo:String!,$number:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$number){id}}} -f owner=lw396 -f repo=herdr-plugin-github";
const reply = (nodes: unknown[], more = false, cursor = "NA") => ({
	stdout: JSON.stringify({
		data: {
			repository: {
				pullRequest: {
					id: "PR_kwDOVkv4288AAAABNfEEsw",
					files: { nodes, pageInfo: { hasNextPage: more, endCursor: cursor } },
				},
			},
		},
	}),
});

test("viewed states are read on the PR machine across all pages; changed-since-viewed is not viewed", async () => {
	machine("center", {
		[command]: reply([{ path: "docs/pr-fixture.md", viewerViewedState: "VIEWED" }], true, "MQ"),
		[command
			.replace(" -F after=null", "")
			.replace(" -f repo=herdr-plugin-github", " -f repo=herdr-plugin-github -f after=MQ")]: reply([
			{ path: "src/github/core/time.ts", viewerViewedState: "DISMISSED" },
			{ path: "docs/adr/0006-poll-with-conditional-requests.md", viewerViewedState: "UNVIEWED" },
		]),
	});
	const result = await readPullViewed("lw396/herdr-plugin-github", 35, "center");
	expect(result.id).toBe("PR_kwDOVkv4288AAAABNfEEsw");
	expect(result.viewed).toEqual(["docs/pr-fixture.md"]);
});

for (const viewed of [true, false]) {
	test(`${viewed ? "mark" : "unmark"} syncs the exact path through the PR machine`, async () => {
		const operation = viewed ? "markFileAsViewed" : "unmarkFileAsViewed";
		const mutation = `mutation($id:ID!,$path:String!){${operation}(input:{pullRequestId:$id,path:$path}){pullRequest{id}}}`;
		const notices = new Notices();
		machine("center", {
			[idCommand]: reply([]),
			[`~$ gh api graphql -f query=${mutation} -f id=PR_kwDOVkv4288AAAABNfEEsw -f path=docs/a "quoted" file.md`]: {
				stdout: JSON.stringify({ data: { [operation]: { pullRequest: { id: "PR_kwDOVkv4288AAAABNfEEsw" } } } }),
			},
		});
		await expect(
			setPullFileViewed("lw396/herdr-plugin-github", 35, 'docs/a "quoted" file.md', viewed, "center"),
		).resolves.toBeUndefined();
		expect(notices.take()).toEqual([{ repo: "lw396/herdr-plugin-github", number: 35, files: { on: "center" } }]);
	});
}

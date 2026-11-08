import { afterEach, expect, test } from "bun:test";
import { Notices } from "../../src/github/io/changes.ts";
import { readPullThreads, replyPullThread, resolvePullThread } from "../../src/github/io/pulls.ts";
import { execCalls, machine, reset } from "../fake-herdr.ts";
import inline from "../fixtures/pull-plugin-35-inline.json";
import reply from "../fixtures/pull-plugin-35-reply.json";
import resolved from "../fixtures/pull-plugin-35-resolve.json";
import drafts from "../fixtures/pull-plugin-35-review-comments.json";
import threads from "../fixtures/pull-plugin-35-threads.json";
import unresolved from "../fixtures/pull-plugin-35-unresolve.json";

afterEach(reset);
const repo = "lw396/herdr-plugin-github";
const id = "PRRT_kwDOVkv428604gxk";
const query =
	"query($owner:String!,$repo:String!,$number:Int!,$after:String){repository(owner:$owner,name:$repo){pullRequest(number:$number){reviewThreads(first:100,after:$after){nodes{id path diffSide line isOutdated isResolved viewerCanResolve viewerCanUnresolve comments(first:1){nodes{databaseId}}} pageInfo{hasNextPage endCursor}}}}}";
test("a reply returns GitHub's comment immediately and announces a discussion change", async () => {
	const notices = new Notices();
	machine("center", {
		[`~$ gh api repos/${repo}/pulls/35/comments/4502780899/replies -X POST -f body=Fixture reply for #29 (测试用，可删).`]:
			{ stdout: JSON.stringify(reply) },
	});
	const comment = await replyPullThread(repo, 35, 4502780899, "Fixture reply for #29 (测试用，可删).", "center");
	expect(comment.body).toBe("Fixture reply for #29 (测试用，可删).");
	expect(notices.take()).toEqual([{ repo, number: 35, threads: { on: "center" } }]);
});

for (const resolve of [true, false]) {
	test(`${resolve ? "resolve" : "unresolve"} returns the new resolution and permissions immediately`, async () => {
		const op = resolve ? "resolveReviewThread" : "unresolveReviewThread";
		const mutation = `mutation($id:ID!){${op}(input:{threadId:$id}){thread{id isResolved viewerCanResolve viewerCanUnresolve}}}`;
		const notices = new Notices();
		machine("center", {
			[`~$ gh api graphql -f query=${mutation} -f id=${id}`]: {
				stdout: JSON.stringify(resolve ? resolved : unresolved),
			},
		});
		expect(await resolvePullThread(repo, 35, id, resolve, "center")).toEqual({
			resolved: resolve,
			canResolve: !resolve,
			canUnresolve: resolve,
		});
		expect(notices.take()).toEqual([{ repo, number: 35, threads: { on: "center" } }]);
	});
}

test("thread reads follow GraphQL cursors and do not lose earlier pages", async () => {
	const first = JSON.parse(JSON.stringify(threads));
	first.data.repository.pullRequest.reviewThreads.pageInfo = { hasNextPage: true, endCursor: "next" };
	const second = JSON.parse(JSON.stringify(threads));
	second.data.repository.pullRequest.reviewThreads.nodes = [];
	machine("center", {
		[command]: { stdout: JSON.stringify(first) },
		[`${command.replace(" -F after=null", "")} -f after=next`]: { stdout: JSON.stringify(second) },
		[`~$ gh api repos/${repo}/pulls/35/comments?per_page=100 --paginate --slurp`]: { stdout: JSON.stringify(inline) },
	});
	expect((await readPullThreads(repo, 35, "center")).map((t) => t.root)).toEqual([4502780899]);
});

for (const operation of ["reply", "resolve", "unresolve"] as const) {
	const op = operation === "resolve" ? "resolveReviewThread" : "unresolveReviewThread";
	const mutation = `mutation($id:ID!){${op}(input:{threadId:$id}){thread{id isResolved viewerCanResolve viewerCanUnresolve}}}`;
	const cmd =
		operation === "reply"
			? `~$ gh api repos/${repo}/pulls/35/comments/4502780899/replies -X POST -f body=hello`
			: `~$ gh api graphql -f query=${mutation} -f id=${id}`;
	const write = () =>
		operation === "reply"
			? replyPullThread(repo, 35, 4502780899, "hello", "center")
			: resolvePullThread(repo, 35, id, operation === "resolve", "center");

	test(`a dropped ${operation} may have happened: other views re-read, but it is never retried or sent locally`, async () => {
		const notices = new Notices();
		machine("center", { [cmd]: { code: 1, stderr: 'Post "https://api.github.com/graphql": EOF' } });
		await expect(write()).rejects.toThrow("EOF");
		expect(notices.take()).toEqual([{ repo, number: 35, threads: { on: "center" } }]);
		expect(execCalls()).toHaveLength(1);
		expect(execCalls()[0]?.on).toBe("center");
	});

	test(`a ${operation} GitHub refused announces nothing`, async () => {
		const notices = new Notices();
		machine("center", { [cmd]: { code: 1, stderr: "gh: Validation Failed (HTTP 422)" } });
		await expect(write()).rejects.toThrow("Validation Failed");
		expect(notices.take()).toEqual([]);
	});
}

test("thread permission errors are not silently treated as no discussions", async () => {
	machine("center", {
		[command]: { stdout: JSON.stringify({ errors: [{ message: "Resource not accessible by integration" }] }) },
		[`~$ gh api repos/${repo}/pulls/35/comments?per_page=100 --paginate --slurp`]: { stdout: JSON.stringify(inline) },
	});
	await expect(readPullThreads(repo, 35, "center")).rejects.toThrow("Resource not accessible");
});

test("a resumed pending review reads its private comments through the PR machine", async () => {
	const metadata = JSON.parse(JSON.stringify(threads));
	metadata.data.repository.pullRequest.reviewThreads.nodes[0].comments.nodes[0].databaseId = 4504980203;
	machine("center", {
		[command]: { stdout: JSON.stringify(metadata) },
		[`~$ gh api repos/${repo}/pulls/35/comments?per_page=100 --paginate --slurp`]: { stdout: "[[]]" },
		[`~$ gh api repos/${repo}/pulls/35/reviews/5816560818/comments?per_page=100 --paginate --slurp`]: {
			stdout: JSON.stringify(drafts),
		},
	});
	expect((await readPullThreads(repo, 35, "center", 5816560818))[0]?.comments).toMatchObject([
		{ id: 4504980203, draft: true, author: "lw396" },
	]);
	expect(execCalls().every((c) => c.on === "center")).toBe(true);
});

const command = `~$ gh api graphql -F number=35 -F after=null -f query=${query} -f owner=lw396 -f repo=herdr-plugin-github`;

test("reads existing threads with replies and resolution permissions through the PR machine", async () => {
	machine("center", {
		[command]: { stdout: JSON.stringify(threads) },
		[`~$ gh api repos/${repo}/pulls/35/comments?per_page=100 --paginate --slurp`]: { stdout: JSON.stringify(inline) },
	});
	const result = await readPullThreads(repo, 35, "center");
	expect(result[0]).toMatchObject({
		id,
		root: 4502780899,
		path: "docs/pr-fixture.md",
		side: "RIGHT",
		line: 3,
		resolved: false,
		canResolve: true,
	});
	expect(result[0]?.comments.map((c) => c.body)).toEqual([
		"Fixture for #29: existing diff discussion (测试用，可删).",
		"Fixture reply for #29 (测试用，可删).",
	]);
	expect(execCalls().every((c) => c.on === "center")).toBe(true);
});

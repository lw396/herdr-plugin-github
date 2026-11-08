import { afterEach, expect, test } from "bun:test";
import { Notices } from "../../../src/github/detail/io/changes.ts";
import * as reviews from "../../../src/github/pulls/io/pull-reviews.ts";
import { execCalls, machine, reset } from "../../fake-herdr.ts";
import pending from "../../fixtures/pull-plugin-35-review-pending.json";
import reply from "../../fixtures/pull-plugin-35-review-reply.json";
import started from "../../fixtures/pull-plugin-35-review-start.json";
import submitted from "../../fixtures/pull-plugin-35-review-submit.json";
import added from "../../fixtures/pull-plugin-35-review-thread.json";
import discussionComment from "../../fixtures/pull-plugin-36-discussion-comment.json";

const ADD_THREAD =
	"mutation($review:ID!,$path:String!,$side:DiffSide!,$line:Int!,$body:String!){addPullRequestReviewThread(input:{pullRequestReviewId:$review,path:$path,side:$side,line:$line,body:$body}){thread{id path diffSide line isOutdated isResolved viewerCanResolve viewerCanUnresolve comments(first:1){nodes{databaseId body createdAt author{login}}}}}}";

test("adding an inline draft uses the existing pending review and returns a draft conversation", async () => {
	const body = added.data.addPullRequestReviewThread.thread.comments.nodes[0]!.body;
	machine("center", {
		[stateCommand]: { stdout: JSON.stringify(pending) },
		[`~$ gh api graphql -F line=2 -f query=${ADD_THREAD} -f review=PRR_kwDOVkv4288AAAABWrGssg -f path=docs/pr-fixture.md -f side=RIGHT -f body=${body}`]:
			{ stdout: JSON.stringify(added) },
	});
	const result = await reviews.addPullReviewComment(
		repo,
		35,
		{ commit, path: "docs/pr-fixture.md", side: "RIGHT", line: 2 },
		body,
		"center",
	);
	expect(result.pending.id).toBe("PRR_kwDOVkv4288AAAABWrGssg");
	expect(result.thread).toMatchObject({
		id: "PRRT_kwDOVkv428609vZ4",
		side: "RIGHT",
		line: 2,
		comments: [{ id: 4504981631, draft: true, body }],
	});
});

test("replies made during a pending review stay private until submission", async () => {
	const query =
		"mutation($review:ID!,$thread:ID!,$body:String!){addPullRequestReviewThreadReply(input:{pullRequestReviewId:$review,pullRequestReviewThreadId:$thread,body:$body}){comment{databaseId body createdAt author{login}}}}";
	const body = reply.data.addPullRequestReviewThreadReply.comment.body;
	machine("center", {
		[stateCommand]: { stdout: JSON.stringify(pending) },
		[`~$ gh api graphql -f query=${query} -f review=PRR_kwDOVkv4288AAAABWrGssg -f thread=PRRT_kwDOVkv428609vZ4 -f body=${body}`]:
			{ stdout: JSON.stringify(reply) },
	});
	expect(
		await reviews.replyPullReviewThread(repo, 35, "PRRT_kwDOVkv428609vZ4", 4504981631, body, "center"),
	).toMatchObject({ id: 4505002203, draft: true, body });
});

const submitQuery =
	"mutation($id:ID!,$event:PullRequestReviewEvent!,$body:String!){submitPullRequestReview(input:{pullRequestReviewId:$id,event:$event,body:$body}){pullRequestReview{id databaseId state body submittedAt author{login}}}}";
for (const event of ["COMMENT", "APPROVE", "REQUEST_CHANGES"] as const) {
	test(`submit ${event} submits the existing pending review and notifies views`, async () => {
		const notices = new Notices();
		const body = "Review summary";
		// APPROVE / REQUEST_CHANGES cannot succeed on one's own test PR; these two replies are schema-shaped.
		const data = JSON.parse(JSON.stringify(submitted));
		data.data.submitPullRequestReview.pullRequestReview.state = {
			COMMENT: "COMMENTED",
			APPROVE: "APPROVED",
			REQUEST_CHANGES: "CHANGES_REQUESTED",
		}[event];
		machine("center", {
			[stateCommand]: { stdout: JSON.stringify(pending) },
			[`~$ gh api graphql -f query=${submitQuery} -f id=PRR_kwDOVkv4288AAAABWrGssg -f event=${event} -f body=${body}`]:
				{ stdout: JSON.stringify(data) },
		});
		expect(await reviews.submitPullReview(repo, 35, commit, event, body, "center")).toMatchObject({
			kind: "review",
			id: 5816560818,
			author: "lw396",
		});
		expect(notices.take()).toEqual([{ repo, number: 35, threads: { on: "center" }, review: { on: "center" } }]);
	});
}

test("Comment without a pending review returns the published discussion comment and notifies readers", async () => {
	const notices = new Notices();
	const body = "Fixture for #32: ordinary PR discussion comment (test only).";
	machine("center", {
		[stateCommand.replace("number=35", "number=36")]: {
			stdout: emptyState("PR_kwDOVkv4288AAAABNfEFwA"),
		},
		[`~$ gh api repos/${repo}/issues/36/comments -X POST -f body=${body}`]: {
			stdout: JSON.stringify(discussionComment),
		},
	});
	expect(await reviews.submitPullReview(repo, 36, commit, "COMMENT", body, "center")).toMatchObject({
		id: discussionComment.id,
		kind: "comment",
		body,
		author: "lw396",
	});
	expect(notices.take()).toEqual([{ repo, number: 36, threads: { on: "center" }, review: { on: "center" } }]);
});

for (const event of ["APPROVE", "REQUEST_CHANGES"] as const) {
	test(`${event} without pending drafts submits a review directly`, async () => {
		machine("center", {
			[stateCommand]: { stdout: emptyState() },
			[`~$ gh api repos/${repo}/pulls/35/reviews -X POST -f body=Summary -f event=${event} -f commit_id=${commit}`]: {
				stdout: JSON.stringify({
					id: 99,
					body: "Summary",
					state: event === "APPROVE" ? "APPROVED" : "CHANGES_REQUESTED",
					submitted_at: "2026-11-08T00:00:00Z",
					user: { login: "reviewer" },
				}),
			},
		});
		expect(await reviews.submitPullReview(repo, 35, commit, event, "Summary", "center")).toMatchObject({
			kind: "review",
			verb: event === "APPROVE" ? "approved these changes" : "requested changes",
		});
	});
}

for (const operation of ["start", "add", "submit"] as const) {
	for (const dropped of [true, false]) {
		test(`${operation} ${dropped ? "dropped" : "rejected"} response is never retried or sent locally`, async () => {
			const notices = new Notices();
			const cmd =
				operation === "start"
					? startCommand
					: operation === "add"
						? `~$ gh api graphql -F line=2 -f query=${ADD_THREAD} -f review=PRR_kwDOVkv4288AAAABWrGssg -f path=file -f side=LEFT -f body=hello`
						: `~$ gh api graphql -f query=${submitQuery} -f id=PRR_kwDOVkv4288AAAABWrGssg -f event=COMMENT -f body=hello`;
			machine("center", {
				[stateCommand]: { stdout: operation === "start" ? emptyState() : JSON.stringify(pending) },
				[cmd]: {
					code: 1,
					stderr: dropped ? 'Post "https://api.github.com/graphql": EOF' : "gh: Resource not accessible (HTTP 403)",
				},
			});
			await expect(
				operation === "start"
					? reviews.startPullReview(repo, 35, commit, "center")
					: operation === "add"
						? reviews.addPullReviewComment(repo, 35, { commit, path: "file", side: "LEFT", line: 2 }, "hello", "center")
						: reviews.submitPullReview(repo, 35, commit, "COMMENT", "hello", "center"),
			).rejects.toThrow(dropped ? "EOF" : "403");
			expect(execCalls().filter((c) => c.args[0] === "api" && c.args[1] === "graphql")).toHaveLength(2);
			expect(execCalls().every((c) => c.on === "center")).toBe(true);
			expect(notices.take()).toEqual(
				dropped
					? [
							{
								repo,
								number: 35,
								threads: { on: "center" },
								...(operation === "submit" ? { review: { on: "center" } } : {}),
							},
						]
					: [],
			);
		});
	}
}

function emptyState(id = "PR_kwDOVkv4288AAAABNfEEsw"): string {
	return JSON.stringify({
		data: {
			repository: {
				pullRequest: {
					id,
					reviews: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
				},
			},
		},
	});
}

afterEach(reset);
const repo = "lw396/herdr-plugin-github";
const query =
	"query($owner:String!,$repo:String!,$number:Int!,$after:String){repository(owner:$owner,name:$repo){pullRequest(number:$number){id reviews(first:100,states:PENDING,after:$after){nodes{id databaseId viewerDidAuthor body} pageInfo{hasNextPage endCursor}}}}}";
test("resuming a pending review preserves its existing summary", async () => {
	const data = JSON.parse(JSON.stringify(pending));
	data.data.repository.pullRequest.reviews.nodes[0].body = "Browser summary";
	machine("center", { [stateCommand]: { stdout: JSON.stringify(data) } });
	expect((await reviews.readPullReview(repo, 35, "center")).pending).toMatchObject({ body: "Browser summary" });
});

const stateCommand = `~$ gh api graphql -F number=35 -F after=null -f query=${query} -f owner=lw396 -f repo=herdr-plugin-github`;
const commit = "63f52f1dddd87eecbe02a9013523124921ee4345";
const startCommand = `~$ gh api graphql -f query=mutation($id:ID!,$commit:GitObjectID!){addPullRequestReview(input:{pullRequestId:$id,commitOID:$commit}){pullRequestReview{id databaseId state}}} -f id=PR_kwDOVkv4288AAAABNfEEsw -f commit=${commit}`;

test("Start Review resumes the viewer's existing pending review without another write", async () => {
	machine("center", { [stateCommand]: { stdout: JSON.stringify(pending) } });
	expect(await reviews.startPullReview(repo, 35, commit, "center")).toEqual({
		id: "PRR_kwDOVkv4288AAAABWrGssg",
		databaseId: 5816560818,
	});
});

test("Start Review creates a pending review on the PR's machine", async () => {
	machine("center", {
		[stateCommand]: {
			stdout: JSON.stringify({
				data: {
					repository: {
						pullRequest: {
							id: "PR_kwDOVkv4288AAAABNfEEsw",
							reviews: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
						},
					},
				},
			}),
		},
		[startCommand]: { stdout: JSON.stringify(started) },
	});
	expect(await reviews.startPullReview(repo, 35, commit, "center")).toEqual({
		id: "PRR_kwDOVkv4288AAAABWrGssg",
		databaseId: 5816560818,
	});
});

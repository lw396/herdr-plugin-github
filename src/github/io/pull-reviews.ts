// Pending reviews belong to the account on the PR's machine, never to shared app state.
import { detailUrl, ownerName } from "../core/detail.ts";
import { type Comment, parseComment } from "../core/discussion.ts";
import { type PullTimelineItem, pullTimeline } from "../core/pull-timeline.ts";
import type { ReviewThread, ThreadNode } from "../core/review-threads.ts";
import { written } from "./changes.ts";
import { api, eachPage, mutate } from "./gh.ts";
import { type PullCommentTarget, replyPullThread } from "./pulls.ts";

interface DraftComment {
	databaseId: number;
	body: string;
	createdAt: string;
	author: { login: string } | null;
}
interface DraftNode extends Omit<ThreadNode, "comments"> {
	comments: { nodes: DraftComment[] };
}

const draft = (c: DraftComment, url: string): Comment => ({
	...parseComment({ id: c.databaseId, body: c.body, created_at: c.createdAt, user: c.author }, url),
	draft: true,
});

export async function addPullReviewComment(
	repo: string,
	number: number,
	target: PullCommentTarget,
	body: string,
	on: string | null,
): Promise<{ pending: PendingReview; thread: ReviewThread }> {
	const pending = await startPullReview(repo, number, target.commit, on);
	return written({ repo, number, threads: { on } }, async () => {
		const data = await mutate<{ addPullRequestReviewThread: { thread: DraftNode } }>(
			{
				query:
					"mutation($review:ID!,$path:String!,$side:DiffSide!,$line:Int!,$body:String!){addPullRequestReviewThread(input:{pullRequestReviewId:$review,path:$path,side:$side,line:$line,body:$body}){thread{id path diffSide line isOutdated isResolved viewerCanResolve viewerCanUnresolve comments(first:1){nodes{databaseId body createdAt author{login}}}}}}",
				variables: { review: pending.id, path: target.path, side: target.side, line: target.line, body },
			},
			on,
		);
		const node = data?.addPullRequestReviewThread?.thread;
		const first = node?.comments.nodes[0];
		if (!node?.id || !first) throw new Error("GitHub did not return the draft discussion.");
		const url = detailUrl({ kind: "pr", repo, number });
		const thread: ReviewThread = {
			id: node.id,
			root: first.databaseId,
			path: node.path,
			side: node.diffSide,
			line: node.line,
			outdated: node.isOutdated,
			resolved: node.isResolved,
			canResolve: node.viewerCanResolve,
			canUnresolve: node.viewerCanUnresolve,
			comments: node.comments.nodes.map((c) => draft(c, url)),
		};
		return { pending, thread };
	});
}

export async function replyPullReviewThread(
	repo: string,
	number: number,
	thread: string,
	root: number,
	body: string,
	on: string | null,
): Promise<Comment> {
	const state = await readPullReview(repo, number, on);
	const pending = state.pending;
	if (!pending) return replyPullThread(repo, number, root, body, on);
	return written({ repo, number, threads: { on } }, async () => {
		const data = await mutate<{ addPullRequestReviewThreadReply: { comment: DraftComment } }>(
			{
				query:
					"mutation($review:ID!,$thread:ID!,$body:String!){addPullRequestReviewThreadReply(input:{pullRequestReviewId:$review,pullRequestReviewThreadId:$thread,body:$body}){comment{databaseId body createdAt author{login}}}}",
				variables: { review: pending.id, thread, body },
			},
			on,
		);
		const c = data?.addPullRequestReviewThreadReply?.comment;
		if (!c?.databaseId) throw new Error("GitHub did not return the draft reply.");
		return draft(c, detailUrl({ kind: "pr", repo, number }));
	});
}

export type ReviewEvent = "COMMENT" | "APPROVE" | "REQUEST_CHANGES";

/** Comment without a pending review is an ordinary discussion comment, as in VS Code. */
export async function submitPullReview(
	repo: string,
	number: number,
	commit: string,
	event: ReviewEvent,
	body: string,
	on: string | null,
): Promise<PullTimelineItem> {
	if (event === "REQUEST_CHANGES" && !body.trim()) throw new Error("Request Changes requires a summary.");
	const { pending } = await readPullReview(repo, number, on);
	if (!pending && event === "COMMENT" && !body.trim()) throw new Error("Write a comment first.");
	const url = detailUrl({ kind: "pr", repo, number });
	return written({ repo, number, threads: { on }, review: { on } }, async (): Promise<PullTimelineItem> => {
		if (!pending && event === "COMMENT") {
			const raw = await api(`repos/${repo}/issues/${number}/comments`, { on, method: "POST", rawFields: { body } });
			return { ...parseComment(raw, url), kind: "comment", verb: "commented", discussion: [] };
		}
		let raw: unknown;
		if (pending) {
			const data = await mutate<{
				submitPullRequestReview: {
					pullRequestReview: {
						databaseId: number;
						body: string;
						state: string;
						submittedAt: string;
						author: { login: string } | null;
					};
				};
			}>(
				{
					query:
						"mutation($id:ID!,$event:PullRequestReviewEvent!,$body:String!){submitPullRequestReview(input:{pullRequestReviewId:$id,event:$event,body:$body}){pullRequestReview{id databaseId state body submittedAt author{login}}}}",
					variables: { id: pending.id, event, body },
				},
				on,
			);
			const review = data?.submitPullRequestReview?.pullRequestReview;
			if (!review?.submittedAt) throw new Error("GitHub did not return the submitted review.");
			raw = {
				id: review.databaseId,
				body: review.body,
				state: review.state,
				submitted_at: review.submittedAt,
				user: review.author,
			};
		} else {
			raw = await api(`repos/${repo}/pulls/${number}/reviews`, {
				on,
				method: "POST",
				rawFields: { body, event, commit_id: commit },
			});
		}
		const parsed = pullTimeline([], [], [raw], [], url)[0];
		if (!parsed) throw new Error("GitHub did not return the submitted review.");
		return parsed;
	});
}

export interface PendingReview {
	id: string;
	databaseId: number;
	body?: string;
}

type ReviewPage = {
	nodes: (PendingReview & { viewerDidAuthor: boolean })[];
	pageInfo: { hasNextPage: boolean; endCursor: string | null };
};

/** The viewer's own pending review, if any; `id` is the pull request's node id. */
export async function readPullReview(
	repo: string,
	number: number,
	on: string | null,
): Promise<{ id: string; pending: PendingReview | null }> {
	const { owner, name } = ownerName(repo);
	let id = "";
	let pending: PendingReview | null = null;
	await eachPage(
		"the pull request's pending review",
		(after) => ({
			query:
				"query($owner:String!,$repo:String!,$number:Int!,$after:String){repository(owner:$owner,name:$repo){pullRequest(number:$number){id reviews(first:100,states:PENDING,after:$after){nodes{id databaseId viewerDidAuthor body} pageInfo{hasNextPage endCursor}}}}}",
			variables: { owner, repo: name, number, after },
		}),
		(data) => {
			const pull = (data as { repository: { pullRequest: { id: string; reviews: ReviewPage } | null } | null } | null)
				?.repository?.pullRequest;
			if (pull) id = pull.id;
			return pull?.reviews;
		},
		(page) => {
			const mine = page.nodes.find((r) => r.viewerDidAuthor);
			if (mine)
				pending = {
					id: mine.id,
					databaseId: mine.databaseId,
					...(mine.body === undefined ? {} : { body: mine.body }),
				};
			return Boolean(mine);
		},
		on,
	);
	return { id, pending };
}

/** Re-read first: a review started in the browser or another pane must be reused. */
export async function startPullReview(
	repo: string,
	number: number,
	commit: string,
	on: string | null,
): Promise<PendingReview> {
	const state = await readPullReview(repo, number, on);
	if (state.pending) return state.pending;
	return written({ repo, number, threads: { on } }, async () => {
		const data = await mutate<{ addPullRequestReview: { pullRequestReview: PendingReview & { state: string } } }>(
			{
				query:
					"mutation($id:ID!,$commit:GitObjectID!){addPullRequestReview(input:{pullRequestId:$id,commitOID:$commit}){pullRequestReview{id databaseId state}}}",
				variables: { id: state.id, commit },
			},
			on,
		);
		const review = data?.addPullRequestReview?.pullRequestReview;
		if (!review?.id || review.state !== "PENDING") throw new Error("GitHub did not return the pending review.");
		return { id: review.id, databaseId: review.databaseId };
	});
}

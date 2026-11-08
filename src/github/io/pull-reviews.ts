// Pending reviews belong to the account on the PR's machine, never to shared app state.
import { parseComment } from "../core/discussion.ts";
import { type PullTimelineItem, pullTimeline } from "../core/pull-timeline.ts";
import type { ReviewThread, ThreadNode } from "../core/review-threads.ts";
import { announce } from "./changes.ts";
import { api, GhError, graphql } from "./gh.ts";
import { type PullCommentTarget, replyPullThread } from "./pulls.ts";

interface DraftNode extends Omit<ThreadNode, "comments"> {
	comments: { nodes: { databaseId: number; body: string; createdAt: string; author: { login: string } | null }[] };
}

export async function addPullReviewComment(
	repo: string,
	number: number,
	target: PullCommentTarget,
	body: string,
	on: string | null,
): Promise<{ pending: PendingReview; thread: ReviewThread }> {
	const pending = await startPullReview(repo, number, target.commit, on);
	try {
		const data = await graphql<{ addPullRequestReviewThread: { thread: DraftNode } }>(
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
			comments: node.comments.nodes.map((c) => ({
				...parseComment(
					{ id: c.databaseId, body: c.body, created_at: c.createdAt, user: c.author },
					`https://github.com/${repo}/pull/${number}`,
				),
				draft: true,
			})),
		};
		announce({ repo, number, threads: { on } });
		return { pending, thread };
	} catch (e) {
		if (e instanceof GhError && e.transient) announce({ repo, number, threads: { on } });
		throw e;
	}
}

export async function replyPullReviewThread(
	repo: string,
	number: number,
	thread: string,
	root: number,
	body: string,
	on: string | null,
) {
	const state = await readPullReview(repo, number, on);
	if (!state.pending) return replyPullThread(repo, number, root, body, on);
	try {
		const data = await graphql<{
			addPullRequestReviewThreadReply: {
				comment: { databaseId: number; body: string; createdAt: string; author: { login: string } | null };
			};
		}>(
			{
				query:
					"mutation($review:ID!,$thread:ID!,$body:String!){addPullRequestReviewThreadReply(input:{pullRequestReviewId:$review,pullRequestReviewThreadId:$thread,body:$body}){comment{databaseId body createdAt author{login}}}}",
				variables: { review: state.pending.id, thread, body },
			},
			on,
		);
		const c = data?.addPullRequestReviewThreadReply?.comment;
		if (!c?.databaseId) throw new Error("GitHub did not return the draft reply.");
		announce({ repo, number, threads: { on } });
		return {
			...parseComment(
				{ id: c.databaseId, body: c.body, created_at: c.createdAt, user: c.author },
				`https://github.com/${repo}/pull/${number}`,
			),
			draft: true,
		};
	} catch (e) {
		if (e instanceof GhError && e.transient) announce({ repo, number, threads: { on } });
		throw e;
	}
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
	const state = await readPullReview(repo, number, on);
	const url = `https://github.com/${repo}/pull/${number}`;
	try {
		let item: PullTimelineItem;
		if (!state.pending && event === "COMMENT") {
			if (!body.trim()) throw new Error("Write a comment first.");
			const raw = await api(`repos/${repo}/issues/${number}/comments`, { on, method: "POST", rawFields: { body } });
			item = { ...parseComment(raw, url), kind: "comment", verb: "commented", discussion: [] };
		} else {
			let raw: unknown;
			if (state.pending) {
				const data = await graphql<{
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
						variables: { id: state.pending.id, event, body },
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
			item = parsed;
		}
		announce({ repo, number, threads: { on }, review: { on } });
		return item;
	} catch (e) {
		if (e instanceof GhError && e.transient) announce({ repo, number, threads: { on }, review: { on } });
		throw e;
	}
}

export interface PendingReview {
	id: string;
	databaseId: number;
	body?: string;
}

export async function readPullReview(
	repo: string,
	number: number,
	on: string | null,
): Promise<{ id: string; pending: PendingReview | null }> {
	const [owner, name] = repo.split("/");
	let after: string | null = null;
	for (;;) {
		const data: {
			repository: {
				pullRequest: {
					id: string;
					reviews: {
						nodes: (PendingReview & { viewerDidAuthor: boolean })[];
						pageInfo: { hasNextPage: boolean; endCursor: string | null };
					};
				} | null;
			} | null;
		} = await graphql(
			{
				query:
					"query($owner:String!,$repo:String!,$number:Int!,$after:String){repository(owner:$owner,name:$repo){pullRequest(number:$number){id reviews(first:100,states:PENDING,after:$after){nodes{id databaseId viewerDidAuthor body} pageInfo{hasNextPage endCursor}}}}}",
				variables: { owner, repo: name, number, after },
			},
			on,
		);
		const pull = data?.repository?.pullRequest;
		if (!pull) throw new Error("GitHub did not return the pull request's pending review.");
		const pending = pull.reviews.nodes.find((r) => r.viewerDidAuthor);
		if (pending)
			return {
				id: pull.id,
				pending: {
					id: pending.id,
					databaseId: pending.databaseId,
					...(pending.body === undefined ? {} : { body: pending.body }),
				},
			};
		if (!pull.reviews.pageInfo.hasNextPage) return { id: pull.id, pending: null };
		const next = pull.reviews.pageInfo.endCursor;
		if (!next || next === after) throw new Error("GitHub did not return the next reviews page.");
		after = next;
	}
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
	try {
		const data = await graphql<{ addPullRequestReview: { pullRequestReview: PendingReview & { state: string } } }>(
			{
				query:
					"mutation($id:ID!,$commit:GitObjectID!){addPullRequestReview(input:{pullRequestId:$id,commitOID:$commit}){pullRequestReview{id databaseId state}}}",
				variables: { id: state.id, commit },
			},
			on,
		);
		const review = data?.addPullRequestReview?.pullRequestReview;
		if (!review?.id || review.state !== "PENDING") throw new Error("GitHub did not return the pending review.");
		announce({ repo, number, threads: { on } });
		return { id: review.id, databaseId: review.databaseId };
	} catch (e) {
		if (e instanceof GhError && e.transient) announce({ repo, number, threads: { on } });
		throw e;
	}
}

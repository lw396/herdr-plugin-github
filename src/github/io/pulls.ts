// Pull requests from GitHub, through gh on the folder's or reader tab's machine (ADR 0003).
import { detailUrl, ownerName } from "../core/detail.ts";
import { type Comment, parseComment } from "../core/discussion.ts";
import { type ChangedFile, parseFiles } from "../core/files.ts";
import type { MergeInfo, MergeMethod } from "../core/merge.ts";
import { type PullDetail, parsePullDetail, pullHead } from "../core/pull-detail.ts";
import {
	localPullsQuery,
	type Pull,
	type PullGroup,
	type PullGroupKind,
	parseLocalPulls,
	parsePullGroup,
	pullGroupQuery,
} from "../core/pulls.ts";
import type { RemoteRepo } from "../core/remote.ts";
import { parseThreads, type ReviewThread, type ThreadNode } from "../core/review-threads.ts";
import { written } from "./changes.ts";
import { api, eachPage, GhError, graphql, mutate } from "./gh.ts";
import type { LocalBranches } from "./git.ts";

/** One page of a group, asked with the gh on `on`, whose account is `login` (for the searches). */
export async function pullPage(
	kind: PullGroupKind,
	remote: RemoteRepo,
	login: string,
	on: string | null,
	after: string | null,
): Promise<PullGroup> {
	return parsePullGroup(await graphql(pullGroupQuery(kind, remote, login, after), on));
}

/** A PR's description, discussion, checks and merge state. */
export async function readPull(repo: string, number: number, on: string | null): Promise<PullDetail> {
	const list = (path: string) => api(`${path}?per_page=100`, { on, paginate: true }) as Promise<unknown[]>;
	const [pull, issue, repository, comments, reviews, events, inline] = await Promise.all([
		api(`repos/${repo}/pulls/${number}`, { on }),
		api(`repos/${repo}/issues/${number}`, { on }),
		api(`repos/${repo}`, { on }),
		list(`repos/${repo}/issues/${number}/comments`),
		list(`repos/${repo}/pulls/${number}/reviews`),
		list(`repos/${repo}/issues/${number}/timeline`),
		list(`repos/${repo}/pulls/${number}/comments`),
	]);
	const sha = pullHead(pull);
	const [checkRuns, statuses] = await Promise.all([
		api(`repos/${repo}/commits/${sha}/check-runs?per_page=100`, { on, paginate: true }),
		list(`repos/${repo}/commits/${sha}/statuses`),
	]);
	return parsePullDetail({ pull, issue, repository, comments, reviews, events, inline, checkRuns, statuses });
}

export async function mergePull(
	repo: string,
	number: number,
	method: MergeMethod,
	sha: string,
	on: string | null,
): Promise<void> {
	await written({ repo, number, pull: true }, async () => {
		const result = (await api(`repos/${repo}/pulls/${number}/merge`, {
			on,
			method: "PUT",
			rawFields: { merge_method: method, sha },
		})) as { merged: boolean; message: string };
		// GitHub answered, and refused: nothing changed for other views to read.
		if (!result.merged) throw new GhError(result.message, 1, "");
	});
}

export async function deletePullBranch(
	repo: string,
	number: number,
	info: MergeInfo,
	on: string | null,
): Promise<void> {
	if (!info.deletable || !info.headRepo) throw new Error("This branch cannot be deleted");
	const ref = info.headRef.split("/").map(encodeURIComponent).join("/");
	await written({ repo, number, pull: true }, () =>
		api(`repos/${info.headRepo}/git/refs/heads/${ref}`, { on, method: "DELETE" }),
	);
}

/** All changed-file pages; GitHub may omit a patch (binary, too large, or a pure rename). */
export async function readPullFiles(repo: string, number: number, on: string | null): Promise<ChangedFile[]> {
	const files = parseFiles(await api(`repos/${repo}/pulls/${number}/files?per_page=100`, { on, paginate: true }));
	const viewed = new Set(await readPullViewed(repo, number, on));
	return files.map((file) => ({ ...file, viewed: viewed.has(file.path) }));
}

interface PullConnection<C> {
	repository: { pullRequest: C | null } | null;
}
type Page<N> = { nodes: N[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } };

/** GitHub invalidates viewed marks after a file changes (DISMISSED, not VIEWED). */
export async function readPullViewed(repo: string, number: number, on: string | null): Promise<string[]> {
	const { owner, name } = ownerName(repo);
	const viewed: string[] = [];
	await eachPage(
		"the pull request's viewed-file states",
		(after) => ({
			query:
				"query($owner:String!,$repo:String!,$number:Int!,$after:String){repository(owner:$owner,name:$repo){pullRequest(number:$number){id files(first:100,after:$after){nodes{path viewerViewedState} pageInfo{hasNextPage endCursor}}}}}",
			variables: { owner, repo: name, number, after },
		}),
		(data) =>
			(data as PullConnection<{ files: Page<{ path: string; viewerViewedState: string }> }> | null)?.repository
				?.pullRequest?.files,
		(page) => {
			viewed.push(...page.nodes.filter((f) => f.viewerViewedState === "VIEWED").map((f) => f.path));
			return false;
		},
		on,
	);
	return viewed;
}

/** The pull request's GraphQL node id, which its mutations name. */
export async function pullId(repo: string, number: number, on: string | null): Promise<string> {
	const { owner, name } = ownerName(repo);
	const data = await graphql<PullConnection<{ id: string }>>(
		{
			query:
				"query($owner:String!,$repo:String!,$number:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$number){id}}}",
			variables: { owner, repo: name, number },
		},
		on,
	);
	const id = data?.repository?.pullRequest?.id;
	if (!id) throw new Error("GitHub did not return the pull request's ID.");
	return id;
}

export async function setPullFileViewed(
	repo: string,
	number: number,
	path: string,
	viewed: boolean,
	on: string | null,
): Promise<void> {
	const id = await pullId(repo, number, on);
	const operation = viewed ? "markFileAsViewed" : "unmarkFileAsViewed";
	await written({ repo, number, files: { on } }, () =>
		mutate(
			{
				query: `mutation($id:ID!,$path:String!){${operation}(input:{pullRequestId:$id,path:$path}){pullRequest{id}}}`,
				variables: { id, path },
			},
			on,
		),
	);
}

export interface PullCommentTarget {
	commit: string;
	path: string;
	side: "LEFT" | "RIGHT";
	line: number;
}

const pullUrl = (repo: string, number: number): string => detailUrl({ kind: "pr", repo, number });

/** REST publishes a standalone comment, without creating or submitting a pending review. */
export async function addPullComment(
	repo: string,
	number: number,
	target: PullCommentTarget,
	body: string,
	on: string | null,
): Promise<Comment> {
	return written({ repo, number, threads: { on } }, async () => {
		const raw = await api(`repos/${repo}/pulls/${number}/comments`, {
			on,
			method: "POST",
			fields: { line: target.line },
			rawFields: { body, commit_id: target.commit, path: target.path, side: target.side },
		});
		return parseComment(raw, pullUrl(repo, number));
	});
}

export async function replyPullThread(
	repo: string,
	number: number,
	root: number,
	body: string,
	on: string | null,
): Promise<Comment> {
	return written({ repo, number, threads: { on } }, async () => {
		const raw = await api(`repos/${repo}/pulls/${number}/comments/${root}/replies`, {
			on,
			method: "POST",
			rawFields: { body },
		});
		return parseComment(raw, pullUrl(repo, number));
	});
}

/** Resolution permissions come from GitHub, not from whether the viewer authored the PR. */
export async function resolvePullThread(
	repo: string,
	number: number,
	id: string,
	resolved: boolean,
	on: string | null,
): Promise<Pick<ReviewThread, "resolved" | "canResolve" | "canUnresolve">> {
	const op = resolved ? "resolveReviewThread" : "unresolveReviewThread";
	return written({ repo, number, threads: { on } }, async () => {
		const data = await mutate<
			Record<
				string,
				{ thread: { id: string; isResolved: boolean; viewerCanResolve: boolean; viewerCanUnresolve: boolean } }
			>
		>(
			{
				query: `mutation($id:ID!){${op}(input:{threadId:$id}){thread{id isResolved viewerCanResolve viewerCanUnresolve}}}`,
				variables: { id },
			},
			on,
		);
		const thread = data?.[op]?.thread;
		if (!thread || thread.id !== id) throw new Error("GitHub did not return the updated discussion.");
		return {
			resolved: thread.isResolved,
			canResolve: thread.viewerCanResolve,
			canUnresolve: thread.viewerCanUnresolve,
		};
	});
}

/** Thread metadata is paged separately from REST's complete comment/reaction list. */
export async function readPullThreads(
	repo: string,
	number: number,
	on: string | null,
	pending: number | null = null,
): Promise<ReviewThread[]> {
	const drafts =
		pending === null
			? []
			: await api(`repos/${repo}/pulls/${number}/reviews/${pending}/comments?per_page=100`, { on, paginate: true });
	const comments = await api(`repos/${repo}/pulls/${number}/comments?per_page=100`, { on, paginate: true });
	const { owner, name } = ownerName(repo);
	const nodes: ThreadNode[] = [];
	await eachPage(
		"the pull request's discussions",
		(after) => ({
			query:
				"query($owner:String!,$repo:String!,$number:Int!,$after:String){repository(owner:$owner,name:$repo){pullRequest(number:$number){reviewThreads(first:100,after:$after){nodes{id path diffSide line isOutdated isResolved viewerCanResolve viewerCanUnresolve comments(first:1){nodes{databaseId}}} pageInfo{hasNextPage endCursor}}}}}",
			variables: { owner, repo: name, number, after },
		}),
		(data) =>
			(data as PullConnection<{ reviewThreads: Page<ThreadNode> }> | null)?.repository?.pullRequest?.reviewThreads,
		(page) => {
			nodes.push(...page.nodes);
			return false;
		},
		on,
	);
	return parseThreads(nodes, comments as unknown[], pullUrl(repo, number), drafts as unknown[]);
}

/** The local branches' latest PRs, in one batch. */
export async function localPulls(
	remote: RemoteRepo,
	{ branches, head }: LocalBranches,
	on: string | null,
): Promise<Pull[]> {
	if (branches.length === 0) return [];
	return parseLocalPulls(await graphql(localPullsQuery(remote, branches), on), head);
}

// Pull requests from GitHub, through gh on the folder's or reader tab's machine (ADR 0003).

import { type MergeInfo, type MergeMethod, mergeInfo } from "../core/merge.ts";
import { type PullDetail, parsePullDetail } from "../core/pull-detail.ts";
import { parseChecks, pullTimeline } from "../core/pull-timeline.ts";
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
import { api, graphql } from "./gh.ts";
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

/** A PR's description and ordinary discussion. */
export async function readPull(repo: string, number: number, on: string | null): Promise<PullDetail> {
	const [pull, issue, comments, reviews] = await Promise.all([
		api(`repos/${repo}/pulls/${number}`, { on }),
		// Description reactions live on the issue resource, not the REST pull request resource.
		api(`repos/${repo}/issues/${number}`, { on }),
		api(`repos/${repo}/issues/${number}/comments?per_page=100`, { on, paginate: true }),
		api(`repos/${repo}/pulls/${number}/reviews?per_page=100`, { on, paginate: true }),
	]);
	const detail = parsePullDetail(pull, issue, comments, reviews);
	detail.merge = mergeInfo(
		pull as Parameters<typeof mergeInfo>[0],
		(await api(`repos/${repo}`, { on })) as Record<string, unknown>,
	);
	const sha = (pull as { head: { sha: string } }).head.sha;
	const [events, inline, checks, statuses] = await Promise.all([
		api(`repos/${repo}/issues/${number}/timeline?per_page=100`, { on, paginate: true }),
		api(`repos/${repo}/pulls/${number}/comments?per_page=100`, { on, paginate: true }),
		api(`repos/${repo}/commits/${sha}/check-runs?per_page=100`, { on, paginate: true }),
		api(`repos/${repo}/commits/${sha}/statuses?per_page=100`, { on, paginate: true }),
	]);
	detail.timeline = pullTimeline(
		detail.comments,
		events as unknown[],
		reviews as unknown[],
		inline as unknown[],
		detail.url,
	);
	detail.checks = parseChecks(Array.isArray(checks) ? checks : [checks], statuses as unknown[]);
	if (detail.merge?.reason?.startsWith("Merging is blocked by")) {
		const reasons: string[] = [];
		if (detail.reviewers.some((r) => r.state === "changes_requested")) reasons.push("Changes requested");
		if (detail.reviewers.some((r) => r.state === "requested")) reasons.push("Review required");
		if (detail.checks.some((c) => /fail|pending|queued|progress|error/i.test(c.status)))
			reasons.push("Checks have not passed");
		if (reasons.length) detail.merge.reason += ": " + reasons.join("; ");
	}
	return detail;
}

export async function mergePull(
	repo: string,
	number: number,
	method: MergeMethod,
	sha: string,
	on: string | null,
): Promise<void> {
	const result = (await api(`repos/${repo}/pulls/${number}/merge`, {
		on,
		method: "PUT",
		rawFields: { merge_method: method, sha },
	})) as { merged: boolean; message: string };
	if (!result.merged) throw new Error(result.message);
}
export async function deletePullBranch(info: MergeInfo, on: string | null): Promise<void> {
	if (!info.deletable || !info.headRepo) throw new Error("This branch cannot be deleted");
	await api(`repos/${info.headRepo}/git/refs/heads/${info.headRef.split("/").map(encodeURIComponent).join("/")}`, {
		on,
		method: "DELETE",
	});
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

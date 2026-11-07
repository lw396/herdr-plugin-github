// Pull requests from GitHub, through gh on the folder's or reader tab's machine (ADR 0003).
import { type ChangedFile, parseFiles } from "../core/files.ts";
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
	return detail;
}

/** All changed-file pages; GitHub may omit a patch (binary, too large, or a pure rename). */
export async function readPullFiles(repo: string, number: number, on: string | null): Promise<ChangedFile[]> {
	return parseFiles(await api(`repos/${repo}/pulls/${number}/files?per_page=100`, { on, paginate: true }));
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

import type { Projects } from "../core/projects.ts";
import { type PullDetail, parsePullDetail } from "../core/pull-detail.ts";
import {
	localPullRequest,
	type PullGroup,
	type PullGroupKind,
	parseLocalPulls,
	parsePullGroup,
	pullRequest,
} from "../core/pulls.ts";
import type { RemoteRepo } from "../core/remote.ts";
import { api, graphql, type Where } from "./gh.ts";
import { type LocalBranches, localBranches } from "./git.ts";
import { readProjects } from "./projects.ts";

/**
 * One page of a group, asked with the gh on `on` (whose account is `login`, for the groups that
 * search for it): the first page when `after` is null, else the page after that cursor.
 */
export async function pullPage(
	kind: PullGroupKind,
	remote: RemoteRepo,
	login: string,
	on: string | null,
	after: string | null,
): Promise<PullGroup> {
	const { query, variables } = pullRequest(kind, remote, login, after);
	return parsePullGroup(await graphql(query, variables, { on }));
}

/** A PR's description and ordinary discussion, read on its native tab's machine. */
export async function readPull(repo: string, number: number, on: string | null): Promise<PullDetail> {
	const [pull, issue, comments, reviews] = await Promise.all([
		api(`repos/${repo}/pulls/${number}`, { on }),
		// Description reactions live on the issue resource, not the REST pull request resource.
		api(`repos/${repo}/issues/${number}`, { on }),
		api(`repos/${repo}/issues/${number}/comments?per_page=100`, { on, paginate: true }),
		api(`repos/${repo}/pulls/${number}/reviews?per_page=100`, { on, paginate: true }),
	]);
	return parsePullDetail(pull, issue, comments, reviews);
}

/** Projects remain optional: a missing scope never hides the description or comments. */
export function readPullProjects(repo: string, number: number, on: string | null): Promise<Projects> {
	return readProjects({ kind: "pr", repo, number }, on);
}

/** One batch for a snapshot, read here unless the caller already checked it for changes. */
export async function localPulls(remote: RemoteRepo, where: Where, snapshot?: LocalBranches): Promise<PullGroup> {
	const { branches, head } = snapshot ?? (await localBranches(remote, where));
	if (branches.length === 0) return { total: 0, more: false, cursor: null, pulls: [] };
	const { query, variables } = localPullRequest(remote, branches);
	return parseLocalPulls(await graphql(query, variables, { on: where.on ?? null }), head);
}

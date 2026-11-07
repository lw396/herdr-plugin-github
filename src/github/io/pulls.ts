// Pull requests from GitHub, through gh on the folder/reader's machine (ADR 0003).

import {
	localPullRequest,
	type PullGroup,
	type PullGroupKind,
	parseLocalPulls,
	parsePullGroup,
	pullRequest,
} from "../core/pulls.ts";
import type { RemoteRepo } from "../core/remote.ts";
import { graphql, type Where } from "./gh.ts";
import { type LocalBranches, localBranches } from "./git.ts";

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

/** One batch for a snapshot, read here unless the caller already checked it for changes. */
export async function localPulls(remote: RemoteRepo, where: Where, snapshot?: LocalBranches): Promise<PullGroup> {
	const { branches, head } = snapshot ?? (await localBranches(remote, where));
	if (branches.length === 0) return { total: 0, more: false, cursor: null, pulls: [] };
	const { query, variables } = localPullRequest(remote, branches);
	return parseLocalPulls(await graphql(query, variables, { on: where.on ?? null }), head);
}

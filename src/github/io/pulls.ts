// Pull requests from GitHub, through gh on the folder/reader's machine (ADR 0003).

import { type PullGroup, type PullGroupKind, parsePullGroup, pullRequest } from "../core/pulls.ts";
import type { RemoteRepo } from "../core/remote.ts";
import { graphql } from "./gh.ts";

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

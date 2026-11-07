// Pull requests from GitHub, through gh on the folder/reader's machine (ADR 0003).

import { PULL_QUERIES, type PullGroup, type PullGroupKind, parsePullGroup } from "../core/pulls.ts";
import type { RemoteRepo } from "../core/remote.ts";
import { graphql } from "./gh.ts";

/** One page of a group, asked with the gh on `on`: the first page when `after` is null, else the page after that cursor. */
export async function pullPage(
	kind: PullGroupKind,
	remote: RemoteRepo,
	on: string | null,
	after: string | null,
): Promise<PullGroup> {
	return parsePullGroup(await graphql(PULL_QUERIES[kind], { owner: remote.owner, name: remote.repo, after }, { on }));
}

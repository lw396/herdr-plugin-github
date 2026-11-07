// Pull requests from GitHub, through gh on the folder/reader's machine (ADR 0003).

import { exec } from "herdr";
import {
	localPullRequest,
	type PullGroup,
	type PullGroupKind,
	parseLocalPulls,
	parsePullGroup,
	pullRequest,
} from "../core/pulls.ts";
import { pickRemote, type RemoteRepo } from "../core/remote.ts";
import { graphql, type Where } from "./gh.ts";

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

/** All local branch matches, using only git reads and a single GraphQL batch on the folder's machine. */
export async function localPulls(remote: RemoteRepo, where: Where): Promise<PullGroup> {
	if (!where.cwd) throw new Error("No focused folder for local pull request branches.");
	const options = { cwd: where.cwd, on: where.on ?? null };
	const result = await exec("git", ["for-each-ref", "--format=%(refname:short)", "refs/heads"], options);
	if (result.code !== 0) throw new Error(result.stderr.trim() || "Could not read local branches.");
	const branches = result.stdout
		.split("\n")
		.map((b) => b.trim())
		.filter(Boolean);
	if (branches.length === 0) return { total: 0, more: false, cursor: null, pulls: [] };
	const remotes = await exec("git", ["remote", "-v"], options);
	if (remotes.code !== 0) throw new Error(remotes.stderr.trim() || "Could not read git remotes.");
	// In a fork the sidebar follows upstream, but the local branches belong to origin.
	const origin = remotes.stdout
		.split("\n")
		.filter((line) => /^origin\s/.test(line))
		.join("\n");
	const head = pickRemote(origin) ?? remote;
	const { query, variables } = localPullRequest(remote, branches);
	return parseLocalPulls(await graphql(query, variables, { on: options.on }), head);
}

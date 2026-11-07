// The Pull Requests tab: its groups (the VS Code extension's categories), their rows and pages.

import type { RemoteRepo } from "./remote.ts";

export type PullState = "open" | "draft" | "merged" | "closed";

/** One row: `#number title` (draft in italics) `by @author`, with a state icon. */
export interface Pull {
	number: number;
	title: string;
	/** null: a deleted account (GitHub's "ghost"). */
	author: string | null;
	state: PullState;
	updatedAt: string;
	url: string;
}

/** The groups: Waiting For My Review, Created By Me, All Open (Local Pull Request Branches joins with #24). */
export type PullGroupKind = "review" | "mine" | "all";

/** A group's loaded pages, and where the next page starts. */
export interface PullGroup {
	total: number;
	more: boolean;
	cursor: string | null;
	pulls: Pull[];
}

/** Rows per page: the first page, and each Load more. */
const PAGE = 30;

const ROW = "number title url updatedAt isDraft state author { login }";

/** All Open: the repository's open PRs, most recently updated first (no search request: ADR 0006). */
export const ALL_OPEN_QUERY = `query($owner: String!, $name: String!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequests(first: ${PAGE}, after: $after, states: OPEN, orderBy: {field: UPDATED_AT, direction: DESC}) {
      totalCount
      pageInfo { hasNextPage endCursor }
      nodes { ${ROW} }
    }
  }
}`;

/** The groups that depend on the account: a search, as the extension's categories are (one request per page). */
export const SEARCH_QUERY = `query($q: String!, $after: String) {
  search(query: $q, type: ISSUE, first: ${PAGE}, after: $after) {
    issueCount
    pageInfo { hasNextPage endCursor }
    nodes { ... on PullRequest { ${ROW} } }
  }
}`;

/** The extension's queries for its categories, with the gh account's login for ${user}. */
export function pullSearch(kind: "review" | "mine", remote: RemoteRepo, login: string): string {
	const who = kind === "review" ? `review-requested:${login}` : `author:${login}`;
	return `repo:${remote.owner}/${remote.repo} is:pr is:open ${who} sort:updated-desc`;
}

/** A group's page request: its query and variables (`after` null: the first page). */
export function pullRequest(
	kind: PullGroupKind,
	remote: RemoteRepo,
	login: string,
	after: string | null,
): { query: string; variables: Record<string, string | null> } {
	if (kind === "all") return { query: ALL_OPEN_QUERY, variables: { owner: remote.owner, name: remote.repo, after } };
	return { query: SEARCH_QUERY, variables: { q: pullSearch(kind, remote, login), after } };
}

interface PullNode {
	number: number;
	title: string;
	url: string;
	updatedAt: string;
	isDraft: boolean;
	state: "OPEN" | "CLOSED" | "MERGED";
	author: { login: string } | null;
}

interface Connection {
	pageInfo: { hasNextPage: boolean; endCursor: string | null };
	nodes: PullNode[];
}

/** All Open's reply, or a search's. */
type PullsData =
	| { repository: { pullRequests: Connection & { totalCount: number } } }
	| { search: Connection & { issueCount: number } };

function stateOf(n: PullNode): PullState {
	if (n.state === "MERGED") return "merged";
	if (n.state === "CLOSED") return "closed";
	return n.isDraft ? "draft" : "open";
}

/** A group query's `data` as rows. */
export function parsePullGroup(data: unknown): PullGroup {
	const d = data as PullsData;
	const [list, total] =
		"search" in d ? [d.search, d.search.issueCount] : [d.repository.pullRequests, d.repository.pullRequests.totalCount];
	return {
		total,
		more: list.pageInfo.hasNextPage,
		cursor: list.pageInfo.endCursor,
		pulls: list.nodes.map((n) => ({
			number: n.number,
			title: n.title,
			author: n.author?.login ?? null,
			state: stateOf(n),
			updatedAt: n.updatedAt,
			url: n.url,
		})),
	};
}

/**
 * The loaded rows followed by the next page's (Load more). A PR updated between the loads can
 * come again: it stays where it was, once.
 */
export function appendPullPage(group: PullGroup, page: PullGroup): PullGroup {
	const shown = new Set(group.pulls.map((p) => p.number));
	return { ...page, pulls: [...group.pulls, ...page.pulls.filter((p) => !shown.has(p.number))] };
}

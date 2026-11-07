// The Pull Requests tab: its groups (the VS Code extension's categories), their rows and pages.

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

/** The groups, in the extension's order; more join with #23 and #24. */
export type PullGroupKind = "all";

/** A group's loaded pages, and where the next page starts. */
export interface PullGroup {
	total: number;
	more: boolean;
	cursor: string | null;
	pulls: Pull[];
}

/** Rows per page: the first page, and each Load more. */
const PAGE = 30;

/** All Open: the repository's open PRs, most recently updated first (no search request: ADR 0006). */
export const ALL_OPEN_QUERY = `query($owner: String!, $name: String!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequests(first: ${PAGE}, after: $after, states: OPEN, orderBy: {field: UPDATED_AT, direction: DESC}) {
      totalCount
      pageInfo { hasNextPage endCursor }
      nodes { number title url updatedAt isDraft state author { login } }
    }
  }
}`;

/** Each group's query: a group without one cannot be asked by mistake. */
export const PULL_QUERIES: Record<PullGroupKind, string> = { all: ALL_OPEN_QUERY };

interface PullNode {
	number: number;
	title: string;
	url: string;
	updatedAt: string;
	isDraft: boolean;
	state: "OPEN" | "CLOSED" | "MERGED";
	author: { login: string } | null;
}

interface PullsData {
	repository: {
		pullRequests: {
			totalCount: number;
			pageInfo: { hasNextPage: boolean; endCursor: string | null };
			nodes: PullNode[];
		};
	};
}

function stateOf(n: PullNode): PullState {
	if (n.state === "MERGED") return "merged";
	if (n.state === "CLOSED") return "closed";
	return n.isDraft ? "draft" : "open";
}

/** A group query's `data` as rows. */
export function parsePullGroup(data: unknown): PullGroup {
	const { pullRequests } = (data as PullsData).repository;
	return {
		total: pullRequests.totalCount,
		more: pullRequests.pageInfo.hasNextPage,
		cursor: pullRequests.pageInfo.endCursor,
		pulls: pullRequests.nodes.map((n) => ({
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

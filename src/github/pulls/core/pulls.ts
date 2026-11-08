import { type PullState, pullState } from "../../detail/core/state.ts";
import type { Query } from "../../shared/core/gh.ts";
import type { RemoteRepo } from "../../shared/core/remote.ts";
import { PAGE, type Page } from "../../sidebar/core/page.ts";

export interface Pull {
	number: number;
	title: string;
	/** null: a deleted account (GitHub's "ghost"). */
	author: string | null;
	state: PullState;
	updatedAt: string;
	url: string;
}

/** The repository groups fetched a page at a time; Local Pull Request Branches is matched in one batch. */
export type PullGroupKind = "review" | "mine" | "all";
export type PullCategory = "local" | PullGroupKind;

export type PullGroup = Page<Pull>;

const ROW = "number title url updatedAt isDraft state author { login }";

/** All Open: the repository's open PRs, most recently updated first (no search request: ADR 0006). */
const ALL_OPEN_QUERY = `query($owner: String!, $name: String!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequests(first: ${PAGE}, after: $after, states: OPEN, orderBy: {field: UPDATED_AT, direction: DESC}) {
      totalCount
      pageInfo { hasNextPage endCursor }
      nodes { ${ROW} }
    }
  }
}`;

/** The groups that depend on the account: a search, as the extension's categories are. */
const SEARCH_QUERY = `query($q: String!, $after: String) {
  search(query: $q, type: ISSUE, first: ${PAGE}, after: $after) {
    issueCount
    pageInfo { hasNextPage endCursor }
    nodes { ... on PullRequest { ${ROW} } }
  }
}`;

export function pullSearch(kind: "review" | "mine", remote: RemoteRepo, login: string): string {
	const who = kind === "review" ? `review-requested:${login}` : `author:${login}`;
	return `repo:${remote.owner}/${remote.repo} is:pr is:open ${who} sort:updated-desc`;
}

export function pullGroupQuery(kind: PullGroupKind, remote: RemoteRepo, login: string, after: string | null): Query {
	if (kind === "all") return { query: ALL_OPEN_QUERY, variables: { owner: remote.owner, name: remote.repo, after } };
	return { query: SEARCH_QUERY, variables: { q: pullSearch(kind, remote, login), after } };
}

export function localPullsQuery(remote: RemoteRepo, branches: string[]): Query {
	const declarations = branches.map((_, i) => `$branch${i}: String!`).join(", ");
	const fields = branches
		.map(
			(
				_,
				i,
			) => `    branch${i}: pullRequests(first: 100, headRefName: $branch${i}, states: [OPEN, CLOSED, MERGED], orderBy: {field: UPDATED_AT, direction: DESC}) {
      pageInfo { hasNextPage }
      nodes { ${ROW} headRepository { nameWithOwner } }
    }`,
		)
		.join("\n");
	return {
		query: `query($owner: String!, $name: String!, ${declarations}) {
  repository(owner: $owner, name: $name) {
${fields}
  }
}`,
		variables: {
			owner: remote.owner,
			name: remote.repo,
			...Object.fromEntries(branches.map((b, i) => [`branch${i}`, b])),
		},
	};
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

function pullRow(n: PullNode): Pull {
	return {
		number: n.number,
		title: n.title,
		author: n.author?.login ?? null,
		state: pullState(n.state.toLowerCase() as Exclude<PullState, "draft">, n.isDraft),
		updatedAt: n.updatedAt,
		url: n.url,
	};
}

export function parsePullGroup(data: unknown): PullGroup {
	const d = data as
		| { repository: { pullRequests: Connection & { totalCount: number } } }
		| { search: Connection & { issueCount: number } };
	const [list, total] =
		"search" in d ? [d.search, d.search.issueCount] : [d.repository.pullRequests, d.repository.pullRequests.totalCount];
	return {
		total,
		more: list.pageInfo.hasNextPage,
		cursor: list.pageInfo.endCursor,
		rows: list.nodes.map(pullRow),
	};
}

/** The reply to localPullsQuery: the newest PR per branch whose head is `head`, most recently updated first. */
export function parseLocalPulls(data: unknown, head: RemoteRepo): Pull[] {
	const { repository } = data as {
		repository: Record<
			string,
			{ pageInfo: { hasNextPage: boolean }; nodes: (PullNode & { headRepository: { nameWithOwner: string } | null })[] }
		>;
	};
	const name = `${head.owner}/${head.repo}`.toLowerCase();
	const rows = new Map<number, PullNode>();
	for (const list of Object.values(repository)) {
		const match = list.nodes.find((n) => n.headRepository?.nameWithOwner.toLowerCase() === name);
		if (match) rows.set(match.number, match);
		else if (list.pageInfo.hasNextPage)
			throw new Error("Too many pull requests for a local branch to identify its head repository.");
	}
	return [...rows.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(pullRow);
}

export function localPage(all: Pull[], count: number): PullGroup {
	const more = count < all.length;
	return { total: all.length, more, cursor: more ? String(count) : null, rows: all.slice(0, count) };
}

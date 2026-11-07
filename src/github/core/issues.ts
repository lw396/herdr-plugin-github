// Issue groups in the sidebar: the GraphQL query for one page of a group, and its reply as rows.

import { type Account, describeAccount } from "./account.ts";
import type { RemoteRepo } from "./remote.ts";

/** One row of an issue group. */
export interface Issue {
	number: number;
	title: string;
	assignees: string[];
	/** ISO time, as GitHub sends it. */
	updatedAt: string;
	url: string;
}

/** An issue closed or reopened in a reader: its repository (owner/repo), new state and row. */
export interface IssueChange {
	repo: string;
	state: "open" | "closed";
	issue: Issue;
}

interface RestIssueRow {
	number: number;
	title: string;
	state: "open" | "closed";
	assignees: { login: string }[];
	updated_at: string;
	html_url: string;
}

/** A REST issue (the reply to closing or reopening it) as a change for the sidebar's groups. */
export function parseIssueChange(data: unknown, repo: string): IssueChange {
	const i = data as RestIssueRow;
	return {
		repo,
		state: i.state,
		issue: {
			number: i.number,
			title: i.title,
			assignees: i.assignees.map((a) => a.login),
			updatedAt: i.updated_at,
			url: i.html_url,
		},
	};
}

/** The Issues tab's groups: open issues assigned to the gh account, all open, all closed. */
export type GroupKind = "assigned" | "open" | "closed";

/** A group's loaded pages: their rows, how many there are in all, and where the next page starts. */
export interface IssueGroup {
	/** False when the repository has Issues turned off: then there are no rows. */
	issuesEnabled: boolean;
	total: number;
	/** Another page follows (Load more). */
	more: boolean;
	/** The last loaded page's end cursor: the next page starts after it. */
	cursor: string | null;
	issues: Issue[];
}

/** Rows per page: the first page, and each Load more. */
const PAGE = 30;

/** A page of a group, most recently updated first; with whether Issues are on. */
export function groupQuery(kind: GroupKind): string {
	const assigned = kind === "assigned";
	return `query($owner: String!, $name: String!, $after: String${assigned ? ", $assignee: String!" : ""}) {
  repository(owner: $owner, name: $name) {
    hasIssuesEnabled
    issues(first: ${PAGE}, after: $after, states: ${kind === "closed" ? "CLOSED" : "OPEN"}${assigned ? ", filterBy: {assignee: $assignee}" : ""}, orderBy: {field: UPDATED_AT, direction: DESC}) {
      totalCount
      pageInfo { hasNextPage endCursor }
      nodes { number title updatedAt url assignees(first: 10) { nodes { login } } }
    }
  }
}`;
}

/** Variables for groupQuery(kind): the remote's repository, the page after `after` (null: the first), and for Assigned the gh account's login. */
export function groupVariables(
	kind: GroupKind,
	remote: RemoteRepo,
	login: string,
	after: string | null,
): Record<string, string | null> {
	return { owner: remote.owner, name: remote.repo, after, ...(kind === "assigned" ? { assignee: login } : {}) };
}

interface IssuesData {
	repository: {
		hasIssuesEnabled: boolean;
		issues: {
			totalCount: number;
			pageInfo: { hasNextPage: boolean; endCursor: string | null };
			nodes: {
				number: number;
				title: string;
				updatedAt: string;
				url: string;
				assignees: { nodes: { login: string }[] };
			}[];
		};
	};
}

/**
 * The group once `change` happened, before GitHub is asked again: the issue leaves the groups it
 * no longer belongs in and heads the one it joins (most recently updated first). Applying it again
 * changes nothing. A row not loaded (on a later page) is left for the next load to count.
 */
export function applyChange(kind: GroupKind, group: IssueGroup, change: IssueChange, login: string): IssueGroup {
	const belongs =
		change.state === "closed"
			? kind === "closed"
			: kind === "open" ||
				(kind === "assigned" && change.issue.assignees.some((a) => a.toLowerCase() === login.toLowerCase()));
	const others = group.issues.filter((i) => i.number !== change.issue.number);
	const shown = others.length < group.issues.length;
	if (belongs) return { ...group, total: group.total + (shown ? 0 : 1), issues: [change.issue, ...others] };
	return shown ? { ...group, total: group.total - 1, issues: others } : group;
}

/**
 * The loaded rows followed by the next page's (Load more); total, more and cursor from the page.
 * An issue updated between the loads can come again: it stays where it was, once.
 */
export function appendPage(group: IssueGroup, page: IssueGroup): IssueGroup {
	const shown = new Set(group.issues.map((i) => i.number));
	return { ...page, issues: [...group.issues, ...page.issues.filter((i) => !shown.has(i.number))] };
}

/** A group query that failed: not there / not visible (404), or another reason. */
export interface Failure {
	notFound: boolean;
	message: string;
}

/** What the sidebar knows when it draws the list; undefined: not known yet. */
export interface ListState {
	account: Account | undefined;
	remote: RemoteRepo | null | undefined;
	group?: IssueGroup;
	failure?: Failure;
}

/** What the sidebar says in a folder (`cwd`) without a GitHub remote: a quiet empty state, not an error. */
export function noRepository(cwd: string | null): { title: string; detail: string } {
	const hint = "Focus a terminal in a repository cloned from GitHub.";
	const name = cwd ? cwd.replace(/\/+$/, "").split("/").pop() || "/" : null;
	return { title: "No GitHub repository", detail: name ? `${name} has no GitHub remote. ${hint}` : hint };
}

/**
 * The problem the list's place reports instead of rows, or null when there is none: a list,
 * nothing known yet, or a folder without a GitHub remote (not a problem: see noRepository).
 */
export function issuesNotice(s: ListState): string | null {
	if (s.account && !s.account.status.ok) return describeAccount(s.account).text;
	if (s.remote === null) return null;
	const repo = s.remote ? `${s.remote.owner}/${s.remote.repo}` : "the repository";
	if (s.failure?.notFound && s.remote) {
		const user = s.account?.status.ok ? s.account.status.user : "this account";
		return `${repo} (remote "${s.remote.remote}") isn't on GitHub, or ${user} can't see it. Check git remote -v.`;
	}
	if (s.failure) return s.failure.message;
	if (s.group && !s.group.issuesEnabled) return `Issues are turned off for ${repo}.`;
	return null;
}

/** A group query's `data` as rows. */
export function parseIssueGroup(data: unknown): IssueGroup {
	const { hasIssuesEnabled, issues } = (data as IssuesData).repository;
	return {
		issuesEnabled: hasIssuesEnabled,
		total: issues.totalCount,
		more: issues.pageInfo.hasNextPage,
		cursor: issues.pageInfo.endCursor,
		issues: issues.nodes.map((n) => ({
			number: n.number,
			title: n.title,
			assignees: n.assignees.nodes.map((a) => a.login),
			updatedAt: n.updatedAt,
			url: n.url,
		})),
	};
}

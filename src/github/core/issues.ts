// The Issues tab: its groups, their query and rows, and how a close or reopen moves a row between them.

import type { Query } from "./gh.ts";
import { PAGE, type Page } from "./page.ts";
import type { RemoteRepo } from "./remote.ts";

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

/** Open issues assigned to the gh account, all open, all closed. */
export type GroupKind = "assigned" | "open" | "closed";

export interface IssueGroup extends Page<Issue> {
	/** False when the repository has Issues turned off: then there are no rows. */
	issuesEnabled: boolean;
}

/** A group's page (`after` null: the first), most recently updated first, with whether Issues are on. */
export function issueGroupQuery(kind: GroupKind, remote: RemoteRepo, login: string, after: string | null): Query {
	const assigned = kind === "assigned";
	return {
		query: `query($owner: String!, $name: String!, $after: String${assigned ? ", $assignee: String!" : ""}) {
  repository(owner: $owner, name: $name) {
    hasIssuesEnabled
    issues(first: ${PAGE}, after: $after, states: ${kind === "closed" ? "CLOSED" : "OPEN"}${assigned ? ", filterBy: {assignee: $assignee}" : ""}, orderBy: {field: UPDATED_AT, direction: DESC}) {
      totalCount
      pageInfo { hasNextPage endCursor }
      nodes { number title updatedAt url assignees(first: 10) { nodes { login } } }
    }
  }
}`,
		variables: { owner: remote.owner, name: remote.repo, after, ...(assigned ? { assignee: login } : {}) },
	};
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

export function parseIssueGroup(data: unknown): IssueGroup {
	const { hasIssuesEnabled, issues } = (data as IssuesData).repository;
	return {
		issuesEnabled: hasIssuesEnabled,
		total: issues.totalCount,
		more: issues.pageInfo.hasNextPage,
		cursor: issues.pageInfo.endCursor,
		rows: issues.nodes.map((n) => ({
			number: n.number,
			title: n.title,
			assignees: n.assignees.nodes.map((a) => a.login),
			updatedAt: n.updatedAt,
			url: n.url,
		})),
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
	const others = group.rows.filter((i) => i.number !== change.issue.number);
	const shown = others.length < group.rows.length;
	if (belongs) return { ...group, total: group.total + (shown ? 0 : 1), rows: [change.issue, ...others] };
	return shown ? { ...group, total: group.total - 1, rows: others } : group;
}

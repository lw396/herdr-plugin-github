// Issue groups in the sidebar: the GraphQL query for one page of a group, and its reply as rows.
import type { RemoteRepo } from "./remote.ts";
import { describeAccount, type Account } from "./account.ts";

/** One row of an issue group. */
export interface Issue {
  number: number;
  title: string;
  assignees: string[];
  /** ISO time, as GitHub sends it. */
  updatedAt: string;
  url: string;
}

/** One page of a group: its rows, how many there are in all, and whether more pages follow. */
export interface IssueGroup {
  /** False when the repository has Issues turned off: then there are no rows. */
  issuesEnabled: boolean;
  total: number;
  more: boolean;
  issues: Issue[];
}

const PAGE = 30;

/** Open issues assigned to `$assignee`, most recently updated first; with whether Issues are on. */
export const ASSIGNED_QUERY = `query($owner: String!, $name: String!, $assignee: String!) {
  repository(owner: $owner, name: $name) {
    hasIssuesEnabled
    issues(first: ${PAGE}, states: OPEN, filterBy: {assignee: $assignee}, orderBy: {field: UPDATED_AT, direction: DESC}) {
      totalCount
      pageInfo { hasNextPage endCursor }
      nodes { number title updatedAt url assignees(first: 10) { nodes { login } } }
    }
  }
}`;

/** Variables for ASSIGNED_QUERY: the remote's repository, assigned to the gh account's login. */
export function assignedVariables(remote: RemoteRepo, login: string): { owner: string; name: string; assignee: string } {
  return { owner: remote.owner, name: remote.repo, assignee: login };
}

interface IssuesData {
  repository: {
    hasIssuesEnabled: boolean;
    issues: {
      totalCount: number;
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: { number: number; title: string; updatedAt: string; url: string; assignees: { nodes: { login: string }[] } }[];
    };
  };
}

/** What the sidebar knows when it draws the list; undefined: not known yet. */
export interface ListState {
  account: Account | undefined;
  remote: RemoteRepo | null | undefined;
  group?: IssueGroup;
  /** The group query failed: not there / not visible (404), or another reason. */
  failure?: { notFound: boolean; message: string };
}

/** What the list's place says instead of rows, or null when there is a list (or nothing known yet). */
export function issuesNotice(s: ListState): string | null {
  if (s.account && !s.account.status.ok) return describeAccount(s.account).text;
  if (s.remote === null) return "No GitHub remote in this folder (git remote -v).";
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
    issues: issues.nodes.map((n) => ({ number: n.number, title: n.title, assignees: n.assignees.nodes.map((a) => a.login), updatedAt: n.updatedAt, url: n.url })),
  };
}

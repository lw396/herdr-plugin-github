import { describeAccount } from "./account.js";
/** Rows per page: the first page, and each Load more. */
const PAGE = 30;
/** A page of a group, most recently updated first; with whether Issues are on. */
export function groupQuery(kind) {
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
export function groupVariables(kind, remote, login, after) {
    return { owner: remote.owner, name: remote.repo, after, ...(kind === "assigned" ? { assignee: login } : {}) };
}
/**
 * The loaded rows followed by the next page's (Load more); total, more and cursor from the page.
 * An issue updated between the loads can come again: it stays where it was, once.
 */
export function appendPage(group, page) {
    const shown = new Set(group.issues.map((i) => i.number));
    return { ...page, issues: [...group.issues, ...page.issues.filter((i) => !shown.has(i.number))] };
}
/** What the sidebar says in a folder (`cwd`) without a GitHub remote: a quiet empty state, not an error. */
export function noRepository(cwd) {
    const hint = "Focus a terminal in a repository cloned from GitHub.";
    const name = cwd ? cwd.replace(/\/+$/, "").split("/").pop() || "/" : null;
    return { title: "No GitHub repository", detail: name ? `${name} has no GitHub remote. ${hint}` : hint };
}
/**
 * The problem the list's place reports instead of rows, or null when there is none: a list,
 * nothing known yet, or a folder without a GitHub remote (not a problem: see noRepository).
 */
export function issuesNotice(s) {
    if (s.account && !s.account.status.ok)
        return describeAccount(s.account).text;
    if (s.remote === null)
        return null;
    const repo = s.remote ? `${s.remote.owner}/${s.remote.repo}` : "the repository";
    if (s.failure?.notFound && s.remote) {
        const user = s.account?.status.ok ? s.account.status.user : "this account";
        return `${repo} (remote "${s.remote.remote}") isn't on GitHub, or ${user} can't see it. Check git remote -v.`;
    }
    if (s.failure)
        return s.failure.message;
    if (s.group && !s.group.issuesEnabled)
        return `Issues are turned off for ${repo}.`;
    return null;
}
/** A group query's `data` as rows. */
export function parseIssueGroup(data) {
    const { hasIssuesEnabled, issues } = data.repository;
    return {
        issuesEnabled: hasIssuesEnabled,
        total: issues.totalCount,
        more: issues.pageInfo.hasNextPage,
        cursor: issues.pageInfo.endCursor,
        issues: issues.nodes.map((n) => ({ number: n.number, title: n.title, assignees: n.assignees.nodes.map((a) => a.login), updatedAt: n.updatedAt, url: n.url })),
    };
}

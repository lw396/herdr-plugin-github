import { describeAccount } from "./account.js";
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
export function assignedVariables(remote, login) {
    return { owner: remote.owner, name: remote.repo, assignee: login };
}
/** What the list's place says instead of rows, or null when there is a list (or nothing known yet). */
export function issuesNotice(s) {
    if (s.account && !s.account.status.ok)
        return describeAccount(s.account).text;
    if (s.remote === null)
        return "No GitHub remote in this folder (git remote -v).";
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
        issues: issues.nodes.map((n) => ({ number: n.number, title: n.title, assignees: n.assignees.nodes.map((a) => a.login), updatedAt: n.updatedAt, url: n.url })),
    };
}

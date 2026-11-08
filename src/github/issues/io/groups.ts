import type { IssueChange } from "../../detail/core/issue-change.ts";
import { pagedGroups } from "../../sidebar/io/groups.ts";
import { applyChange, type GroupKind, type IssueGroup } from "../core/issues.ts";
import { issuePage } from "./issues.ts";

const issueGroups = pagedGroups<GroupKind, IssueGroup>((kind, r, after) =>
	issuePage(kind, r.remote, r.login, r.on, after),
);

export const issueGroup = issueGroups.look;
export const peekIssueGroup = issueGroups.peek;
export const moreIssues = issueGroups.more;

/**
 * An issue closed or reopened (in a reader, maybe another view's): every kept group of its
 * repository shows it where it now belongs at once, and is asked again on the next look.
 */
export function issueChanged(change: IssueChange): void {
	const repo = change.repo.toLowerCase();
	issueGroups.patch((g, group) => (g.repo === repo ? applyChange(g.kind, group, change, g.login) : undefined));
}

export function invalidateIssues(repo: string): void {
	issueGroups.patch((where, group) => (where.repo === repo.toLowerCase() ? group : undefined));
}

export function clear(): void {
	issueGroups.clear();
}

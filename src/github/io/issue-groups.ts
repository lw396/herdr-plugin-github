// The Issues tab's groups, kept per kind, machine, repository and login.

import { applyChange, type GroupKind, type IssueChange, type IssueGroup } from "../core/issues.ts";
import { groupOf, pagedGroups } from "./groups.ts";
import { issuePage } from "./issues.ts";

const issueGroups = pagedGroups<GroupKind, IssueGroup>((kind, r, after) =>
	issuePage(kind, r.remote, r.login, r.on, after),
);

/** An issue group's first page, and any pages Load more added. */
export const issueGroup = issueGroups.look;
export const peekIssueGroup = issueGroups.peek;
export const moreIssues = issueGroups.more;

/**
 * An issue closed or reopened (in a reader, maybe another view's): every kept group of its
 * repository shows it where it now belongs at once, and is asked again on the next look.
 */
export function issueChanged(change: IssueChange): void {
	const repo = change.repo.toLowerCase();
	issueGroups.kept.patch((key, group) => {
		const g = groupOf(key);
		return g.repo === repo ? applyChange(g.kind as GroupKind, group, change, g.login) : undefined;
	});
}

/** Forgets everything (tests). */
export function clear(): void {
	issueGroups.kept.clear();
}

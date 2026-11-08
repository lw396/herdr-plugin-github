// Issues from GitHub, through gh on the folder's or reader tab's machine (ADR 0003).

import { detailUrl } from "../../detail/core/detail.ts";
import { type Comment, parseComment } from "../../detail/core/discussion.ts";
import type { IssueChange } from "../../detail/core/issue-change.ts";
import { written } from "../../detail/io/changes.ts";
import type { RemoteRepo } from "../../shared/core/remote.ts";
import { api, changes, graphql } from "../../shared/io/gh.ts";
import { type IssueDetail, parseIssueDetail } from "../core/issue-detail.ts";
import { type GroupKind, type IssueGroup, issueGroupQuery, parseIssueChange, parseIssueGroup } from "../core/issues.ts";

/** Whether the repository's issues changed, without spending a search request on unchanged groups. */
export const listChanges = (repo: string, etag: string | null, on: string | null) =>
	changes(`repos/${repo}/issues?state=all&sort=updated&per_page=1`, etag, on);

/** A single issue's validator also changes when a new comment is posted (recorded in #17). */
export const issueChanges = (repo: string, number: number, etag: string | null, on: string | null) =>
	changes(`repos/${repo}/issues/${number}`, etag, on);

export async function issuePage(
	kind: GroupKind,
	remote: RemoteRepo,
	login: string,
	on: string | null,
	after: string | null,
): Promise<IssueGroup> {
	return parseIssueGroup(await graphql(issueGroupQuery(kind, remote, login, after), on));
}

/** One issue and all timeline pages: the timeline carries both the comments and the activity. */
export async function readIssue(repo: string, number: number, on: string | null): Promise<IssueDetail> {
	const path = `repos/${repo}/issues/${number}`;
	const [issue, timeline] = await Promise.all([
		api(path, { on }),
		api(`${path}/timeline?per_page=100`, { on, paginate: true }),
	]);
	return parseIssueDetail(issue, timeline);
}

export async function addComment(repo: string, number: number, body: string, on: string | null): Promise<Comment> {
	return written(
		{ repo, number, issue: true },
		async () =>
			parseComment(
				await api(`repos/${repo}/issues/${number}/comments`, { on, method: "POST", rawFields: { body } }),
				detailUrl({ kind: "issue", repo, number }),
			),
		(comment) => ({ repo, number, comment }),
	);
}

export async function setIssueState(
	repo: string,
	number: number,
	state: IssueChange["state"],
	on: string | null,
): Promise<IssueChange> {
	return written(
		{ repo, number, issue: true },
		async () =>
			parseIssueChange(
				await api(`repos/${repo}/issues/${number}`, { on, method: "PATCH", rawFields: { state } }),
				repo,
			),
		(state) => ({ repo, number, state }),
	);
}

// The PR description page: REST replies become ready-to-render Markdown and read-only metadata.
import { type Comment, parseComment, parseReactions, type Reaction } from "./issue-detail.ts";
import { type Label, parseLabel } from "./labels.ts";
import { readerMarkdown } from "./markdown.ts";
import type { PullState } from "./pulls.ts";

export type ReviewState = "requested" | "approved" | "changes_requested" | "commented" | "dismissed";
export interface Reviewer {
	name: string;
	state: ReviewState;
	team: boolean;
}

export interface PullDetail {
	number: number;
	title: string;
	state: PullState;
	author: string;
	createdAt: string;
	url: string;
	head: string;
	base: string;
	labels: Label[];
	assignees: string[];
	milestone: string | null;
	body: string;
	markdown: string;
	reactions: Reaction[];
	comments: Comment[];
	reviewers: Reviewer[];
}

interface RestPull {
	number: number;
	title: string;
	state: "open" | "closed";
	merged: boolean;
	draft: boolean;
	user: { login: string } | null;
	created_at: string;
	html_url: string;
	head: { label: string; ref: string };
	base: { label: string; ref: string };
	labels: (string | { name: string; color?: string })[];
	assignees: { login: string }[];
	milestone: { title: string } | null;
	body: string | null;
	requested_reviewers: { login: string }[];
	requested_teams: { slug: string }[];
}

interface RestReview {
	id: number;
	user: { login: string } | null;
	state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED" | "PENDING";
	submitted_at: string | null;
}

/** As in the VS Code extension's parseReviewers: latest non-pending review, no author, requests override. */
function reviewers(pull: RestPull, reviews: RestReview[]): Reviewer[] {
	const byName = new Map<string, Reviewer>();
	for (const review of [...reviews].sort(
		(a, b) => (b.submitted_at ?? "").localeCompare(a.submitted_at ?? "") || b.id - a.id,
	)) {
		if (review.state === "PENDING" || !review.submitted_at) continue;
		const name = review.user?.login ?? "deleted user";
		const key = name.toLowerCase();
		if (key === pull.user?.login.toLowerCase() || byName.has(key)) continue;
		byName.set(key, { name, state: review.state.toLowerCase() as ReviewState, team: false });
	}
	for (const user of pull.requested_reviewers)
		byName.set(user.login.toLowerCase(), { name: user.login, state: "requested", team: false });
	for (const team of pull.requested_teams)
		byName.set(`team:${team.slug}`, { name: team.slug, state: "requested", team: true });
	return [...byName.values()];
}

export function parsePullDetail(pull: unknown, issue: unknown, comments: unknown, reviews: unknown): PullDetail {
	const p = pull as RestPull;
	const crossOwner = p.head.label.split(":")[0]?.toLowerCase() !== p.base.label.split(":")[0]?.toLowerCase();
	const reactions = (issue as { reactions?: Record<string, number | string> }).reactions;
	return {
		number: p.number,
		title: p.title,
		state: p.merged ? "merged" : p.state === "closed" ? "closed" : p.draft ? "draft" : "open",
		author: p.user?.login ?? "deleted user",
		createdAt: p.created_at,
		url: p.html_url,
		head: crossOwner ? p.head.label || p.head.ref : p.head.ref,
		base: crossOwner ? p.base.label || p.base.ref : p.base.ref,
		labels: p.labels.map(parseLabel),
		assignees: p.assignees.map((a) => a.login),
		milestone: p.milestone?.title ?? null,
		body: p.body ?? "",
		markdown: readerMarkdown(p.body ?? "", p.html_url),
		reactions: parseReactions(reactions),
		reviewers: reviewers(p, reviews as RestReview[]),
		comments: (comments as unknown[])
			.map((c) => parseComment(c, p.html_url))
			.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id),
	};
}

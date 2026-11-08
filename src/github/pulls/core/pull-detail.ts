import { parseComments } from "../../detail/core/discussion.ts";
import { type Item, parseItem, type RestItem } from "../../detail/core/item.ts";
import { type PullState, pullState } from "../../detail/core/state.ts";
import { type PullCheck, parseChecks } from "./checks.ts";
import { type MergeInfo, mergeInfo, type RestMergePull } from "./merge.ts";
import { type PullTimelineItem, pullTimeline } from "./pull-timeline.ts";
import { parseReviewers, type RestReview, type Reviewer } from "./reviewers.ts";

export interface PullDetail extends Item {
	state: PullState;
	head: string;
	headSha: string;
	base: string;
	merge: MergeInfo;
	timeline: PullTimelineItem[];
	checks: PullCheck[];
	reviewers: Reviewer[];
}

interface RestPull extends RestItem, RestMergePull {
	state: "open" | "closed";
	merged: boolean;
	draft: boolean;
	head: RestMergePull["head"] & { label: string };
	base: { label: string; ref: string };
	requested_reviewers: { login: string }[];
	requested_teams: { slug: string }[];
}

/** The REST replies one PR page reads: everything paginated is already flattened. */
export interface PullReplies {
	pull: unknown;
	/** Its issue resource: the description's reactions live there. */
	issue: unknown;
	repository: unknown;
	comments: unknown[];
	reviews: unknown[];
	events: unknown[];
	inline: unknown[];
	checkRuns: unknown;
	statuses: unknown[];
}

export function parsePullDetail(r: PullReplies): PullDetail {
	const p = r.pull as RestPull;
	const crossOwner = p.head.label.split(":")[0]?.toLowerCase() !== p.base.label.split(":")[0]?.toLowerCase();
	const reviewers = parseReviewers(p, r.reviews as RestReview[]);
	const checks = parseChecks(r.checkRuns, r.statuses);
	const comments = parseComments(r.comments, p.html_url);
	return {
		...parseItem(p, (r.issue as { reactions?: Record<string, number | string> }).reactions),
		state: pullState(p.merged ? "merged" : p.state, p.draft),
		head: crossOwner ? p.head.label || p.head.ref : p.head.ref,
		headSha: p.head.sha,
		base: crossOwner ? p.base.label || p.base.ref : p.base.ref,
		merge: mergeInfo(p, r.repository as Record<string, unknown>, reviewers, checks),
		timeline: pullTimeline(comments, r.events, r.reviews, r.inline, p.html_url),
		checks,
		reviewers,
	};
}

/** Commit-dependent replies need the head SHA from the pull request itself. */
export const pullHead = (pull: unknown): string => (pull as RestPull).head.sha;

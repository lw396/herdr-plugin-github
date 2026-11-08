import { login } from "../../detail/core/discussion.ts";

export type ReviewState = "requested" | "approved" | "changes_requested" | "commented" | "dismissed";
export interface Reviewer {
	name: string;
	state: ReviewState;
	team: boolean;
}

export interface RestReview {
	id: number;
	user: { login: string } | null;
	state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED" | "PENDING";
	submitted_at: string | null;
	body: string | null;
}

/** Pending reviews stay private to their author: neither reviewers nor the timeline show them. */
export const submitted = (review: RestReview): boolean => review.state !== "PENDING" && Boolean(review.submitted_at);

interface Requests {
	user: { login: string } | null;
	requested_reviewers: { login: string }[];
	requested_teams: { slug: string }[];
}

/** As in the VS Code extension's parseReviewers: latest submitted review, no author, requests override. */
export function parseReviewers(pull: Requests, reviews: RestReview[]): Reviewer[] {
	const byName = new Map<string, Reviewer>();
	for (const review of reviews
		.filter(submitted)
		.sort((a, b) => (b.submitted_at ?? "").localeCompare(a.submitted_at ?? "") || b.id - a.id)) {
		const name = login(review.user);
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

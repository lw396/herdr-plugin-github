import { activityText, parseActivity } from "../../detail/core/activity.ts";
import { type Comment, login, parseComment } from "../../detail/core/discussion.ts";
import type { Label } from "../../detail/core/labels.ts";
import { readerMarkdown } from "../../detail/core/markdown.ts";
import { type RestReview, submitted } from "./reviewers.ts";

interface Event {
	id?: number;
	event: string;
	actor?: { login: string };
	created_at: string;
	sha?: string;
	message?: string;
	author?: { name: string; date: string };
	label?: { name: string; color?: string };
	assignee?: { login: string };
	commit_id?: string;
}
interface Inline {
	id: number;
	pull_request_review_id: number;
	in_reply_to_id?: number;
	path: string;
	diff_hunk: string;
	body: string;
	user: { login: string } | null;
	created_at: string;
	reactions?: Record<string, number | string>;
}
export interface PullTimelineItem extends Omit<Comment, "id"> {
	id: number | string;
	kind: "comment" | "review" | "event";
	verb: string;
	reviewState?: string;
	/** Labels added or removed by a label event, shown as chips rather than text. */
	labels?: Label[];
	/** Commit message after the subject, hidden until explicitly expanded. */
	details?: { body: string; markdown: string };
	discussion: { root: number; comment: Comment; path: string; snippet: string }[];
}

export const timelineKey = (item: PullTimelineItem): string => `${item.kind}-${item.id}`;

export function timelineOrder(a: PullTimelineItem, b: PullTimelineItem): number {
	const time = a.createdAt.localeCompare(b.createdAt);
	if (time) return time;
	if (typeof a.id === "number") return typeof b.id === "number" ? a.id - b.id : -1;
	return typeof b.id === "number" ? 1 : a.id.localeCompare(b.id);
}

/** A reply can create a body-less COMMENTED review; its content already belongs to the original conversation. */
export const replyOnlyReview = (commented: boolean, body: string | null, roots: number, replies: number): boolean =>
	commented && !body?.trim() && roots === 0 && replies > 0;

/** Separate endpoints are merged once; pending reviews remain private, not published activity.
 * Adjacent same-time label changes by one person are grouped, as in the issue timeline. */
export function pullTimeline(
	comments: Comment[],
	events: unknown[],
	reviews: unknown[],
	inline: unknown[],
	url: string,
): PullTimelineItem[] {
	const result: PullTimelineItem[] = comments.map((c) => ({
		...c,
		kind: "comment",
		verb: "commented",
		discussion: [],
	}));
	for (const r of (reviews as RestReview[]).filter(submitted)) {
		const all = inline as Inline[];
		// Replies may belong to a later review; keep the conversation beside its original code snippet.
		const roots = all
			.filter((c) => !c.in_reply_to_id && c.pull_request_review_id === r.id)
			.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id);
		const replies = all.filter((c) => c.pull_request_review_id === r.id && c.in_reply_to_id).length;
		if (replyOnlyReview(r.state === "COMMENTED", r.body, roots.length, replies)) continue;
		const discussion = roots
			.flatMap((root) => [
				root,
				...all
					.filter((c) => c.in_reply_to_id === root.id)
					.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id),
			])
			.map((c) => ({
				root: c.in_reply_to_id ?? c.id,
				comment: parseComment(c, url),
				path: c.path,
				snippet: c.in_reply_to_id ? "" : c.diff_hunk,
			}));
		const verbs: Record<string, string> = {
			APPROVED: "approved these changes",
			CHANGES_REQUESTED: "requested changes",
			COMMENTED: "reviewed",
			DISMISSED: "review dismissed",
		};
		result.push({
			...parseComment({ id: r.id, user: r.user, body: r.body, created_at: r.submitted_at }, url),
			kind: "review",
			verb: verbs[r.state] ?? "reviewed",
			reviewState: r.state,
			discussion,
		});
	}
	for (const e of events as Event[]) {
		let verb = "";
		let body = "";
		let details: PullTimelineItem["details"];
		let labels: Label[] | undefined;
		const activity = parseActivity([e])[0];
		if (activity) {
			verb = activityText(activity);
			if ("labels" in activity) labels = activity.labels;
		} else if (e.event === "committed") {
			verb = "committed";
			const [subject = "", ...lines] = (e.message ?? "").trim().split(/\r?\n/);
			body = `${e.sha?.slice(0, 7) ?? ""} ${subject}`.trim();
			const rest = lines.join("\n").trim();
			if (rest) details = { body: rest, markdown: readerMarkdown(rest, url) };
		} else if (e.event === "head_ref_force_pushed") {
			verb = "force-pushed the branch";
			body = e.commit_id?.slice(0, 7) ?? "";
		} else if (e.event === "merged") {
			verb = "merged this";
			body = e.commit_id?.slice(0, 7) ?? "";
		} else if (e.event === "closed") verb = "closed this";
		else if (e.event === "reopened") verb = "reopened this";
		else continue;
		result.push({
			id: e.id ?? JSON.stringify([e.event, e.sha ?? e.commit_id, e.created_at ?? e.author?.date]),
			author: e.actor ? login(e.actor) : (e.author?.name ?? "deleted user"),
			createdAt: e.created_at ?? e.author?.date ?? "",
			body,
			markdown: readerMarkdown(body, url),
			reactions: [],
			kind: "event",
			verb,
			...(labels ? { labels } : {}),
			...(details ? { details } : {}),
			discussion: [],
		});
	}
	const shown: PullTimelineItem[] = [];
	for (const item of result.sort(timelineOrder)) {
		const previous = shown.at(-1);
		if (
			item.labels &&
			previous?.labels &&
			item.verb === previous.verb &&
			item.author === previous.author &&
			item.createdAt === previous.createdAt
		) {
			shown[shown.length - 1] = { ...previous, labels: [...previous.labels, ...item.labels] };
		} else shown.push(item);
	}
	return shown;
}

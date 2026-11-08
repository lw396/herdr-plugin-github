import { activityText, parseActivity } from "./activity.ts";
import { type Comment, login, parseComment } from "./discussion.ts";
import { readerMarkdown } from "./markdown.ts";

interface Event {
	id: number;
	event: string;
	actor?: { login: string };
	created_at: string;
	sha?: string;
	message?: string;
	author?: { name: string; date: string };
	label?: { name: string };
	assignee?: { login: string };
	commit_id?: string;
}
interface Review {
	id: number;
	user: { login: string } | null;
	submitted_at: string | null;
	state: string;
	body: string | null;
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
export interface PullTimelineItem extends Comment {
	kind: "comment" | "review" | "event";
	verb: string;
	/** Commit message after the subject, hidden until explicitly expanded. */
	details?: { body: string; markdown: string };
	discussion: { root: number; comment: Comment; path: string; snippet: string }[];
}

/** Separate endpoints are merged once; pending reviews remain private, not published activity. */
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
	for (const r of reviews as Review[]) {
		if (!r.submitted_at || r.state === "PENDING") continue;
		const all = inline as Inline[];
		// Replies may belong to a later review; keep the conversation beside its original code snippet.
		const roots = all
			.filter((c) => !c.in_reply_to_id && c.pull_request_review_id === r.id)
			.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id);
		// A reply can create a body-less COMMENTED review; its content already belongs to the original conversation.
		if (
			r.state === "COMMENTED" &&
			!r.body?.trim() &&
			roots.length === 0 &&
			all.some((c) => c.pull_request_review_id === r.id && c.in_reply_to_id)
		)
			continue;
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
			discussion,
		});
	}
	for (const e of events as Event[]) {
		let verb = "";
		let body = "";
		let details: PullTimelineItem["details"];
		const activity = parseActivity([e])[0];
		if (activity) {
			verb = activityText(activity);
			body = "labels" in activity ? activity.labels.map((l) => l.name).join(", ") : "";
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
			id: e.id ?? result.length,
			author: e.actor ? login(e.actor) : (e.author?.name ?? "deleted user"),
			createdAt: e.created_at ?? e.author?.date ?? "",
			body,
			markdown: readerMarkdown(body, url),
			reactions: [],
			kind: "event",
			verb,
			...(details ? { details } : {}),
			discussion: [],
		});
	}
	return result.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id);
}
export interface PullCheck {
	id: string;
	name: string;
	status: string;
	duration: string;
	url: string;
}
interface CheckRun {
	id: number;
	name: string;
	status: string;
	conclusion: string | null;
	started_at: string | null;
	completed_at: string | null;
	html_url: string;
}
interface Status {
	id: number;
	context: string;
	state: string;
	target_url: string | null;
}
export function parseChecks(pages: unknown[], statuses: unknown[]): PullCheck[] {
	const checks = pages
		.flatMap((p) => (p as { check_runs: CheckRun[] }).check_runs)
		.map((c) => {
			const seconds =
				c.started_at && c.completed_at
					? Math.max(0, Math.floor((Date.parse(c.completed_at) - Date.parse(c.started_at)) / 1000))
					: null;
			return {
				id: `check-${c.id}`,
				name: c.name,
				status: c.conclusion ?? c.status,
				duration: seconds === null ? "—" : `${Math.floor(seconds / 60)}m ${seconds % 60}s`,
				url: c.html_url,
			};
		});
	const seen = new Set<string>();
	for (const s of statuses as Status[]) {
		if (seen.has(s.context)) continue;
		seen.add(s.context);
		checks.push({ id: `status-${s.id}`, name: s.context, status: s.state, duration: "—", url: s.target_url ?? "" });
	}
	return checks;
}

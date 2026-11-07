import { type Activity, parseActivity } from "./activity.ts";
import { type Label, parseLabel } from "./labels.ts";
import { readerMarkdown } from "./markdown.ts";

export type { Label };
export interface IssueRef {
	repo: string;
	number: number;
}
export const issueKey = (ref: IssueRef): string => `${ref.repo.toLowerCase()}#${ref.number}`;

/** Keep native tabs compact; the full repository remains visible in the reader's link tooltip. */
export const issueTabName = (ref: IssueRef): string => `#${ref.number} · ${ref.repo.split("/").at(-1)}`;

export interface Reaction {
	emoji: string;
	count: number;
}

export interface Comment {
	id: number;
	author: string;
	createdAt: string;
	body: string;
	/** body as the reader renders it: prepared once here, not on every render (parsing is slow in QuickJS). */
	markdown: string;
	reactions: Reaction[];
}

export interface IssueDetail {
	number: number;
	title: string;
	state: "open" | "closed";
	author: string;
	createdAt: string;
	url: string;
	labels: Label[];
	assignees: string[];
	milestone: string | null;
	body: string;
	markdown: string;
	comments: Comment[];
	activities: Activity[];
}

/** A comments endpoint's comment; a timeline "commented" event has the same fields and its `event`. */
interface RestComment {
	event?: string;
	id: number;
	user: { login: string } | null;
	created_at: string;
	body: string | null;
	reactions: Record<string, number | string>;
}

interface RestIssue {
	number: number;
	title: string;
	state: "open" | "closed";
	user: { login: string } | null;
	created_at: string;
	html_url: string;
	labels: (string | { name: string; color?: string })[];
	assignees: { login: string }[];
	milestone: { title: string } | null;
	body: string | null;
}

const EMOJI: [string, string][] = [
	["+1", "👍"],
	["-1", "👎"],
	["laugh", "😄"],
	["hooray", "🎉"],
	["confused", "😕"],
	["heart", "❤️"],
	["rocket", "🚀"],
	["eyes", "👀"],
];

/** A REST comment as the reader shows it (non-zero reaction counts); `issueUrl` resolves its #123 references. */
export function parseComment(comment: unknown, issueUrl: string): Comment {
	const c = comment as RestComment;
	return {
		id: c.id,
		author: c.user?.login ?? "deleted user",
		createdAt: c.created_at,
		body: c.body ?? "",
		markdown: readerMarkdown(c.body ?? "", issueUrl),
		reactions: EMOJI.flatMap(([key, emoji]) => {
			const count = c.reactions[key];
			return typeof count === "number" && count > 0 ? [{ emoji, count }] : [];
		}),
	};
}

/** GitHub's REST issue and timeline, with comments in creation order and non-zero reaction counts. */
export function parseIssueDetail(issue: unknown, timeline: unknown): IssueDetail {
	const i = issue as RestIssue,
		events = timeline as RestComment[];
	return {
		number: i.number,
		title: i.title,
		state: i.state,
		author: i.user?.login ?? "deleted user",
		createdAt: i.created_at,
		url: i.html_url,
		labels: i.labels.map(parseLabel),
		assignees: i.assignees.map((a) => a.login),
		milestone: i.milestone?.title ?? null,
		body: i.body ?? "",
		markdown: readerMarkdown(i.body ?? "", i.html_url),
		activities: parseActivity(events),
		comments: events
			.filter((e) => e.event === "commented")
			.map((c) => parseComment(c, i.html_url))
			.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id),
	};
}

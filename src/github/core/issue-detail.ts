import { type Activity, parseActivity } from "./activity.ts";
import { type Comment, login, parseComments } from "./discussion.ts";
import { type Label, parseLabel } from "./labels.ts";
import { readerMarkdown } from "./markdown.ts";

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

/** GitHub's REST issue and its timeline, which carries both the comments and the activity. */
export function parseIssueDetail(issue: unknown, timeline: unknown): IssueDetail {
	const i = issue as RestIssue,
		events = timeline as { event?: string }[];
	return {
		number: i.number,
		title: i.title,
		state: i.state,
		author: login(i.user),
		createdAt: i.created_at,
		url: i.html_url,
		labels: i.labels.map(parseLabel),
		assignees: i.assignees.map((a) => a.login),
		milestone: i.milestone?.title ?? null,
		body: i.body ?? "",
		markdown: readerMarkdown(i.body ?? "", i.html_url),
		activities: parseActivity(events),
		comments: parseComments(
			events.filter((e) => e.event === "commented"),
			i.html_url,
		),
	};
}

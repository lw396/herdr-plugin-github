import { login, parseReactions, type Reaction } from "./discussion.ts";
import { type Label, parseLabel } from "./labels.ts";
import { readerMarkdown } from "./markdown.ts";

export interface Item {
	title: string;
	author: string;
	createdAt: string;
	url: string;
	labels: Label[];
	assignees: string[];
	milestone: string | null;
	/** Prepared once here, not on every render: parsing is slow in QuickJS. */
	markdown: string;
	reactions: Reaction[];
}

export interface RestItem {
	title: string;
	user: { login: string } | null;
	created_at: string;
	html_url: string;
	labels: (string | { name: string; color?: string })[];
	assignees: { login: string }[];
	milestone: { title: string } | null;
	body: string | null;
	reactions?: Record<string, number | string>;
}

/** A PR's reactions live on its issue resource, not on the REST pull request. */
export function parseItem(item: RestItem, reactions = item.reactions): Item {
	return {
		title: item.title,
		author: login(item.user),
		createdAt: item.created_at,
		url: item.html_url,
		labels: item.labels.map(parseLabel),
		assignees: item.assignees.map((a) => a.login),
		milestone: item.milestone?.title ?? null,
		markdown: readerMarkdown(item.body ?? "", item.html_url),
		reactions: parseReactions(reactions),
	};
}

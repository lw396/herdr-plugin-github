import { readerMarkdown } from "./markdown.ts";

export interface Reaction {
	emoji: string;
	count: number;
}

export interface Comment {
	/** Confirmed on GitHub, but private until its review is submitted. */
	draft?: boolean;
	id: number;
	author: string;
	createdAt: string;
	body: string;
	/** Prepared once here, not on every render: parsing is slow in QuickJS. */
	markdown: string;
	reactions: Reaction[];
}

interface RestComment {
	id: number;
	user: { login: string } | null;
	created_at: string;
	body: string | null;
	reactions: Record<string, number | string>;
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

export const login = (user: { login: string } | null | undefined): string => user?.login ?? "deleted user";

export function parseReactions(reactions: Record<string, number | string> = {}): Reaction[] {
	return EMOJI.flatMap(([key, emoji]) => {
		const count = reactions[key];
		return typeof count === "number" && count > 0 ? [{ emoji, count }] : [];
	});
}

/** `url` is the issue or PR page: it resolves the comment's #123 references. */
export function parseComment(comment: unknown, url: string): Comment {
	const c = comment as RestComment;
	return {
		id: c.id,
		author: login(c.user),
		createdAt: c.created_at,
		body: c.body ?? "",
		markdown: readerMarkdown(c.body ?? "", url),
		reactions: parseReactions(c.reactions),
	};
}

export function parseComments(comments: unknown[], url: string): Comment[] {
	return comments
		.map((c) => parseComment(c, url))
		.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id);
}

import type { DiffLine } from "./diff.ts";
import { type Comment, parseComment } from "./discussion.ts";

export interface ReviewThread {
	id: string;
	root: number;
	path: string;
	side: "LEFT" | "RIGHT";
	line: number | null;
	outdated: boolean;
	resolved: boolean;
	canResolve: boolean;
	canUnresolve: boolean;
	comments: Comment[];
}

export interface ThreadNode {
	id: string;
	path: string;
	diffSide: "LEFT" | "RIGHT";
	line: number | null;
	isOutdated: boolean;
	isResolved: boolean;
	viewerCanResolve: boolean;
	viewerCanUnresolve: boolean;
	comments: { nodes: { databaseId: number }[] };
}

/** REST supplies all replies and reactions; GraphQL supplies the thread identity and resolution permissions. */
export function parseThreads(nodes: ThreadNode[], comments: unknown[], url: string): ReviewThread[] {
	const all = comments as { id: number; in_reply_to_id?: number }[];
	return nodes.map((n) => {
		const root = n.comments.nodes[0]?.databaseId;
		if (!root) throw new Error("GitHub did not return the discussion's first comment.");
		return {
			id: n.id,
			root,
			path: n.path,
			side: n.diffSide,
			line: n.line,
			outdated: n.isOutdated,
			resolved: n.isResolved,
			canResolve: n.viewerCanResolve,
			canUnresolve: n.viewerCanUnresolve,
			comments: all
				.filter((c) => c.id === root || c.in_reply_to_id === root)
				.map((c) => parseComment(c, url))
				.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id),
		};
	});
}

/** A context row has two valid anchors, even though its new-comment target defaults to RIGHT. */
export function threadRow(rows: DiffLine[], thread: Pick<ReviewThread, "side" | "line" | "outdated">): number | null {
	if (thread.outdated || thread.line === null) return null;
	const index = rows.findIndex((r) => (thread.side === "LEFT" ? r.oldLine : r.newLine) === thread.line);
	return index < 0 ? null : index;
}

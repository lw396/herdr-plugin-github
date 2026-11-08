// Acknowledged writes bridge independently lagging GitHub discussion reads, only until observed.
import type { Comment } from "./discussion.ts";
import type { PullTimelineItem } from "./pull-timeline.ts";
import type { ReviewThread } from "./review-threads.ts";

export class PublishedComments {
	private pendingThreads = new Map<number, ReviewThread>();
	private pendingTimeline = new Map<number, PullTimelineItem>();

	add(comment: Comment, target: Pick<ReviewThread, "path" | "side" | "line" | "outdated">): ReviewThread {
		const thread: ReviewThread = {
			...target,
			id: `comment-${comment.id}`,
			root: comment.id,
			resolved: false,
			canResolve: false,
			canUnresolve: false,
			comments: [comment],
		};
		this.pendingThreads.set(comment.id, thread);
		this.pendingTimeline.set(comment.id, {
			...comment,
			// Negative IDs keep local review placeholders distinct from GitHub's positive review IDs.
			id: -comment.id,
			body: "",
			markdown: "",
			kind: "review",
			verb: "reviewed",
			discussion: [{ root: comment.id, comment, path: target.path, snippet: "" }],
		});
		return thread;
	}

	/** Each endpoint releases only the writes it has actually observed. */
	timeline(remote: PullTimelineItem[]): PullTimelineItem[] {
		for (const item of remote) for (const d of item.discussion) this.pendingTimeline.delete(d.comment.id);
		return [...remote, ...this.pendingTimeline.values()].sort(
			(a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id,
		);
	}

	threads(remote: ReviewThread[]): ReviewThread[] {
		const seen = new Set(remote.flatMap((t) => t.comments.map((c) => c.id)));
		for (const id of seen) this.pendingThreads.delete(id);
		const result = remote.map((thread) => {
			const local = this.pendingThreads.get(thread.root);
			return local ? { ...thread, comments: [...local.comments, ...thread.comments] } : thread;
		});
		for (const local of this.pendingThreads.values())
			if (!remote.some((t) => t.root === local.root)) result.push(local);
		return result;
	}
}

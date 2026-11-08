// Acknowledged writes bridge independently lagging GitHub discussion reads, only until observed.
import type { Comment } from "./discussion.ts";
import type { PullTimelineItem } from "./pull-timeline.ts";
import type { ReviewThread } from "./review-threads.ts";

export class PublishedComments {
	private pendingThreads = new Map<number, ReviewThread>();
	private pendingTimeline = new Map<number, PullTimelineItem>();
	private activities = new Map<string, PullTimelineItem>();

	/** Promote only this review's drafts; replies stay with their original timeline conversation. */
	submitted(item: PullTimelineItem, threads: ReviewThread[]): ReviewThread[] {
		const pending = threads.filter((t) => t.comments.some((c) => c.draft));
		const newRoots = new Set(
			pending.filter((t) => t.comments.some((c) => c.id === t.root && c.draft)).map((t) => t.root),
		);
		const promoted = pending.map((t) => ({
			...t,
			comments: t.comments.map((c) => {
				const { draft: _draft, ...published } = c;
				return published;
			}),
		}));
		const discussion = promoted
			.filter((t) => newRoots.has(t.root))
			.flatMap((t) => t.comments.map((comment) => ({ root: t.root, comment, path: t.path, snippet: "" })));
		// Match pullTimeline's omission of empty COMMENTED reviews containing only replies.
		const replyOnly =
			item.kind === "review" &&
			item.verb === "reviewed" &&
			!item.body.trim() &&
			!discussion.length &&
			pending.length > 0;
		this.activity(replyOnly ? null : { ...item, discussion }, promoted);
		return threads.map((t) => promoted.find((p) => p.id === t.id) ?? t);
	}

	/** Keep an acknowledged submission visible while the review and diff endpoints catch up separately. */
	activity(item: PullTimelineItem | null, threads: ReviewThread[] = []): void {
		if (item) this.activities.set(`${item.kind}-${item.id}`, item);
		for (const thread of threads) {
			this.pendingThreads.set(thread.root, thread);
			for (const comment of thread.comments) this.pendingTimeline.delete(comment.id);
		}
	}

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
		const merged = remote.map((item) => {
			const key = `${item.kind}-${item.id}`;
			const local = this.activities.get(key);
			if (!local) return item;
			const missing = local.discussion.filter((d) => !item.discussion.some((r) => r.comment.id === d.comment.id));
			if (!missing.length) this.activities.delete(key);
			return missing.length ? { ...item, discussion: [...item.discussion, ...missing] } : item;
		});
		const unseen = [...this.activities.values()].filter(
			(item) => !remote.some((r) => r.kind === item.kind && r.id === item.id),
		);
		return [...merged, ...this.pendingTimeline.values(), ...unseen].sort(
			(a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id,
		);
	}

	threads(remote: ReviewThread[]): ReviewThread[] {
		const seen = new Set(remote.flatMap((t) => t.comments.filter((c) => !c.draft).map((c) => c.id)));
		for (const [root, thread] of this.pendingThreads) {
			if (thread.comments.every((c) => seen.has(c.id))) this.pendingThreads.delete(root);
		}
		const result = remote.map((thread) => {
			const local = this.pendingThreads.get(thread.root);
			return local
				? {
						...thread,
						comments: [...local.comments, ...thread.comments.filter((c) => !local.comments.some((l) => l.id === c.id))],
					}
				: thread;
		});
		for (const local of this.pendingThreads.values())
			if (!remote.some((t) => t.root === local.root)) result.push(local);
		return result;
	}
}

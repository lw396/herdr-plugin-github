// Writes GitHub has acknowledged, shown until the discussion reads that lag behind them observe each one.
import type { Comment } from "../../detail/core/discussion.ts";
import { type PullTimelineItem, replyOnlyReview, timelineKey, timelineOrder } from "./pull-timeline.ts";
import type { ReviewThread } from "./review-threads.ts";

/** A comment is observed once a read returns it as it now is: a draft, or published. */
const observed = (c: Comment): string => `${c.id}:${c.draft ? "draft" : "published"}`;

export class Acknowledged {
	/** Thread shells holding acknowledged comments, keyed by the first such comment's id. */
	private threadsKept = new Map<number, ReviewThread>();
	private pendingTimeline = new Map<number, PullTimelineItem>();
	private activities = new Map<string, PullTimelineItem>();

	/** A published standalone comment starts its own discussion, and a placeholder review in the timeline. */
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
		this.threadsKept.set(comment.id, thread);
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

	/** A draft discussion, or a reply (draft or published) in `thread`. */
	keep(thread: ReviewThread, comment: Comment = thread.comments[0]!): void {
		this.threadsKept.set(comment.id, { ...thread, comments: [comment] });
	}

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
		const replies = pending.length - newRoots.size;
		const commented = item.kind === "review" && item.reviewState === "COMMENTED";
		const omitted = replyOnlyReview(commented, item.body, newRoots.size, replies);
		this.activity(omitted ? null : { ...item, discussion }, promoted);
		return threads.map((t) => promoted.find((p) => p.id === t.id) ?? t);
	}

	/** Keep an acknowledged submission visible while the review and diff endpoints catch up separately. */
	activity(item: PullTimelineItem | null, threads: ReviewThread[] = []): void {
		if (item) this.activities.set(timelineKey(item), item);
		for (const thread of threads) {
			for (const comment of thread.comments) {
				// A thread kept for one of its comments is replaced by the whole promoted thread.
				this.threadsKept.delete(comment.id);
				this.pendingTimeline.delete(comment.id);
			}
			this.threadsKept.set(thread.root, thread);
		}
	}

	/** Each endpoint releases only the writes it has actually observed. */
	timeline(remote: PullTimelineItem[]): PullTimelineItem[] {
		for (const item of remote) for (const d of item.discussion) this.pendingTimeline.delete(d.comment.id);
		const merged = remote.map((item) => {
			const key = timelineKey(item);
			const local = this.activities.get(key);
			if (!local) return item;
			const missing = local.discussion.filter((d) => !item.discussion.some((r) => r.comment.id === d.comment.id));
			if (!missing.length) this.activities.delete(key);
			return missing.length ? { ...item, discussion: [...item.discussion, ...missing] } : item;
		});
		const unseen = [...this.activities.values()].filter(
			(item) => !remote.some((r) => r.kind === item.kind && r.id === item.id),
		);
		return [...merged, ...this.pendingTimeline.values(), ...unseen].sort(timelineOrder);
	}

	/**
	 * The diff's discussions: a read, plus every acknowledged comment it has not observed yet. Without a
	 * pending review (`drafts` false: submitted or deleted elsewhere), kept drafts are gone.
	 */
	threads(remote: ReviewThread[], drafts = true): ReviewThread[] {
		const seen = new Set(remote.flatMap((t) => t.comments.map(observed)));
		const result = remote.map((t) => ({ ...t }));
		for (const [key, kept] of this.threadsKept) {
			const comments = drafts ? kept.comments : kept.comments.filter((c) => !c.draft);
			if (comments.every((c) => seen.has(observed(c)))) {
				this.threadsKept.delete(key);
				continue;
			}
			const into = result.find((t) => t.root === kept.root);
			if (!into) {
				result.push({ ...kept, comments });
				continue;
			}
			// Acknowledged comments win over a read that still shows an older form of them.
			const local = new Map(comments.map((c) => [c.id, c]));
			const shown = into.comments.map((c) => local.get(c.id) ?? c);
			into.comments = [...shown, ...comments.filter((c) => !shown.some((s) => s.id === c.id))];
		}
		return result;
	}
}

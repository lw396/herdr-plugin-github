// Existing published discussions, with per-thread drafts kept through refreshes.
import { h_flex, Textarea, TextareaState, v_flex } from "gpui-base";
import { type Context, div, type Element } from "gpui-kit";
import type { DetailRef } from "../core/detail.ts";
import { commentTarget, type DiffLine } from "../core/diff.ts";
import { PublishedComments } from "../core/published-comments.ts";
import { mergeDraftThreads, type ReviewThread } from "../core/review-threads.ts";
import { Notices } from "../io/changes.ts";
import { failureOf } from "../io/gh.ts";
import {
	addPullReviewComment,
	type PendingReview,
	type ReviewEvent,
	readPullReview,
	replyPullReviewThread,
	submitPullReview,
} from "../io/pull-reviews.ts";
import { addPullComment, type PullCommentTarget, readPullThreads, resolvePullThread } from "../io/pulls.ts";
import { type DetailHost, openLink, postCard } from "./detail.ts";
import { diffSnippet } from "./diff-lines.ts";
import { button, colors, link, stop } from "./ui.ts";

export const THREAD_HEIGHT = 340;
export const COMPOSER_HEIGHT = 220;

/** A draft must look like an input, not another published comment. */
export function commentEditor(state: TextareaState, height: number): Element {
	const t = colors();
	return div()
		.h(height)
		.flex_none()
		.min_w(0)
		.rounded(6)
		.border_1()
		.border_color(t.input)
		.bg(t.background)
		.p(8)
		.on_mouse_down("left", stop)
		.child(Textarea.new(state).size_full().text_size(13).text_color(t.foreground));
}

export class ReviewThreads {
	threads: ReviewThread[] = [];
	readonly published = new PublishedComments();
	loading = false;
	failure: string | null = null;
	private latest = 0;
	private pending: PendingReview | null = null;
	private ready = false;
	private localDrafts = new Map<number, ReviewThread>();
	private summaryBox: TextareaState | null = null;
	private notices = new Notices();
	private writing = new Set<string>();
	private failures = new Map<string, string>();
	private boxes = new Map<string, TextareaState>();
	private dirty = false;
	private hiddenSnippets = new Set<string>();
	private drafts = new Map<string, { target: PullCommentTarget; box: TextareaState }>();
	constructor(ref: DetailRef, on: string | null, host: DetailHost) {
		this.ref = ref;
		this.on = on;
		this.host = host;
	}
	private readonly ref: DetailRef;
	private readonly on: string | null;
	private readonly host: DetailHost;

	load(cx: Context): void {
		if (this.writing.size) {
			this.dirty = true;
			return;
		}
		const request = ++this.latest;
		this.loading = true;
		this.failure = null;
		cx.spawn(async (cx) => {
			try {
				const state = await readPullReview(this.ref.repo, this.ref.number, this.on);
				const threads = await readPullThreads(
					this.ref.repo,
					this.ref.number,
					this.on,
					state.pending?.databaseId ?? null,
				);
				if (request === this.latest) {
					this.pending = state.pending;
					this.ready = true;
					if (!state.pending) this.localDrafts.clear();
					const seen = new Set(threads.flatMap((t) => t.comments.map((c) => c.id)));
					for (const id of seen) this.localDrafts.delete(id);
					this.threads = this.published.threads(mergeDraftThreads(threads, [...this.localDrafts.values()]));
				}
			} catch (e) {
				if (request === this.latest) this.failure = failureOf(e).message;
			} finally {
				if (request === this.latest) {
					this.loading = false;
					cx.notify();
				}
			}
		});
	}

	sync(cx: Context): void {
		if (
			this.notices
				.take()
				.some((n) => n.repo === this.ref.repo && n.number === this.ref.number && n.threads?.on === this.on)
		)
			this.dirty = true;
		if (this.dirty && !this.writing.size) {
			this.dirty = false;
			this.load(cx);
		}
	}

	status(): Element {
		return div()
			.text_size(12)
			.text_color(this.failure ? colors().blocked : colors().dim)
			.child(this.failure ?? (this.loading ? "Loading discussions…" : ""));
	}

	/** Register gutter handlers and editors before native deferred row rendering. */
	inlineComposer(
		path: string,
		commit: string,
		row: DiffLine,
		width: number,
	): {
		gutters: { left?: Element; right?: Element };
		editors: Element[];
	} {
		const gutters: { left?: Element; right?: Element } = {};
		const editors: Element[] = [];
		for (const side of ["LEFT", "RIGHT"] as const) {
			const anchor = commentTarget(row, side);
			if (!anchor) continue;
			const key = JSON.stringify([path, side, anchor.line]);
			const draft = this.drafts.get(key);
			const busy = this.writing.has(key);
			gutters[side === "LEFT" ? "left" : "right"] = button(
				`add-inline-${key}`,
				`${anchor.line} +`,
				`Add Comment on ${side} line ${anchor.line}`,
				(_e, cx) => {
					if (!this.drafts.has(key)) {
						const box = TextareaState.new({ placeholder: "Leave a comment" });
						box.on("change", (_e, cx) => cx.notify());
						this.drafts.set(key, { target: { path, commit, ...anchor }, box });
					}
					cx.notify();
				},
			)
				.p(0)
				.text_size(12);
			if (!draft) continue;
			const t = colors();
			editors.push(
				v_flex()
					.w(width)
					.h(COMPOSER_HEIGHT)
					.p(12)
					.gap(8)
					.bg(t.surface)
					.border_1()
					.border_color(t.border)
					.child(div().text_size(12).text_color(t.dim).child(`${side} ${anchor.line}`))
					.child(commentEditor(draft.box, 90))
					.child(
						div()
							.text_size(12)
							.text_color(t.blocked)
							.child(this.failures.get(key) ?? ""),
					)
					.child(
						h_flex()
							.gap(8)
							.child(
								button(`post-inline-${key}`, busy ? "Saving…" : "Add Comment", "Add Comment", (_e, cx) => {
									this.postInline(cx, key, false, commit);
								}),
							)
							.when(!this.pending, (el) =>
								el.child(
									button(`start-review-${key}`, "Start Review", "Start Review", (_e, cx) =>
										this.postInline(cx, key, true, commit),
									),
								),
							)
							.child(
								button(`cancel-inline-${key}`, "Cancel", "Cancel", (_e, cx) => {
									if (this.writing.has(key)) return;
									this.drafts.delete(key);
									this.failures.delete(key);
									cx.notify();
								}),
							),
					),
			);
		}
		return { gutters, editors };
	}

	private postInline(cx: Context, key: string, start: boolean, commit: string): void {
		const draft = this.drafts.get(key);
		if (!this.ready || !draft?.box.value().trim()) return;
		const body = draft.box.value();
		this.write(cx, key, async () => {
			// A review may have been started in the browser since the last render.
			const state = await readPullReview(this.ref.repo, this.ref.number, this.on);
			this.pending = state.pending;
			if (start || state.pending) {
				const result = await addPullReviewComment(this.ref.repo, this.ref.number, draft.target, body, this.on);
				this.pending = result.pending;
				this.localDrafts.set(result.thread.root, result.thread);
				this.threads.push(result.thread);
			} else {
				const comment = await addPullComment(this.ref.repo, this.ref.number, draft.target, body, this.on);
				this.threads.push(
					this.published.add(comment, {
						path: draft.target.path,
						side: draft.target.side,
						line: draft.target.line,
						outdated: draft.target.commit !== commit,
					}),
				);
			}
			if (draft.box.value() === body) this.drafts.delete(key);
		});
	}

	/** The PR summary and inline drafts share one write lock and one GitHub pending review. */
	summary(commit: string): Element {
		if (!this.summaryBox) {
			this.summaryBox = TextareaState.new({ placeholder: "Leave a comment" });
			this.summaryBox.on("change", (_e, cx) => cx.notify());
		}
		const box = this.summaryBox;
		const busy = this.writing.size > 0;
		return v_flex()
			.gap(8)
			.child(
				div()
					.font_semibold()
					.child(this.pending ? "Pending review" : "Review"),
			)
			.child(commentEditor(box, 120))
			.child(
				div()
					.text_size(12)
					.text_color(colors().blocked)
					.child(this.failures.get("summary") ?? ""),
			)
			.child(
				h_flex()
					.gap(8)
					.children(
						(
							[
								["COMMENT", "Comment"],
								["APPROVE", "Approve"],
								["REQUEST_CHANGES", "Request Changes"],
							] as const
						).map(([event, label]) =>
							button(`submit-review-${event}`, busy ? "Saving…" : label, label, (_e, cx) => {
								if (
									!this.ready ||
									busy ||
									(event === "REQUEST_CHANGES" && !box.value().trim()) ||
									(event === "COMMENT" && !this.pending && !box.value().trim())
								)
									return;
								this.submit(cx, commit, event, box);
							}).opacity(!this.ready || busy ? 0.5 : 1),
						),
					),
			);
	}

	private submit(cx: Context, commit: string, event: ReviewEvent, box: TextareaState): void {
		const body = box.value();
		this.write(cx, "summary", async () => {
			const item = await submitPullReview(this.ref.repo, this.ref.number, commit, event, body, this.on);
			const submitted = this.threads
				.filter((t) => t.comments.some((c) => c.draft))
				.map((t) => ({
					...t,
					comments: t.comments.map((c) => {
						const { draft: _draft, ...published } = c;
						return published;
					}),
				}));
			const newRoots = new Set(
				this.threads.filter((t) => t.comments.some((c) => c.id === t.root && c.draft)).map((t) => t.root),
			);
			item.discussion = submitted
				.filter((t) => newRoots.has(t.root))
				.flatMap((t) => t.comments.map((c) => ({ root: t.root, comment: c, path: t.path, snippet: "" })));
			this.published.activity(item, submitted);
			this.threads = this.threads.map((t) => submitted.find((s) => s.id === t.id) ?? t);
			this.pending = null;
			this.localDrafts.clear();
			if (box.value() === body) box.set_value("");
		});
	}

	/** Built during render, NOT in the virtual list's deferred row callback. */
	card(thread: ReviewThread, unavailable: boolean, width: number): Element {
		return this.conversation(thread, unavailable, true).w(width);
	}

	/** Code and its conversation stay together in the review, without navigating away. */
	timeline(thread: ReviewThread, snippet: string, open: (cx: Context) => void): Element {
		const hidden = this.hiddenSnippets.has(thread.id);
		const t = colors();
		return v_flex()
			.min_w(0)
			.w_full()
			.border_1()
			.border_color(t.border)
			.rounded(6)
			.overflow_hidden()
			.child(
				h_flex()
					.gap(8)
					.items_center()
					.px(12)
					.py(6)
					.border_b(1)
					.border_color(t.border)
					.child(
						button(`timeline-file-${thread.id}`, thread.path, "Open File Diff", (_e, cx) => open(cx)).text_color(
							t.accent,
						),
					)
					.child(div().flex_1())
					.when(Boolean(snippet), (el) =>
						el.child(
							button(
								`snippet-toggle-${thread.id}`,
								hidden ? "Show" : "Hide",
								hidden ? "Show Diff" : "Hide Diff",
								(_e, cx) => {
									if (this.hiddenSnippets.has(thread.id)) this.hiddenSnippets.delete(thread.id);
									else this.hiddenSnippets.add(thread.id);
									cx.notify();
								},
							)
								.border_1()
								.border_color(t.border)
								.px(10)
								.py(4),
						),
					),
			)
			.when(!hidden && Boolean(snippet), (el) => el.child(diffSnippet(`timeline-snippet-${thread.id}`, snippet)))
			.child(this.conversation(thread, thread.outdated, false));
	}

	private conversation(thread: ReviewThread, unavailable: boolean, virtual: boolean): Element {
		const t = colors();
		const scope = virtual ? "diff" : "timeline";
		const box = this.boxes.get(thread.id);
		const busy = this.writing.has(thread.id);
		const url = `https://github.com/${this.ref.repo}/pull/${this.ref.number}#discussion_r${thread.root}`;
		return v_flex()
			.when(virtual, (el) => el.h(THREAD_HEIGHT))
			.min_w(0)
			.p(12)
			.gap(8)
			.when(virtual, (el) => el.border_1().border_color(t.border).bg(t.surface))
			.when(virtual, (el) =>
				el.child(
					h_flex()
						.gap(10)
						.items_center()
						.child(
							div()
								.font_medium()
								.child(thread.resolved ? "Resolved" : "Discussion"),
						)
						.child(
							div()
								.text_size(12)
								.text_color(t.dim)
								.child(`${thread.side} ${thread.line ?? ""}`),
						)
						.child(link(`thread-browser-${thread.id}`, url, "Open on GitHub").text_size(12).text_color(t.accent)),
				),
			)
			.when(!virtual && thread.resolved, (el) => el.child(div().text_size(12).text_color(t.done).child("Resolved")))
			.when(unavailable, (el) =>
				el.child(
					div()
						.text_size(12)
						.text_color(t.dim)
						.child(
							thread.outdated
								? "Outdated — this discussion is no longer in the current diff."
								: "This discussion is not attached to a line in the available diff.",
						),
				),
			)
			.child(
				v_flex()
					.id(`${scope}-thread-comments-${thread.id}`)
					.when(virtual, (el) => el.flex_1().min_h(0).overflow_y_scrollbar())
					.children(
						thread.comments.map((c, index) =>
							postCard(
								`${scope}-comment-${c.id}`,
								c,
								c.draft ? "Pending" : "commented",
								(url, cx) =>
									openLink(cx, this.host, url, `https://github.com/${this.ref.repo}/pull/${this.ref.number}`),
								{ embedded: true },
							).when(index > 0, (el) => el.border_t(1).border_color(t.border)),
						),
					),
			)
			.when(Boolean(box), (el) =>
				el.child(
					v_flex().flex_none().min_w(0).border_t(1).border_color(t.border).pt(12).child(commentEditor(box!, 80)),
				),
			)
			.when(this.failures.has(thread.id), (el) =>
				el.child(
					div()
						.text_size(12)
						.text_color(t.blocked)
						.child(this.failures.get(thread.id) ?? ""),
				),
			)
			.child(
				h_flex()
					.gap(8)
					.child(
						button(
							`${scope}-reply-${thread.id}`,
							busy ? "Saving…" : box ? "Comment" : "Reply",
							"Reply to discussion",
							(_e, cx) => {
								if (busy) return;
								if (!box) {
									const input = TextareaState.new({ placeholder: "Reply…" });
									input.on("change", (_e, cx) => cx.notify());
									this.boxes.set(thread.id, input);
									cx.notify();
									return;
								}
								const body = box.value();
								if (!body.trim()) return;
								this.write(cx, thread.id, async () => {
									const comment = await replyPullReviewThread(
										this.ref.repo,
										this.ref.number,
										thread.id,
										thread.root,
										body,
										this.on,
									);
									if (comment.draft) this.localDrafts.set(comment.id, { ...thread, comments: [comment] });
									if (!thread.comments.some((c) => c.id === comment.id)) thread.comments.push(comment);
									if (box.value() === body) box.set_value("");
								});
							},
						),
					)
					.when(thread.resolved ? thread.canUnresolve : thread.canResolve, (el) =>
						el.child(
							button(
								`${scope}-resolve-${thread.id}`,
								thread.resolved ? "Unresolve Conversation" : "Resolve Conversation",
								"Change discussion resolution",
								(_e, cx) => {
									this.write(cx, thread.id, async () =>
										Object.assign(
											thread,
											await resolvePullThread(this.ref.repo, this.ref.number, thread.id, !thread.resolved, this.on),
										),
									);
								},
							),
						),
					),
			);
	}

	private write(cx: Context, key: string, act: () => Promise<unknown>): void {
		if (this.writing.size) return;
		this.latest++; // An older read must not overwrite a successful write.
		this.loading = false;
		this.writing.add(key);
		this.failures.delete(key);
		cx.notify();
		cx.spawn(async (cx) => {
			try {
				await act();
			} catch (e) {
				this.failures.set(key, failureOf(e).message);
			} finally {
				this.writing.delete(key);
				this.dirty = true;
				cx.notify();
			}
		});
	}
}

// A PR's discussions and review: replies, resolution, inline drafts and the pending review's submission.
import { h_flex, Textarea, TextareaState, v_flex } from "gpui-base";
import { type Context, div, type Element } from "gpui-kit";
import { type DetailRef, detailUrl } from "../../detail/core/detail.ts";
import { Notices } from "../../detail/io/changes.ts";
import { type DetailHost, openLink, postCard } from "../../detail/views/detail.ts";
import { failureOf } from "../../shared/io/gh.ts";
import { actionButton, button, colors, link, stop } from "../../shared/views/ui.ts";
import { Acknowledged } from "../core/acknowledged.ts";
import { commentTarget, type DiffLine } from "../core/diff.ts";
import type { ReviewThread } from "../core/review-threads.ts";
import {
	addPullReviewComment,
	type PendingReview,
	type ReviewEvent,
	readPullReview,
	replyPullReviewThread,
	submitPullReview,
} from "../io/pull-reviews.ts";
import { addPullComment, type PullCommentTarget, readPullThreads, resolvePullThread } from "../io/pulls.ts";
import { diffSnippet } from "./diff-lines.ts";

/** An inline comment editor's height below its diff row. */
const COMPOSER_HEIGHT = 220;

/** Inline drafts are kept per line and side of a file. */
const draftKey = (path: string, side: "LEFT" | "RIGHT", line: number): string => JSON.stringify([path, side, line]);

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
	readonly acknowledged = new Acknowledged();
	loading = false;
	failure: string | null = null;
	private latest = 0;
	private pending: PendingReview | null = null;
	private summaryBox: TextareaState | null = null;
	private summaryTouched = false;
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

	/** Native input state must be created in init or an event/async callback, never during render. */
	init(): void {
		if (this.summaryBox) return;
		const box = TextareaState.new({ placeholder: "Leave a comment" });
		box.set_value(this.pending?.body ?? "");
		box.on("change", (_e, cx) => {
			this.summaryTouched = true;
			cx.notify();
		});
		this.summaryBox = box;
	}

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
				// load() can be requested by render-time notices; spawn runs outside that render.
				this.init();
				const state = await readPullReview(this.ref.repo, this.ref.number, this.on);
				const threads = await readPullThreads(
					this.ref.repo,
					this.ref.number,
					this.on,
					state.pending?.databaseId ?? null,
				);
				if (request === this.latest) {
					this.pending = state.pending;
					if (this.summaryBox && !this.summaryTouched) this.summaryBox.set_value(state.pending?.body ?? "");
					this.threads = this.acknowledged.threads(threads, state.pending !== null);
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

	/** The height a row's open inline editors add, without creating native elements. */
	inlineHeight(path: string, row: DiffLine): number {
		let count = 0;
		for (const side of ["LEFT", "RIGHT"] as const) {
			const anchor = commentTarget(row, side);
			if (anchor && this.drafts.has(draftKey(path, side, anchor.line))) count++;
		}
		return count * COMPOSER_HEIGHT;
	}

	/** Called only for visible rows, in the ordinary render snapshot (not a native list callback). */
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
			const key = draftKey(path, side, anchor.line);
			const draft = this.drafts.get(key);
			const busy = this.writing.size > 0;
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
									button(`start-review-${key}`, busy ? "Saving…" : "Start Review", "Start Review", (_e, cx) =>
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
		if (!draft?.box.value().trim()) return;
		const body = draft.box.value();
		this.write(cx, key, async () => {
			// A review may have been started in the browser since the last render.
			const state = await readPullReview(this.ref.repo, this.ref.number, this.on);
			this.pending = state.pending;
			if (start || state.pending) {
				const result = await addPullReviewComment(this.ref.repo, this.ref.number, draft.target, body, this.on);
				this.pending = result.pending;
				this.acknowledged.keep(result.thread);
				this.threads.push(result.thread);
			} else {
				const comment = await addPullComment(this.ref.repo, this.ref.number, draft.target, body, this.on);
				this.threads.push(
					this.acknowledged.add(comment, {
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
	summary(commit: string, stateAction: Element = div()): Element {
		const box = this.summaryBox;
		if (!box)
			return v_flex()
				.gap(12)
				.child(div().text_size(12).text_color(colors().dim).child("Loading review…"))
				.child(stateAction);
		const busy = this.writing.size > 0;
		const options: { value: ReviewEvent; label: string }[] = [
			{ value: "COMMENT", label: "Comment" },
			{ value: "APPROVE", label: "Approve" },
			{ value: "REQUEST_CHANGES", label: "Request Changes" },
		];
		return v_flex()
			.gap(12)
			.pt(12)
			.when(Boolean(this.pending), (el) => el.child(div().font_semibold().child("Pending review")))
			.child(commentEditor(box, 128))
			.when(this.failures.has("summary"), (el) =>
				el.child(div().text_size(12).text_color(colors().blocked).child(this.failures.get("summary")!)),
			)
			.child(
				h_flex()
					.gap(8)
					.items_center()
					.flex_wrap()
					.child(stateAction)
					.child(div().flex_1())
					.child(
						h_flex()
							.gap(8)
							.items_center()
							.flex_wrap()
							.children(
								options
									.filter((o) => o.value === "COMMENT" || this.pending)
									.map(({ value: event, label }) =>
										actionButton(
											`submit-review-${event}`,
											busy ? "Saving…" : label,
											(_e, cx) => this.submit(cx, commit, event, box),
											event === "COMMENT",
											busy ||
												(!box.value().trim() &&
													(event === "REQUEST_CHANGES" || (event === "COMMENT" && !this.pending))),
										),
									),
							),
					),
			);
	}

	private submit(cx: Context, commit: string, event: ReviewEvent, box: TextareaState): void {
		const body = box.value();
		this.write(cx, "summary", async () => {
			const item = await submitPullReview(this.ref.repo, this.ref.number, commit, event, body, this.on);
			this.threads = this.acknowledged.submitted(item, this.threads);
			this.pending = null;
			if (box.value() === body) {
				box.set_value("");
				this.summaryTouched = false;
			}
		});
	}

	/** Natural height is measured after layout, so short discussions do not reserve a large empty card. */
	card(
		thread: ReviewThread,
		unavailable: boolean,
		width: number,
		onHeight?: (height: number, cx: Context) => void,
	): Element {
		return this.conversation(thread, unavailable, true)
			.id(`diff-thread-${thread.id}`)
			.w(width)
			.when(Boolean(onHeight), (el) => el.on_size_change((size, cx) => onHeight?.(size.height, cx)));
	}

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
		const busy = this.writing.size > 0;
		const url = `${detailUrl(this.ref)}#discussion_r${thread.root}`;
		return v_flex()
			.flex_none()
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
					.when(virtual, (el) => el.flex_none().max_h(240).overflow_y_scrollbar())
					.children(
						thread.comments.map((c, index) =>
							postCard(
								`${scope}-comment-${c.id}`,
								c,
								c.draft ? "Pending" : "commented",
								(url, cx) => openLink(cx, this.host, url, detailUrl(this.ref)),
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
									this.acknowledged.keep(thread, comment);
									if (!thread.comments.some((c) => c.id === comment.id)) thread.comments.push(comment);
									if (box.value() === body) box.set_value("");
								});
							},
						),
					)
					.when(Boolean(box), (el) =>
						el.child(
							button(`${scope}-cancel-reply-${thread.id}`, "Cancel", "Cancel reply", (_e, cx) => {
								if (this.writing.size) return;
								this.boxes.delete(thread.id);
								this.failures.delete(thread.id);
								cx.notify();
							}).opacity(busy ? 0.5 : 1),
						),
					)
					.when(thread.resolved ? thread.canUnresolve : thread.canResolve, (el) =>
						el.child(
							button(
								`${scope}-resolve-${thread.id}`,
								busy ? "Saving…" : thread.resolved ? "Unresolve Conversation" : "Resolve Conversation",
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
		if (this.writing.size) {
			this.failures.set(key, "Another update is in progress.");
			cx.notify();
			return;
		}
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

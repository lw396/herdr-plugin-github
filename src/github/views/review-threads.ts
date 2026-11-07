// Existing published discussions, with per-thread drafts kept through refreshes.
import { h_flex, Textarea, TextareaState, v_flex } from "gpui-base";
import { type Context, div, type Element } from "gpui-kit";
import type { DetailRef } from "../core/detail.ts";
import type { ReviewThread } from "../core/review-threads.ts";
import { Notices } from "../io/changes.ts";
import { failureOf } from "../io/gh.ts";
import { readPullThreads, replyPullThread, resolvePullThread } from "../io/pulls.ts";
import { postCard } from "./detail.ts";
import { button, colors, link, stop } from "./ui.ts";

export class ReviewThreads {
	threads: ReviewThread[] = [];
	loading = false;
	failure: string | null = null;
	private latest = 0;
	private notices = new Notices();
	private writing = new Set<string>();
	private failures = new Map<string, string>();
	private boxes = new Map<string, TextareaState>();
	private dirty = false;
	constructor(privateRef: DetailRef, on: string | null) {
		this.ref = privateRef;
		this.on = on;
	}
	private readonly ref: DetailRef;
	private readonly on: string | null;

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
				const threads = await readPullThreads(this.ref.repo, this.ref.number, this.on);
				if (request === this.latest) this.threads = threads;
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

	/** Built during render, NOT in the virtual list's deferred row callback. */
	card(thread: ReviewThread, unavailable: boolean): Element {
		const t = colors();
		const box = this.boxes.get(thread.id);
		const busy = this.writing.has(thread.id);
		const url = `https://github.com/${this.ref.repo}/pull/${this.ref.number}#discussion_r${thread.root}`;
		return v_flex()
			.h(340)
			.w_full()
			.min_w(0)
			.p(12)
			.gap(8)
			.border_1()
			.border_color(t.border)
			.bg(t.surface)
			.child(
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
			)
			.when(unavailable, (el) =>
				el.child(
					div()
						.text_size(12)
						.text_color(t.dim)
						.child(
							thread.outdated
								? "Outdated — this discussion is no longer in the current diff."
								: "This discussion's line is not in the available diff.",
						),
				),
			)
			.child(
				v_flex()
					.id(`thread-comments-${thread.id}`)
					.flex_1()
					.min_h(0)
					.overflow_y_scrollbar()
					.gap(8)
					.children(
						thread.comments.map((c) => postCard(`diff-comment-${c.id}`, c, "commented", (url, cx) => cx.open_url(url))),
					),
			)
			.when(Boolean(box), (el) =>
				el.child(div().h(66).on_mouse_down("left", stop).child(Textarea.new(box!).w_full().text_size(13))),
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
							`reply-${thread.id}`,
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
								this.write(cx, thread, async () => {
									const comment = await replyPullThread(this.ref.repo, this.ref.number, thread.root, body, this.on);
									if (!thread.comments.some((c) => c.id === comment.id)) thread.comments.push(comment);
									if (box.value() === body) box.set_value("");
								});
							},
						),
					)
					.when(thread.resolved ? thread.canUnresolve : thread.canResolve, (el) =>
						el.child(
							button(
								`resolve-${thread.id}`,
								thread.resolved ? "Unresolve conversation" : "Resolve conversation",
								"Change discussion resolution",
								(_e, cx) => {
									this.write(cx, thread, async () =>
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

	private write(cx: Context, thread: ReviewThread, act: () => Promise<unknown>): void {
		if (this.writing.has(thread.id)) return;
		this.latest++; // An older read must not overwrite a successful write.
		this.loading = false;
		this.writing.add(thread.id);
		this.failures.delete(thread.id);
		cx.notify();
		cx.spawn(async (cx) => {
			try {
				await act();
			} catch (e) {
				this.failures.set(thread.id, failureOf(e).message);
			} finally {
				this.writing.delete(thread.id);
				this.dirty = true;
				cx.notify();
			}
		});
	}
}

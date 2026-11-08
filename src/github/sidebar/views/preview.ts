// Native hover cards share the row's render, so async summaries update the card in place.
import { HoverCard, h_flex, v_flex } from "gpui-base";
import { type Context, div, type Element, svg, type Task } from "gpui-kit";
import type { DetailRef } from "../../detail/core/detail.ts";
import { labels } from "../../detail/views/detail.ts";
import { PULL_STATES } from "../../detail/views/state.ts";
import { Cache } from "../../shared/core/cache.ts";
import { failureOf } from "../../shared/core/gh.ts";
import { colors, spinner, stop } from "../../shared/views/ui.ts";
import {
	PREVIEW_CLOSE_MS,
	PREVIEW_DWELL_MS,
	PREVIEW_OPEN_MS,
	type Preview,
	PreviewIntent,
	previewKey,
	ScrollQuiet,
} from "../core/preview.ts";
import type { Ready } from "../io/groups.ts";
import { Previews } from "../io/preview.ts";

export function previewCard(ref: DetailRef, preview: Preview | undefined, failure?: string): Element {
	const t = colors();
	const state = preview ? PULL_STATES[preview.state] : null;
	const icon =
		state &&
		(ref.kind === "pr"
			? svg(state.icon).size(14).text_color(state.color(t))
			: div()
					.text_color(state.color(t))
					.child(preview?.state === "closed" ? "⊙" : "○"));
	return v_flex()
		.w(480)
		.p(14)
		.gap(10)
		.rounded(8)
		.border_1()
		.border_color(t.border)
		.bg(t.surface)
		.text_color(t.foreground)
		.text_size(13)
		.on_mouse_down("left", stop)
		.child(
			h_flex()
				.gap(8)
				.items_center()
				.child(div().min_w(0).flex_1().truncate().text_color(t.accent).child(ref.repo))
				.when(Boolean(preview), (el) =>
					el.child(
						div()
							.flex_none()
							.text_color(t.dim)
							.child(preview?.createdAt.slice(0, 10) ?? ""),
					),
				),
		)
		.when(Boolean(preview), (el) =>
			el
				.child(
					h_flex()
						.gap(8)
						.items_start()
						.child(
							div()
								.flex_none()
								.accessibility_label(state?.label ?? "")
								.children(icon ? [icon] : []),
						)
						.child(
							div()
								.flex_1()
								.min_w(0)
								.max_h(64)
								.overflow_hidden()
								.font_semibold()
								.child(`${preview?.title} #${ref.number}`),
						),
				)
				.child(
					div()
						.text_size(12)
						.text_color(t.dim)
						.child(`${state?.label} · ${preview?.author ? `@${preview.author}` : "ghost"}`),
				)
				.child(
					div()
						.max_h(120)
						.overflow_hidden()
						.child(preview?.summary || "No description provided."),
				)
				.when(Boolean(preview?.labels.length), (el) =>
					el.child(div().max_h(64).overflow_hidden().child(labels(preview!.labels))),
				),
		)
		.when(!preview, (el) =>
			el.child(
				failure
					? div().text_color(t.blocked).child(`Preview unavailable: ${failure}`)
					: h_flex().gap(8).items_center().child(spinner()).child("Loading preview…"),
			),
		);
}

/** A short dwell avoids fetching for rows the pointer merely passes over. */
export class RowPreviews {
	private previews = new Previews();
	private timer: Task | null = null;
	private failures = new Cache<string>(100);
	private intent = new PreviewIntent();
	private quiet = new ScrollQuiet();
	private settle: Task | null = null;

	/** Called for every wheel event over the list; cards come back once it has been still for a moment. */
	scrolled(cx: Context): void {
		const was = this.quiet.remaining(Date.now()) > 0;
		this.quiet.scrolled(Date.now());
		this.settle?.cancel();
		const wait = (cx: Context) => {
			const left = this.quiet.remaining(Date.now());
			if (left > 0) this.settle = cx.timer.after(left, wait);
			else {
				this.settle = null;
				cx.notify();
			}
		};
		this.settle = cx.timer.after(this.quiet.remaining(Date.now()), wait);
		// Close an open card at once; later wheel events change nothing visible.
		if (!was) cx.notify();
	}

	hover(cx: Context, row: string, ref: DetailRef | null, r: Ready | null, current: () => boolean): void {
		if (!ref && !this.intent.leave(row)) return;
		this.timer?.cancel();
		this.timer = null;
		if (!ref || !r) return;
		const ticket = this.intent.enter(row);
		const key = previewKey(ref, r.on, r.login);
		this.failures.delete(key);
		this.timer = cx.timer.after(PREVIEW_DWELL_MS, (cx) => {
			if (!this.intent.current(ticket) || !current() || this.quiet.remaining(Date.now()) > 0) return;
			cx.spawn(async (cx) => {
				try {
					await this.previews.load(ref, r.on, r.login);
				} catch (e) {
					this.failures.set(key, failureOf(e).message, Date.now());
				}
				// The pointer may now be on the card rather than its trigger; it still needs the result.
				cx.notify();
			});
		});
	}

	wrap(id: string, trigger: Element, ref: DetailRef, r: Ready): Element {
		if (this.quiet.remaining(Date.now()) > 0) return trigger;
		const preview = this.previews.peek(ref, r.on, r.login);
		const key = previewKey(ref, r.on, r.login);
		const failure = this.failures.get(key);
		return (
			HoverCard.new(`preview-${id}-${key}`)
				.w_full()
				.open_delay(PREVIEW_OPEN_MS)
				.close_delay(PREVIEW_CLOSE_MS)
				.trigger(trigger)
				// The card covers the list: a wheel over it means the person wants to scroll, so it gets out of the way.
				.content(previewCard(ref, preview, failure).on_scroll_wheel((_e, cx) => this.scrolled(cx)))
		);
	}
}

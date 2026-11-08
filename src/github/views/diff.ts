// Windowed code rows and independently scrollable discussion cards, all in one native snapshot.
import { h_flex, v_flex } from "gpui-base";
import { type Context, div, type Element } from "gpui-kit";
import { type DiffLine, parsePatch } from "../core/diff.ts";
import type { ChangedFile } from "../core/files.ts";
import { type ReviewThread, threadRow } from "../core/review-threads.ts";
import { itemWindow } from "../core/viewport.ts";
import { diffRow, ROW_HEIGHT } from "./diff-lines.ts";
import { COMPOSER_HEIGHT, type ReviewThreads, THREAD_ESTIMATE } from "./review-threads.ts";
import { colors, link } from "./ui.ts";

interface DiffItem {
	key: string;
	height: number;
	render: () => Element;
	commentIds?: number[];
}

export class FileDiff {
	private file: ChangedFile | null = null;
	private rows: DiffLine[] = [];
	private width = 0;
	private offset = 0;
	private target: number | null = null;
	private viewportWidth = 320;
	private viewportHeight = 400;
	private totalHeight = 0;
	private threadHeights = new Map<string, number>();
	private drag: { y: number; offset: number } | null = null;

	init(): void {
		this.offset = 0;
	}
	jump(comment: number | null): void {
		this.target = comment;
		this.offset = 0;
	}

	private scrollTo(next: number, cx: Context): void {
		const offset = Math.max(0, Math.min(next, this.totalHeight - this.viewportHeight));
		if (offset === this.offset) return;
		this.offset = offset;
		cx.notify();
	}

	render(file: ChangedFile, discussions?: ReviewThreads, commit?: string): Element {
		const t = colors();
		if (this.file !== file) {
			this.file = file;
			this.rows = parsePatch(file.patch ?? "");
			this.width = this.rows.reduce((width, row) => Math.max(width, row.text.length * 16 + 152), 240);
		}
		const rows = this.rows;
		const cardWidth = Math.max(240, this.viewportWidth - 12);
		// Keep only data and factories here. Native elements must never cross a deferred list's arena.
		const items: DiffItem[] = [];
		const threads = (discussions?.threads ?? []).filter((thread) => thread.path === file.path);
		const anchors = new Map<number | null, ReviewThread[]>();
		for (const thread of threads) {
			const row = threadRow(rows, thread);
			const group = anchors.get(row) ?? [];
			group.push(thread);
			anchors.set(row, group);
		}
		const appendThreads = (row: number | null) => {
			for (const thread of anchors.get(row) ?? []) {
				items.push({
					key: thread.id,
					height: this.threadHeights.get(thread.id) ?? THREAD_ESTIMATE,
					render: () =>
						discussions!.card(thread, row === null, cardWidth, (height, cx) => {
							const measured = Math.ceil(height);
							if (measured <= 0 || this.threadHeights.get(thread.id) === measured) return;
							this.threadHeights.set(thread.id, measured);
							cx.notify();
						}),
					commentIds: thread.comments.map((c) => c.id),
				});
			}
		};
		rows.forEach((row, index) => {
			const count = commit ? (discussions?.inlineDraftCount(file.path, row) ?? 0) : 0;
			const height = ROW_HEIGHT + count * COMPOSER_HEIGHT;
			items.push({
				key: `line-${index}`,
				height,
				render: () => {
					const comment = commit ? discussions?.inlineComposer(file.path, commit, row, cardWidth) : undefined;
					return v_flex()
						.h(height)
						.flex_none()
						.child(diffRow(row, comment?.gutters))
						.children(comment?.editors ?? []);
				},
			});
			appendThreads(index);
		});
		appendThreads(null);
		const sizes = items.map((item) => item.height);
		if (this.target !== null) {
			const index = items.findIndex((item) => item.commentIds?.includes(this.target!));
			if (index >= 0) {
				const top = sizes.slice(0, index).reduce((sum, height) => sum + height, 0);
				this.offset = top - Math.max(0, (this.viewportHeight - sizes[index]!) / 2);
				this.target = null;
			}
		}
		const visible = itemWindow(sizes, this.offset, this.viewportHeight);
		this.offset = visible.offset;
		this.totalHeight = visible.total;
		const maxOffset = Math.max(0, visible.total - this.viewportHeight);
		const thumbHeight = Math.min(
			this.viewportHeight,
			Math.max(28, this.viewportHeight ** 2 / Math.max(1, visible.total)),
		);
		const travel = this.viewportHeight - thumbHeight;
		const thumbTop = maxOffset > 0 ? (this.offset / maxOffset) * travel : 0;
		const id = `pull-diff-${file.path}`;
		const header = v_flex()
			.flex_none()
			.px(16)
			.py(8)
			.gap(6)
			.border_b(1)
			.border_color(t.border)
			.child(
				h_flex()
					.gap(10)
					.items_center()
					.flex_wrap()
					.child(div().min_w(0).font_medium().child(file.path))
					.child(div().text_color(t.done).child(`+${file.additions}`))
					.child(div().text_color(t.blocked).child(`−${file.deletions}`))
					.child(link(`${id}-browser`, file.url, "Open File on GitHub").text_size(12).text_color(t.accent)),
			)
			.when(file.previousPath !== null, (el) =>
				el.child(div().text_size(12).text_color(t.dim).child(`Renamed from ${file.previousPath}`)),
			);
		const body =
			items.length > 0
				? div()
						.id(`${id}-body`)
						.flex_1()
						.min_h(0)
						.min_w(0)
						.relative()
						.overflow_hidden()
						.on_size_change((size, cx) => {
							if (
								size.width > 0 &&
								size.height > 0 &&
								(size.width !== this.viewportWidth || size.height !== this.viewportHeight)
							) {
								this.viewportWidth = size.width;
								this.viewportHeight = size.height;
								cx.notify();
							}
						})
						.on_scroll_wheel((event, cx) => {
							if (event.delta.y && Math.abs(event.delta.y) >= Math.abs(event.delta.x)) {
								this.scrollTo(this.offset - event.delta.y, cx);
								cx.stop_propagation();
							}
						})
						.on_mouse_move((event, cx) => {
							if (this.drag && travel > 0)
								this.scrollTo(this.drag.offset + ((event.position.y - this.drag.y) * maxOffset) / travel, cx);
						})
						.on_mouse_up("left", () => {
							this.drag = null;
						})
						.on_hover((hovered) => {
							if (!hovered) this.drag = null;
						})
						.child(
							div()
								.id(`${id}-horizontal`)
								.absolute()
								.top_0()
								.bottom_0()
								.left_0()
								.right(12)
								.overflow_x_scrollbar()
								.child(
									div()
										.relative()
										.h_full()
										.w(Math.max(this.width, cardWidth))
										.overflow_hidden()
										.child(
											v_flex()
												.absolute()
												.top(visible.top - visible.offset)
												.left_0()
												.w_full()
												.children(
													items
														.slice(visible.start, visible.end)
														.map((item) =>
															div().id(`${id}-${item.key}`).h(item.height).flex_none().child(item.render()),
														),
												),
										),
								),
						)
						.when(maxOffset > 0, (el) =>
							el.child(
								div()
									.id(`${id}-scrollbar`)
									.absolute()
									.top_0()
									.bottom_0()
									.right_0()
									.w(12)
									.cursor_pointer()
									.accessibility_label("Diff vertical scrollbar")
									.on_mouse_down("left", (event, cx) => {
										cx.stop_propagation();
										const y = event.local_position?.y;
										if (y === undefined || travel <= 0) return;
										if (y < thumbTop || y > thumbTop + thumbHeight)
											this.scrollTo(((y - thumbHeight / 2) / travel) * maxOffset, cx);
										this.drag = { y: event.position.y, offset: this.offset };
									})
									.child(div().absolute().top(thumbTop).right(2).w(8).h(thumbHeight).rounded(4).bg(t.dim)),
							),
						)
				: div()
						.p(20)
						.text_color(t.dim)
						.child(
							file.additions === 0 && file.deletions === 0
								? "No textual changes in this file. Open it on GitHub to view the full file."
								: "GitHub did not provide a patch for this file (it may be binary or too large). Open it on GitHub to view the changes.",
						);
		return v_flex()
			.id(`${id}-viewport`)
			.flex_1()
			.min_h(0)
			.min_w(0)
			.overflow_hidden()
			.child(header)
			.when(Boolean(discussions), (el) => el.child(discussions!.status()))
			.when(Boolean(discussions) && !commit, (el) =>
				el.child(
					div()
						.px(16)
						.text_size(12)
						.text_color(t.dim)
						.child("Inline comments are unavailable until pull request details finish loading."),
				),
			)
			.when(!file.patch && file.status !== "unchanged" && items.length > 0, (el) =>
				el.child(
					div()
						.p(12)
						.text_color(t.dim)
						.child("GitHub did not provide a patch for this file. Discussions are shown below."),
				),
			)
			.child(body);
	}
}

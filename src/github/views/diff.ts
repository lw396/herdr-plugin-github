// Virtualized code rows and fixed-height, independently scrollable discussion cards.
import { h_flex, Scrollbar, VirtualListScrollHandle, v_flex, v_virtual_list } from "gpui-base";
import { div, type Element } from "gpui-kit";
import { type DiffLine, parsePatch } from "../core/diff.ts";
import type { ChangedFile } from "../core/files.ts";
import { type ReviewThread, threadRow } from "../core/review-threads.ts";
import { diffRow, ROW_HEIGHT } from "./diff-lines.ts";
import { COMPOSER_HEIGHT, type ReviewThreads, THREAD_HEIGHT } from "./review-threads.ts";
import { colors, link } from "./ui.ts";

export class FileDiff {
	private file: ChangedFile | null = null;
	private rows: DiffLine[] = [];
	private width = 0;
	private scroll: VirtualListScrollHandle | null = null;
	private target: number | null = null;
	private viewportWidth = 320;

	init(): void {
		this.scroll = VirtualListScrollHandle.new();
	}
	jump(comment: number | null): void {
		this.target = comment;
		this.scroll?.scroll_to_item(0);
	}

	render(file: ChangedFile, discussions?: ReviewThreads, commit?: string): Element {
		const t = colors();
		if (this.file !== file) {
			this.file = file;
			this.rows = parsePatch(file.patch ?? "");
			// A generous monospace width also leaves room for wide Unicode characters. Computed only once per file.
			this.width = this.rows.reduce((width, row) => Math.max(width, row.text.length * 16 + 152), 240);
		}
		const rows = this.rows;
		// Build interactive cards now: native deferred renderers cannot register handlers.
		const items: {
			key: string;
			height: number;
			element?: Element;
			line?: DiffLine;
			gutters?: { left?: Element; right?: Element };
			commentIds?: number[];
		}[] = [];
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
					height: THREAD_HEIGHT,
					element: discussions!.card(thread, row === null, this.viewportWidth),
					commentIds: thread.comments.map((c) => c.id),
				});
			}
		};
		rows.forEach((row, index) => {
			const comment = commit ? discussions?.inlineComposer(file.path, commit, row, this.viewportWidth) : undefined;
			items.push({ key: `line-${index}`, height: ROW_HEIGHT, line: row, gutters: comment?.gutters });
			for (const [side, editor] of (comment?.editors ?? []).entries())
				items.push({ key: `editor-${index}-${side}`, height: COMPOSER_HEIGHT, element: editor });
			appendThreads(index);
		});
		// Native layout measures a representative row twice; keep it non-interactive even without a patch.
		if (!rows.length && threads.length)
			items.push({
				key: "discussions",
				height: ROW_HEIGHT,
				line: { kind: "notice", text: "Discussions", oldLine: null, newLine: null, comment: null },
			});
		appendThreads(null);
		if (this.target !== null) {
			const index = items.findIndex((item) => item.commentIds?.includes(this.target!));
			if (index >= 0) {
				this.scroll?.scroll_to_item(index, "center");
				this.target = null;
			}
		}
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
						.flex_1()
						.min_h(0)
						.min_w(0)
						.relative()
						.child(
							div()
								.id(`${id}-horizontal`)
								.size_full()
								.overflow_x_scrollbar()
								.child(
									v_virtual_list(
										id,
										items.length,
										items.map((item) => item.height),
										(index) => items[index]!.key,
										(range) =>
											items
												.slice(range.start, range.end)
												.map((item) => item.element ?? diffRow(item.line!, item.gutters)),
									)
										.with_item_to_measure_index(0)
										.when(this.scroll !== null, (el) => el.track_scroll(this.scroll!))
										.h_full()
										.w_full()
										.min_w(this.width),
								),
						)
						.child(Scrollbar.vertical(id).absolute().inset_0())
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
			.on_size_change((size, cx) => {
				if (size.width > 0 && size.width !== this.viewportWidth) {
					this.viewportWidth = size.width;
					cx.notify();
				}
			})
			.child(header)
			.when(Boolean(discussions), (el) => el.child(discussions!.status()))
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

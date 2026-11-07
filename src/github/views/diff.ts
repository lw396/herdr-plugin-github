// A fixed-height unified diff: the native virtual list asks JavaScript only for visible rows.
import { h_flex, Scrollbar, v_flex, v_virtual_list } from "gpui-base";
import { div, type Element } from "gpui-kit";
import { type DiffLine, parsePatch } from "../core/diff.ts";
import type { ChangedFile } from "../core/files.ts";
import { colors, link } from "./ui.ts";

const ROW_HEIGHT = 22;

export class FileDiff {
	private file: ChangedFile | null = null;
	private rows: DiffLine[] = [];
	private width = 0;

	render(file: ChangedFile): Element {
		const t = colors();
		if (this.file !== file) {
			this.file = file;
			this.rows = parsePatch(file.patch ?? "");
			// A generous monospace width also leaves room for wide Unicode characters. Computed only once per file.
			this.width = this.rows.reduce((width, row) => Math.max(width, row.text.length * 16 + 152), 240);
		}
		const rows = this.rows;
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
			rows.length > 0
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
										rows.length,
										ROW_HEIGHT,
										(index) => String(index),
										(range) => rows.slice(range.start, range.end).map(diffRow),
									)
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
		return v_flex().flex_1().min_h(0).min_w(0).overflow_hidden().child(header).child(body);
	}
}

/** No event handlers here: deferred virtual-list renderers run during native layout. */
function diffRow(row: DiffLine): Element {
	const t = colors();
	const added = row.kind === "add",
		deleted = row.kind === "delete";
	return h_flex()
		.h(ROW_HEIGHT)
		.w_full()
		.flex_none()
		.items_center()
		.font_family("monospace")
		.text_size(13)
		.when(added, (el) => el.bg(`${t.done}20`))
		.when(deleted, (el) => el.bg(`${t.blocked}20`))
		.when(row.kind === "hunk", (el) => el.bg(`${t.accent}18`).text_color(t.accent))
		.when(row.kind === "notice", (el) => el.text_color(t.dim))
		.child(
			div()
				.w(54)
				.flex_none()
				.pr(8)
				.text_right()
				.text_color(t.dim)
				.child(row.oldLine ?? ""),
		)
		.child(
			div()
				.w(54)
				.flex_none()
				.pr(8)
				.text_right()
				.text_color(t.dim)
				.child(row.newLine ?? ""),
		)
		.child(
			div()
				.w(20)
				.flex_none()
				.text_color(added ? t.done : deleted ? t.blocked : t.dim)
				.child(added ? "+" : deleted ? "−" : ""),
		)
		.child(div().flex_none().whitespace_nowrap().child(row.text));
}

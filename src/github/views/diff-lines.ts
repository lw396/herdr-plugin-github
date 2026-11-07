// Shared rendering for virtualized file diffs and in-place review snippets.
import { h_flex, v_flex } from "gpui-base";
import { div, type Element } from "gpui-kit";
import { type DiffLine, parsePatch } from "../core/diff.ts";
import { colors } from "./ui.ts";

export const ROW_HEIGHT = 22;

/** A review's code context stays in its timeline discussion; the full file still uses the virtual list. */
export function diffSnippet(id: string, patch: string): Element {
	return v_flex().id(id).min_w(0).w_full().overflow_x_scrollbar().children(parsePatch(patch).map(diffRow));
}

/** No event handlers here: deferred virtual-list renderers run during native layout. */
export function diffRow(row: DiffLine): Element {
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

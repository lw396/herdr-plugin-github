// Read-only discussion pieces shared by issue and PR description pages.
import { h_flex, TextView, v_flex } from "gpui-base";
import { type Context, div, type Element } from "gpui-kit";
import type { Comment } from "../core/issue-detail.ts";
import { relativeTime } from "../core/time.ts";
import { chip, colors } from "./ui.ts";

export type Post = Pick<Comment, "author" | "createdAt" | "markdown"> & { reactions?: Comment["reactions"] };

export function postCard(id: string, post: Post, verb: string, onLink: (url: string, cx: Context) => void): Element {
	const t = colors();
	const reactions = post.reactions ?? [];
	const heading = h_flex()
		.px(16)
		.py(10)
		.gap(8)
		.items_center()
		.flex_wrap()
		.bg(t.raised)
		.border_b(1)
		.border_color(t.border)
		.text_size(12)
		.child(div().font_semibold().child(post.author))
		.child(div().text_color(t.dim).child(verb))
		.child(div().flex_1())
		.child(div().text_color(t.dim).tooltip(post.createdAt).child(relativeTime(post.createdAt, Date.now())));
	const text = TextView.markdown(id, post.markdown).selectable(true).scrollable(false).on_link_click(onLink);
	return v_flex()
		.id(`${id}-card`)
		.min_w(0)
		.w_full()
		.overflow_hidden()
		.rounded(8)
		.border_1()
		.border_color(t.border)
		.bg(t.background)
		.child(heading)
		.child(
			v_flex()
				.min_w(0)
				.px(16)
				.py(16)
				.gap(12)
				.child(text)
				.when(reactions.length > 0, (el) =>
					el.child(
						h_flex()
							.gap(6)
							.flex_wrap()
							.children(reactions.map((r) => chip(`${r.emoji} ${r.count}`, t.border, t.raised))),
					),
				),
		);
}

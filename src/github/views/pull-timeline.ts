// PR activity is compact; reviews own their code context and actionable conversations.
import { h_flex, v_flex } from "gpui-base";
import { type Context, div, type Element } from "gpui-kit";
import type { PullTimelineItem } from "../core/pull-timeline.ts";
import { relativeTime } from "../core/time.ts";
import { postCard } from "./detail.ts";
import { diffSnippet } from "./diff-lines.ts";
import type { ReviewThreads } from "./review-threads.ts";
import { button, colors } from "./ui.ts";

export function timelineItem(
	item: PullTimelineItem,
	discussions: ReviewThreads | null,
	onLink: (url: string, cx: Context) => void,
	open: (cx: Context, path: string, comment: number) => void,
): Element {
	const t = colors();
	if (item.kind === "event") {
		return h_flex()
			.id(`pull-activity-${item.id}`)
			.min_w(0)
			.gap(8)
			.py(6)
			.items_center()
			.flex_wrap()
			.text_size(12)
			.child(div().text_color(t.dim).child("◇"))
			.child(div().font_semibold().child(item.author))
			.child(div().text_color(t.dim).child(item.verb))
			.when(Boolean(item.body.trim()), (el) => el.child(div().child(item.body)))
			.child(div().flex_1())
			.child(div().text_color(t.dim).tooltip(item.createdAt).child(relativeTime(item.createdAt, Date.now())));
	}
	if (item.kind === "comment") return postCard(`pull-comment-${item.id}`, item, item.verb, onLink);
	const roots = item.discussion.filter((d) => d.root === d.comment.id);
	return v_flex()
		.id(`pull-review-${item.id}`)
		.min_w(0)
		.w_full()
		.border_1()
		.border_color(t.border)
		.rounded(8)
		.overflow_hidden()
		.child(
			postCard(`pull-review-header-${item.id}`, item, item.verb, onLink, {
				embedded: true,
				headingOnly: !item.body.trim(),
			}),
		)
		.when(roots.length > 0, (el) =>
			el.child(
				v_flex()
					.min_w(0)
					.p(12)
					.gap(12)
					.children(
						roots.map((d) => {
							const thread = discussions?.threads.find((thread) => thread.root === d.root);
							if (thread && discussions)
								return discussions.timeline(thread, d.snippet, (cx) => open(cx, d.path, d.root));
							// Keep the published conversation readable even while resolution metadata is loading or unavailable.
							return v_flex()
								.min_w(0)
								.border_1()
								.border_color(t.border)
								.rounded(6)
								.overflow_hidden()
								.child(
									button(`inline-jump-${d.root}`, d.path, "Open File Diff", (_e, cx) =>
										open(cx, d.path, d.root),
									).text_color(t.accent),
								)
								.when(Boolean(d.snippet), (el) => el.child(diffSnippet(`inline-snippet-${d.root}`, d.snippet)))
								.children(
									item.discussion
										.filter((reply) => reply.root === d.root)
										.map((reply) =>
											postCard(`inline-${reply.comment.id}`, reply.comment, "commented", onLink, { embedded: true }),
										),
								)
								.when(Boolean(discussions), (el) => el.child(discussions!.status()));
						}),
					),
			),
		);
}

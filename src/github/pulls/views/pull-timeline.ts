import { h_flex, TextView, v_flex } from "gpui-base";
import { type Context, div, type Element } from "gpui-kit";
import { labelChip, postCard } from "../../detail/views/detail.ts";
import { relativeTime } from "../../shared/core/time.ts";
import { button, colors } from "../../shared/views/ui.ts";
import { type PullTimelineItem, timelineKey } from "../core/pull-timeline.ts";
import { diffSnippet } from "./diff-lines.ts";
import type { ReviewThreads } from "./review-threads.ts";

export function timelineItem(
	item: PullTimelineItem,
	discussions: ReviewThreads | null,
	onLink: (url: string, cx: Context) => void,
	open: (cx: Context, path: string, comment: number) => void,
	activity?: { expanded: boolean; toggle: (cx: Context) => void },
): Element {
	const t = colors();
	if (item.kind === "event") {
		const key = timelineKey(item);
		const body = item.body.trim();
		const labels = item.labels ?? [];
		// One line, as in the issue timeline: who, what, the labels or commit subject, and when.
		const row = h_flex()
			.min_w(0)
			.gap(8)
			.items_center()
			.flex_wrap()
			.child(div().flex_none().text_color(t.dim).child("◇"))
			.child(div().flex_none().font_semibold().child(item.author))
			.child(div().flex_none().text_color(t.dim).child(item.verb))
			.when(labels.length > 0, (el) =>
				el.children(labels.map(labelChip)).child(
					div()
						.flex_none()
						.text_color(t.dim)
						.child(labels.length === 1 ? "label" : "labels"),
				),
			)
			.child(
				div()
					.flex_1()
					.min_w(0)
					.when(Boolean(body), (el) =>
						el.child(
							TextView.markdown(`pull-activity-body-${key}`, item.markdown)
								.selectable(true)
								.scrollable(false)
								.on_link_click(onLink),
						),
					),
			)
			.when(Boolean(item.details && activity), (el) =>
				el.child(
					button(
						`pull-activity-toggle-${key}`,
						activity?.expanded ? "Hide" : "Show",
						activity?.expanded ? "Hide Commit Details" : "Show Commit Details",
						(_e, cx) => activity?.toggle(cx),
					)
						.flex_none()
						.text_color(t.accent),
				),
			)
			.child(
				div().flex_none().text_color(t.dim).tooltip(item.createdAt).child(relativeTime(item.createdAt, Date.now())),
			);
		return v_flex()
			.id(`pull-activity-${key}`)
			.min_w(0)
			.gap(6)
			.px(16)
			.py(4)
			.text_size(12)
			.child(row)
			.when(Boolean(item.details && activity?.expanded), (el) =>
				el.child(
					v_flex()
						.min_w(0)
						.pl(20)
						.child(
							TextView.markdown(`pull-activity-details-${key}`, item.details!.markdown)
								.selectable(true)
								.scrollable(false)
								.on_link_click(onLink),
						),
				),
			);
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
										.map((reply, index) =>
											postCard(`inline-${reply.comment.id}`, reply.comment, "commented", onLink, {
												embedded: true,
											}).when(index > 0, (el) => el.border_t(1).border_color(t.border)),
										),
								);
						}),
					),
			),
		);
}

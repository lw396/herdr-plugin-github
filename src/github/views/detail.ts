// The parts issue and PR pages share inside a reader tab: header, body, posts, metadata and links.
import { h_flex, TextView, v_flex } from "gpui-base";
import { type Color, type Context, div, type Element, svg } from "gpui-kit";
import { type DetailKind, type DetailRef, detailKey, detailUrl } from "../core/detail.ts";
import type { Comment } from "../core/discussion.ts";
import type { Label } from "../core/labels.ts";
import { browserUrl, detailLink } from "../core/markdown.ts";
import type { Projects } from "../core/projects.ts";
import { relativeTime } from "../core/time.ts";
import { button, chip, colors, link, spinner, square } from "./ui.ts";

/** What a page asks of the reader tab that hosts it. */
export interface DetailHost {
	/** The reader tab's id in shared metadata. */
	readonly reader: string;
	/** Whether this kind of page is the one shown. */
	active(kind: DetailKind): boolean;
	previous(): DetailRef | null;
	follow(cx: Context, ref: DetailRef): void;
	back(cx: Context): void;
}

const NOUN: Record<DetailKind, string> = { issue: "issue", pr: "pull request" };
const Noun = (kind: DetailKind): string => NOUN[kind].charAt(0).toUpperCase() + NOUN[kind].slice(1);

/** A link in a post: an issue or PR of this repository opens in the tab; any other web link, in the browser. */
export function openLink(cx: Context, host: DetailHost, url: string, page: string): void {
	const ref = detailLink(url, page);
	if (ref) host.follow(cx, ref);
	else {
		const external = browserUrl(url, page);
		if (external) cx.open_url(external);
	}
}

/** Nothing to show yet: the tab was restored after a restart, or its item hasn't arrived. */
export function detailEmpty(kind: DetailKind): Element {
	const t = colors();
	const hint = `Choose ${kind === "pr" ? "a" : "an"} ${NOUN[kind]} in the GitHub sidebar. ${Noun(kind)} details are not restored after restarting Herdr.`;
	return v_flex()
		.flex_1()
		.gap(8)
		.items_center()
		.justify_center()
		.p(24)
		.child(
			div()
				.font_semibold()
				.child(`${Noun(kind)} details`),
		)
		.child(div().text_size(13).text_color(t.dim).text_center().child(hint));
}

/** Back, the title with its number (opens the browser) and copy, and refresh. */
export function detailHeader(
	host: DetailHost,
	ref: DetailRef,
	shown: { title?: string; url?: string; loading: boolean },
	refresh: (cx: Context) => void,
): Element {
	const t = colors();
	const url = shown.url ?? detailUrl(ref);
	const previous = host.previous();
	const number = link(`${ref.kind}-browser`, url, `#${ref.number}`)
		.px(2)
		.rounded(4)
		.text_color(t.accent)
		.hover((s) => s.bg(t.hover))
		.tooltip(`Open ${ref.repo} #${ref.number} in browser`)
		.accessibility_label(`Open #${ref.number} in browser`);
	const copy = button(
		`${ref.kind}-copy`,
		svg("mods/github/assets/copy.svg").size(16),
		`Copy ${NOUN[ref.kind]} link`,
		(_e, cx) => cx.write_to_clipboard(url),
	);
	return h_flex()
		.flex_none()
		.px(24)
		.pt(18)
		.pb(12)
		.gap(12)
		.items_start()
		.when(previous !== null, (el) =>
			el.child(
				square(button(`${ref.kind}-back`, "←", `Back to #${previous?.number}`, (_e, cx) => host.back(cx))).text_size(
					22,
				),
			),
		)
		.child(
			h_flex()
				.flex_1()
				.min_w(0)
				.gap(8)
				.items_center()
				.flex_wrap()
				.text_size(22)
				.child(
					div()
						.min_w(0)
						.font_semibold()
						.child(shown.title ?? `${Noun(ref.kind)} details`),
				)
				.child(h_flex().gap(2).items_center().flex_none().child(number).child(copy)),
		)
		.child(
			shown.loading
				? square(div()).child(spinner(18))
				: square(
						button(`${ref.kind}-refresh`, "↻", `Refresh ${NOUN[ref.kind]}`, (_e, cx) => {
							refresh(cx);
							cx.notify();
						}),
					).text_size(22),
		);
}

/** The scrolling part: loading and failure notes, then the document. Keyed by item: another starts at its top. */
export function detailBody(
	ref: DetailRef,
	loading: boolean,
	failure: string | undefined,
	document: Element | null,
): Element {
	const t = colors();
	return v_flex()
		.id(`${ref.kind}-scroll-${detailKey(ref)}`)
		.flex_1()
		.min_h(0)
		.overflow_y_scroll()
		.px(24)
		.pb(18)
		.gap(12)
		.when(loading, (el) => el.child(div().text_size(12).text_color(t.dim).child(`Loading ${NOUN[ref.kind]}…`)))
		.when(failure !== undefined, (el) =>
			el.child(
				div()
					.text_color(t.blocked)
					.child(failure ?? ""),
			),
		)
		.when(document !== null, (el) => el.child(document ?? div()));
}

/** The state badge and the line beside it, then the timeline beside (wide) or below (narrow) the metadata. */
export function detailDocument(
	wide: boolean,
	heading: Element[],
	timeline: Element[],
	sections: [string, Element][],
): Element {
	const t = colors();
	const posts = v_flex()
		.min_w(0)
		.gap(20)
		.when(wide, (el) => el.flex_1())
		.when(!wide, (el) => el.w_full().flex_none())
		.children(timeline);
	const metadata = sections.map(([title, value]) =>
		v_flex()
			.gap(10)
			.py(16)
			.border_b(1)
			.border_color(t.border)
			.when(!wide, (el) => el.w(180).min_w(140).flex_1())
			.child(div().text_size(13).font_semibold().child(title))
			.child(value),
	);
	const side = wide ? v_flex().w(220).flex_none().children(metadata) : h_flex().gap(20).flex_wrap().children(metadata);
	return v_flex()
		.gap(18)
		.child(h_flex().gap(10).pb(4).items_center().flex_wrap().children(heading))
		.child(wide ? h_flex().gap(24).items_start().child(posts).child(side) : v_flex().gap(20).child(side).child(posts));
}

/** An open, closed, merged… badge in its theme color. */
export function stateBadge(label: string, color: Color, icon?: string): Element {
	return h_flex()
		.gap(6)
		.items_center()
		.px(10)
		.py(4)
		.rounded(14)
		.bg(`${color}26`)
		.text_size(13)
		.font_semibold()
		.text_color(color)
		.when(icon !== undefined, (el) => el.child(svg(icon ?? "").size(14)))
		.child(label);
}

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

/** Metadata that has nothing to show. */
export const quiet = (text: string): Element => div().text_size(12).text_color(colors().dim).child(text);

export function people(logins: string[], none: string): Element {
	if (logins.length === 0) return quiet(none);
	return v_flex()
		.gap(8)
		.children(logins.map((login) => div().text_size(13).font_medium().child(login)));
}

export function labelChip(label: Label): Element {
	const t = colors();
	return chip(label.name, label.color ?? t.input, label.color ? `${label.color}26` : t.raised).text_color(t.foreground);
}

export function labels(list: Label[]): Element {
	if (list.length === 0) return quiet("None yet");
	return h_flex().gap(6).flex_wrap().children(list.map(labelChip));
}

export const milestone = (title: string | null): Element =>
	title ? div().text_size(13).child(title) : quiet("No milestone");

/** Each Project opens in the browser; why there are none shows in a tooltip. */
export function projects(list: Projects | undefined, loading: boolean): Element {
	const t = colors();
	if (!list) return quiet(loading ? "Loading Projects…" : "Projects not loaded.");
	if (!list.ok) return quiet("None yet").tooltip(list.message);
	if (list.projects.length === 0) return quiet("None yet");
	return v_flex()
		.gap(8)
		.children(
			list.projects.map((project) =>
				link(`project-${project.url}`, project.url, project.title)
					.text_size(13)
					.text_color(t.accent)
					.tooltip(project.url),
			),
		);
}

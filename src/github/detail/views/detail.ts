// The parts issue and PR pages share inside a reader tab: header, body, posts, metadata and links.
import { h_flex, TextView, v_flex } from "gpui-base";
import { type Color, type Context, div, type Element, svg } from "gpui-kit";
import { relativeTime } from "../../shared/core/time.ts";
import { button, chip, colors, link, spinner, square } from "../../shared/views/ui.ts";
import { type DetailKind, type DetailRef, detailKey, detailUrl } from "../core/detail.ts";
import type { Comment } from "../core/discussion.ts";
import type { Item } from "../core/item.ts";
import type { Label } from "../core/labels.ts";
import { browserUrl, detailLink } from "../core/markdown.ts";
import type { Projects } from "../core/projects.ts";

/** What a page asks of the reader tab that hosts it. */
export interface DetailHost {
	readonly reader: string;
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

/** Leave the reader blank during its handshake; readers without an item close automatically. */
export const detailEmpty = (): Element => div().flex_1();

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

export type DetailLayout = "wide" | "narrow" | "compact";

/** What issue and PR pages list beside the timeline; a page may add sections before the shared ones. */
export interface Metadata {
	item: Pick<Item, "assignees" | "labels" | "milestone">;
	projects: Projects | undefined;
	projectsLoading: boolean;
	before?: [title: string, value: Element][];
}

/** Session-only disclosure state; resizing or refreshing does not discard the person's choice. */
export class DetailMetadata {
	expanded = false;

	render(layout: DetailLayout, metadata: Metadata): Element {
		const t = colors();
		const wide = layout === "wide";
		const { item } = metadata;
		const sections: [string, Element][] = [
			...(metadata.before ?? []),
			["Assignees", people(item.assignees)],
			["Labels", labels(item.labels)],
			["Project", projects(metadata.projects, metadata.projectsLoading)],
			["Milestone", milestone(item.milestone)],
		];
		const fields = () =>
			sections.map(([title, value]) =>
				v_flex()
					.min_w(0)
					.gap(10)
					.py(16)
					.border_b(1)
					.border_color(t.border)
					.when(layout === "narrow", (el) => el.w(180).min_w(140).flex_grow(1))
					.when(layout === "compact", (el) => el.w_full().flex_none())
					.child(div().text_size(13).font_semibold().child(title))
					.child(value),
			);
		if (wide) return v_flex().w(220).flex_none().children(fields());
		const summary = () =>
			h_flex()
				.min_w(0)
				.gap(10)
				.py(16)
				.items_center()
				.flex_wrap()
				.child(div().text_size(13).font_semibold().child("Labels"))
				.child(layout === "compact" ? quiet(String(item.labels.length)) : labels(item.labels));
		let content: Element;
		if (!this.expanded) content = summary();
		else if (layout === "compact") content = v_flex().children(fields());
		else content = h_flex().gap(20).items_start().flex_wrap().children(fields());
		const label = this.expanded ? "See less" : "See more";
		return v_flex()
			.min_w(0)
			.gap(12)
			.pb(16)
			.border_b(1)
			.border_color(t.border)
			.child(content)
			.child(
				h_flex().child(
					button("detail-metadata-toggle", label, label, (_e, cx) => {
						this.expanded = !this.expanded;
						cx.notify();
					}).text_color(t.accent),
				),
			);
	}
}

export function detailDocument(
	layout: DetailLayout,
	heading: Element[],
	timeline: Element[],
	sections: Metadata,
	metadata: DetailMetadata,
): Element {
	const wide = layout === "wide";
	const posts = v_flex()
		.min_w(0)
		.gap(20)
		.when(wide, (el) => el.flex_1())
		.when(!wide, (el) => el.w_full().flex_none())
		.children(timeline);
	const side = metadata.render(layout, sections);
	return v_flex()
		.gap(18)
		.child(h_flex().gap(10).pb(4).items_center().flex_wrap().children(heading))
		.child(wide ? h_flex().gap(24).items_start().child(posts).child(side) : v_flex().gap(20).child(side).child(posts));
}

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

/** Embedded posts keep their heading and body together; the caller separates neighboring posts. */
export function postCard(
	id: string,
	post: Post,
	verb: string,
	onLink: (url: string, cx: Context) => void,
	options: { embedded?: boolean; headingOnly?: boolean } = {},
): Element {
	const t = colors();
	const reactions = post.reactions ?? [];
	const heading = h_flex()
		.px(16)
		.pt(10)
		.pb(options.embedded ? 4 : 10)
		.gap(8)
		.items_center()
		.flex_wrap()
		.when(!options.embedded, (el) => el.bg(t.raised).border_b(1).border_color(t.border))
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
		.when(!options.embedded, (el) => el.rounded(8).border_1().border_color(t.border).bg(t.background))
		.child(heading)
		.when(!options.headingOnly, (el) =>
			el.child(
				v_flex()
					.min_w(0)
					.px(16)
					.pt(options.embedded ? 4 : 16)
					.pb(options.embedded ? 12 : 16)
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
			),
		);
}

export const quiet = (text: string): Element => div().text_size(12).text_color(colors().dim).child(text);

function people(logins: string[]): Element {
	if (logins.length === 0) return quiet("None yet");
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

const milestone = (title: string | null): Element => (title ? div().text_size(13).child(title) : quiet("No milestone"));

/** Each Project opens in the browser; why there are none shows in a tooltip. */
function projects(list: Projects | undefined, loading: boolean): Element {
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

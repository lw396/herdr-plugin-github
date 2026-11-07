// The sidebar's Pull Requests tab: the VS Code extension's categories as foldable groups.
// The sidebar (panel.ts) owns the place, the account and the refreshes; this draws and loads the groups.

import { h_flex, v_flex } from "gpui-base";
import { type Color, type Context, div, type Element, svg } from "gpui-kit";
import type { Failure } from "../core/issues.ts";
import type { Pull, PullGroup, PullGroupKind, PullState } from "../core/pulls.ts";
import type { RemoteRepo } from "../core/remote.ts";
import type { DetailTabs } from "../io/detail-tabs.ts";
import * as gh from "../io/gh.ts";
import * as known from "../io/known.ts";
import { button, colors, spinner, stop } from "./ui.ts";

/** The groups, in the extension's order, with its titles; Waiting For My Review and the others join later. */
const GROUPS: { kind: PullGroupKind; title: string }[] = [{ kind: "all", title: "All Open" }];
/** What the extension says in an empty category. */
const EMPTY = "0 pull requests in this category";

/** The state icons (Octicons) and the theme color each takes. Merged and closed rows come with Local Pull Request Branches (#24). */
const ICONS: Record<PullState, { svg: string; color: (t: Record<string, Color>) => Color; label: string }> = {
	open: { svg: "git-pull-request", color: (t) => t.done, label: "Open" },
	draft: { svg: "git-pull-request-draft", color: (t) => t.dim, label: "Draft" },
	merged: { svg: "git-merge", color: (t) => t.ansi5, label: "Merged" },
	closed: { svg: "git-pull-request-closed", color: (t) => t.blocked, label: "Closed" },
};

interface Group {
	expanded: boolean;
	page: PullGroup | undefined;
	loading: boolean;
	loadingMore: boolean;
	failure: Failure | undefined;
}

/** What the list needs from the sidebar, asked each time (the place can change between calls). */
export interface PullHost {
	ready(): { remote: RemoteRepo; login: string; on: string | null } | null;
	/** The latest refresh: answers from an older one are dropped. */
	run(): number;
	details: DetailTabs;
	/** Says why opening a PR's tab failed, in the list's place. */
	openFailed(message: string | null): void;
}

export class PullList {
	groups: Record<PullGroupKind, Group> = {
		all: { expanded: true, page: undefined, loading: false, loadingMore: false, failure: undefined },
	};
	/** The row under the pointer: it shows its actions. */
	hovered: string | null = null;

	private readonly host: PullHost;

	constructor(host: PullHost) {
		this.host = host;
	}

	get busy(): boolean {
		return GROUPS.some(({ kind }) => this.groups[kind].loading || this.groups[kind].loadingMore);
	}

	/** A failure every group shares (the repository isn't there or can't be seen), said once in the list's place. */
	get notFound(): Failure | undefined {
		return GROUPS.map(({ kind }) => this.groups[kind].failure).find((f) => f?.notFound);
	}

	/** Shows what is kept for this place at once (another place: nothing yet). */
	show(): void {
		const r = this.host.ready();
		this.hovered = null;
		for (const { kind } of GROUPS) {
			const g = this.groups[kind];
			g.page = r ? known.peekPullGroup(kind, r.remote, r.login, r.on) : undefined;
			g.failure = undefined;
			g.loading = g.loadingMore = false;
		}
	}

	/** Asks for every expanded group's first page (fresh kept pages are reused unless `force`). */
	load(cx: Context, force = false): void {
		for (const { kind } of GROUPS) this.loadGroup(cx, kind, force);
	}

	private loadGroup(cx: Context, kind: PullGroupKind, force: boolean): void {
		const g = this.groups[kind],
			r = this.host.ready(),
			run = this.host.run();
		if (!r || !g.expanded) return;
		g.loading = true;
		g.failure = undefined;
		cx.spawn(async (cx) => {
			try {
				const page = await known.pullGroup(kind, r.remote, r.login, r.on, force);
				if (run === this.host.run()) g.page = known.peekPullGroup(kind, r.remote, r.login, r.on) ?? page;
			} catch (e) {
				if (run === this.host.run()) g.failure = gh.failureOf(e);
			} finally {
				if (run === this.host.run()) {
					g.loading = false;
					cx.notify();
				}
			}
		});
	}

	private toggle(cx: Context, kind: PullGroupKind): void {
		const g = this.groups[kind];
		g.expanded = !g.expanded;
		if (g.expanded) this.loadGroup(cx, kind, false);
		cx.notify();
	}

	private more(cx: Context, kind: PullGroupKind): void {
		const g = this.groups[kind],
			r = this.host.ready(),
			run = this.host.run(),
			loaded = g.page;
		if (!r || !loaded?.more || g.loadingMore) return;
		g.loadingMore = true;
		cx.notify();
		cx.spawn(async (cx) => {
			try {
				const page = await known.morePulls(kind, r.remote, r.login, r.on, loaded);
				if (run === this.host.run()) g.page = page;
			} catch (e) {
				if (run === this.host.run()) g.failure = gh.failureOf(e);
			} finally {
				if (run === this.host.run()) {
					g.loadingMore = false;
					cx.notify();
				}
			}
		});
	}

	/** The groups (the sidebar draws problems shared with Issues: gh, no remote, not found). */
	render(): Element {
		return v_flex()
			.gap(4)
			.children(GROUPS.map((g) => this.group(g)));
	}

	private group({ kind, title }: (typeof GROUPS)[number]): Element {
		const t = colors();
		const g = this.groups[kind];
		const page = g.page;
		const heading = h_flex()
			.id(`pr-group-${kind}`)
			.h(26)
			.px(8)
			.gap(6)
			.items_center()
			.rounded(6)
			.text_size(12)
			.text_color(t.dim)
			.cursor_pointer()
			.hover((s) => s.bg(t.hover))
			.on_mouse_down("left", stop)
			.on_click((_e, cx) => this.toggle(cx, kind))
			.accessibility_label(`${g.expanded ? "Fold" : "Unfold"} ${title}`)
			.child(
				div()
					.w(10)
					.flex_none()
					.child(g.expanded ? "▾" : "▸"),
			)
			.child(div().font_medium().child(title))
			.child(div().child(page ? String(page.total) : ""))
			.when(g.expanded && g.loading, (el) => el.child(spinner()));
		const failure = h_flex()
			.px(8)
			.pl(22)
			.py(2)
			.gap(6)
			.items_center()
			.text_size(12)
			.child(div().flex_none().size(6).rounded(3).bg(t.blocked))
			.child(
				div()
					.flex_1()
					.min_w(0)
					.text_color(t.dim)
					.child(g.failure?.message ?? ""),
			)
			.when(!g.loading, (el) =>
				el.child(
					button(`pr-retry-${kind}`, "Retry", `Load ${title} again`, (_e, cx) => {
						this.loadGroup(cx, kind, true);
						cx.notify();
					}),
				),
			);
		const left = (page?.total ?? 0) - (page?.pulls.length ?? 0);
		const more = h_flex()
			.id(`pr-more-${kind}`)
			.h(26)
			.px(8)
			.pl(22)
			.gap(6)
			.items_center()
			.rounded(6)
			.text_size(12)
			.text_color(t.dim)
			.cursor_pointer()
			.hover((s) => s.bg(t.hover).text_color(t.foreground))
			.on_mouse_down("left", stop)
			.on_click((_e, cx) => this.more(cx, kind))
			.child(g.loadingMore ? "Loading…" : `Load more (${left} left)`)
			.when(g.loadingMore, (el) => el.child(spinner()));
		return v_flex()
			.gap(1)
			.child(heading)
			.when(g.expanded, (el) =>
				el
					.when(g.failure !== undefined && !g.failure.notFound, (el) => el.child(failure))
					.when(page?.pulls.length === 0, (el) =>
						el.child(div().px(8).pl(22).py(4).text_size(12).text_color(t.dim).child(EMPTY)),
					)
					.children((page?.pulls ?? []).map((pull) => this.row(kind, pull)))
					.when(page?.more, (el) => el.child(more)),
			);
	}

	/** The extension's row: state icon, `#number title` (a draft in italics), `by @author`; hover offers Copy and Open in browser. */
	private row(kind: PullGroupKind, pull: Pull): Element {
		const t = colors();
		const key = `${kind}#${pull.number}`;
		const hovered = this.hovered === key;
		const icon = ICONS[pull.state];
		const r = this.host.ready();
		const repo = r ? `${r.remote.owner}/${r.remote.repo}` : "";
		const title = div()
			.flex_1()
			.min_w(0)
			.truncate()
			.child(`#${pull.number} ${pull.title}`)
			.when(pull.state === "draft", (el) => el.italic());
		return h_flex()
			.id(`pr-${kind}-${pull.number}`)
			.h(28)
			.px(8)
			.pl(22)
			.gap(8)
			.items_center()
			.rounded(6)
			.cursor_pointer()
			.hover((s) => s.bg(t.hover))
			.on_mouse_down("left", stop)
			.on_click((_e, cx) => {
				this.host.openFailed(null);
				cx.spawn(async (cx) => {
					try {
						await this.host.details.open({ kind: "pr", repo, number: pull.number });
					} catch (e) {
						this.host.openFailed(e instanceof Error ? e.message : String(e));
					}
					cx.notify();
				});
			})
			.on_hover((h, cx) => {
				if (h) this.hovered = key;
				else if (this.hovered === key) this.hovered = null;
				cx.notify();
			})
			.child(
				svg(`mods/github/assets/${icon.svg}.svg`)
					.size(14)
					.flex_none()
					.text_color(icon.color(t))
					.accessibility_label(icon.label),
			)
			.child(title)
			.when(!hovered, (el) =>
				el.child(
					div()
						.flex_none()
						.max_w(110)
						.truncate()
						.text_size(12)
						.text_color(t.dim)
						.child(pull.author ? `by @${pull.author}` : "by ghost"),
				),
			)
			.when(hovered, (el) =>
				el
					.child(
						button(`pr-copy-${kind}-${pull.number}`, "#", `Copy #${pull.number}`, (_e, cx) =>
							cx.write_to_clipboard(`#${pull.number}`),
						),
					)
					.child(button(`pr-open-${kind}-${pull.number}`, "↗", "Open in browser", (_e, cx) => cx.open_url(pull.url))),
			);
	}
}

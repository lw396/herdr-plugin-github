// The sidebar's foldable groups (Issues' and Pull Requests' alike): a heading with the count, then the rows,
// why the group failed with Retry, and Load more. Each tab supplies what its groups are, how they are asked,
// and what a row shows; this keeps their pages, folding, loading and the row under the pointer.

import { h_flex, v_flex } from "gpui-base";
import { type Context, div, type Element } from "gpui-kit";
import type { DetailKind, DetailRef } from "../core/detail.ts";
import type { Failure } from "../core/gh.ts";
import type { Page } from "../core/page.ts";
import { previewKey } from "../core/preview.ts";
import * as gh from "../io/gh.ts";
import type { Ready } from "../io/groups.ts";
import { RowPreviews } from "./preview.ts";
import { button, colors, spinner, stop } from "./ui.ts";

/** What a tab's groups ask of the sidebar, each time (the place can change between calls). */
export interface ListHost {
	ready(): Ready | null;
	/** The latest refresh: answers from an older one are dropped. */
	run(): number;
	/** False stops asking (a hidden sidebar). */
	asking(): boolean;
	/** Opens (or selects) the row's reader tab. */
	open(cx: Context, ref: DetailRef, file?: string): void;
}

export interface GroupSpec<K extends string> {
	kind: K;
	title: string;
	empty: string;
}

export interface Row {
	number: number;
	url: string;
}

/** What a tab's groups are and how their pages are asked and shown. */
export interface GroupSource<K extends string, R extends Row, P extends Page<R>> {
	/** What its rows open; element ids start with it, so two tabs' groups never share one. */
	kind: DetailKind;
	groups: GroupSpec<K>[];
	/** The groups unfolded at first; which are stays as the place changes. */
	expanded: K[];
	peek(kind: K, r: Ready): P | undefined;
	ask(kind: K, r: Ready, force: boolean): Promise<P>;
	more(kind: K, r: Ready, loaded: P): Promise<P>;
	/** What the row always shows first. */
	cells(row: R): Element[];
	/** What follows, unless the pointer is over the row: then Copy and Open in browser do. */
	idle(row: R): Element[];
	/** Optional PR disclosure before the row, with its expanded changed-files navigator below. */
	disclosure?(row: R, key: string): Element;
	expandedRow?(row: R, key: string, cx: Context): Element | null;
	/** A failed ask (Issues forget their list's validator, so the next check asks again). */
	failed?(): void;
}

interface Group<P> {
	expanded: boolean;
	page: P | undefined;
	loading: boolean;
	loadingMore: boolean;
	failure: Failure | undefined;
}

export class GroupList<K extends string, R extends Row, P extends Page<R>> {
	/** The row under the pointer ("<kind>#<number>"): it shows its actions. */
	hovered: string | null = null;
	private readonly groups: Record<K, Group<P>>;
	private readonly host: ListHost;
	private readonly source: GroupSource<K, R, P>;
	private readonly previews = new RowPreviews();

	constructor(host: ListHost, source: GroupSource<K, R, P>) {
		this.host = host;
		this.source = source;
		this.groups = Object.fromEntries(
			source.groups.map(({ kind }) => [
				kind,
				{
					expanded: source.expanded.includes(kind),
					page: undefined,
					loading: false,
					loadingMore: false,
					failure: undefined,
				},
			]),
		) as Record<K, Group<P>>;
	}

	private all(): Group<P>[] {
		return this.source.groups.map(({ kind }) => this.groups[kind]);
	}

	get busy(): boolean {
		return this.all().some((g) => g.loading || g.loadingMore);
	}

	/** A failure every group shares (the repository isn't there or can't be seen): the tab says it once. */
	get notFound(): Failure | undefined {
		return this.all()
			.map((g) => g.failure)
			.find((f) => f?.notFound);
	}

	/** A loaded page of any group (what the tab's notice may depend on). */
	get anyPage(): P | undefined {
		return this.all()
			.map((g) => g.page)
			.find((p) => p !== undefined);
	}

	/** Shows what is kept for this place at once (another place: nothing yet). */
	show(): void {
		for (const { kind } of this.source.groups) this.reset(kind);
	}

	private reset(kind: K): void {
		const g = this.groups[kind],
			r = this.host.ready();
		g.page = r ? this.source.peek(kind, r) : undefined;
		g.failure = undefined;
		g.loading = g.loadingMore = false;
	}

	/** Asks for every expanded group's first page (fresh kept pages are reused unless `force`). */
	load(cx: Context, force = false, kinds?: readonly K[]): void {
		for (const { kind } of this.source.groups) {
			if (!kinds || kinds.includes(kind)) this.loadGroup(cx, kind, force);
		}
	}

	private loadGroup(cx: Context, kind: K, force: boolean): void {
		const g = this.groups[kind],
			r = this.host.ready(),
			run = this.host.run();
		if (!r || !g.expanded || !this.host.asking()) return;
		g.loading = true;
		g.failure = undefined;
		cx.spawn(async (cx) => {
			try {
				const page = await this.source.ask(kind, r, force);
				// What is kept wins: a change from a reader may have replaced this answer while it was out.
				if (run === this.host.run()) g.page = this.source.peek(kind, r) ?? page;
			} catch (e) {
				if (run === this.host.run()) {
					g.failure = gh.failureOf(e);
					this.source.failed?.();
				}
			} finally {
				if (run === this.host.run()) {
					g.loading = false;
					cx.notify();
				}
			}
		});
	}

	/** Unfolding shows what is kept and asks for what is stale. */
	private toggle(cx: Context, kind: K): void {
		const g = this.groups[kind];
		g.expanded = !g.expanded;
		if (g.expanded) {
			this.reset(kind);
			this.loadGroup(cx, kind, false);
		}
		cx.notify();
	}

	private more(cx: Context, kind: K): void {
		const g = this.groups[kind],
			r = this.host.ready(),
			run = this.host.run(),
			loaded = g.page;
		if (!r || !loaded?.more || g.loadingMore) return;
		g.loadingMore = true;
		cx.notify();
		cx.spawn(async (cx) => {
			try {
				const page = await this.source.more(kind, r, loaded);
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

	render(cx: Context): Element[] {
		return this.source.groups.map((spec) => this.group(spec, cx));
	}

	/** A foldable group: its title and count, then (unfolded) why it failed, its rows and Load more. */
	private group({ kind, title, empty }: GroupSpec<K>, cx: Context): Element {
		const t = colors();
		const id = this.source.kind;
		const g = this.groups[kind];
		const page = g.page;
		const rows = page?.rows ?? [];
		const heading = h_flex()
			.id(`${id}-group-${kind}`)
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
		// A group that failed says why, quietly, with a way to ask again; the other groups stay.
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
					button(`${id}-retry-${kind}`, "Retry", `Load ${title} again`, (_e, cx) => {
						this.loadGroup(cx, kind, true);
						cx.notify();
					}),
				),
			);
		const more = h_flex()
			.id(`${id}-more-${kind}`)
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
			.child(g.loadingMore ? "Loading…" : `Load more (${(page?.total ?? 0) - rows.length} left)`)
			.when(g.loadingMore, (el) => el.child(spinner()));
		return v_flex()
			.gap(1)
			.child(heading)
			.when(g.expanded, (el) =>
				el
					// A not-found failure is the whole tab's, said once in the list's place.
					.when(g.failure !== undefined && !g.failure.notFound, (el) => el.child(failure))
					.when(page !== undefined && rows.length === 0, (el) =>
						el.child(div().px(8).pl(22).py(4).text_size(12).text_color(t.dim).child(empty)),
					)
					.children(rows.map((row) => this.row(kind, row, cx)))
					.when(Boolean(page?.more), (el) => el.child(more)),
			);
	}

	/** A row's frame: click opens it; the pointer over it swaps its end for Copy and Open in browser. */
	private row(kind: K, row: R, cx: Context): Element {
		const t = colors();
		const id = this.source.kind;
		const key = `${kind}#${row.number}`;
		const ready = this.host.ready();
		const ref: DetailRef | null = ready
			? { kind: id, repo: `${ready.remote.owner}/${ready.remote.repo}`, number: row.number }
			: null;
		const contextKey = ready && ref ? previewKey(ref, ready.on, ready.login) : null;
		const actions = [
			button(`${id}-copy-${kind}-${row.number}`, "#", `Copy #${row.number}`, (_e, cx) =>
				cx.write_to_clipboard(`#${row.number}`),
			),
			button(`${id}-open-${kind}-${row.number}`, "↗", "Open in browser", (_e, cx) => cx.open_url(row.url)),
		];
		const disclosure = this.source.disclosure?.(row, key);
		const frame = h_flex()
			.id(`${id}-${kind}-${row.number}`)
			.h(28)
			.px(8)
			.pl(disclosure ? 14 : 22)
			.gap(disclosure ? 6 : 8)
			.items_center()
			.rounded(6)
			.cursor_pointer()
			.hover((s) => s.bg(t.hover))
			.on_mouse_down("left", stop)
			.on_click((_e, cx) => {
				const r = this.host.ready();
				if (r) this.host.open(cx, { kind: id, repo: `${r.remote.owner}/${r.remote.repo}`, number: row.number });
			})
			.on_hover((h, cx) => {
				if (h) this.hovered = key;
				else if (this.hovered === key) this.hovered = null;
				this.previews.hover(cx, `${key}-${contextKey}`, h ? ref : null, ready, () => {
					const live = this.host.ready();
					if (!live || !ref || this.hovered !== key || !this.host.asking()) return false;
					const target = { ...ref, repo: `${live.remote.owner}/${live.remote.repo}` };
					return previewKey(target, live.on, live.login) === contextKey;
				});
				cx.notify();
			})
			.children(disclosure ? [disclosure] : [])
			.children([...this.source.cells(row), ...(this.hovered === key ? actions : this.source.idle(row))]);
		const card = ready && ref ? this.previews.wrap(`${id}-${key}`, frame, ref, ready) : frame;
		const expanded = this.source.expandedRow?.(row, key, cx);
		return expanded ? v_flex().child(card).child(expanded) : card;
	}
}

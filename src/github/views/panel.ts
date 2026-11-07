// The panel role (the sidebar): the current repository's lists, starting with Issues.

import { h_flex, v_flex } from "gpui-base";
import { type AsyncContext, type Context, div, type Element, svg } from "gpui-kit";
import { closeOverlay, props } from "herdr";
import { describeAccount } from "../core/account.ts";
import {
	type Failure,
	type GroupKind,
	type Issue,
	type IssueGroup,
	issuesNotice,
	noRepository,
} from "../core/issues.ts";
import type { RemoteRepo } from "../core/remote.ts";
import { footerStatus, POLL_SECONDS } from "../core/status.ts";
import { relativeTime } from "../core/time.ts";
import { Notices } from "../io/changes.ts";
import { location, locationKey } from "../io/context.ts";
import { DetailTabs } from "../io/detail-tabs.ts";
import * as gh from "../io/gh.ts";
import { listChanges } from "../io/issues.ts";
import * as known from "../io/known.ts";
import { sidebarVisible } from "../io/visibility.ts";
import { button, colors, type Role, spinner, stop } from "./ui.ts";

/** The Issues tab's groups, in order: title, and what an empty one says. */
const GROUPS: { kind: GroupKind; title: string; empty: string }[] = [
	// One word like the others; the empty text says whose.
	{ kind: "assigned", title: "Assigned", empty: "No open issues assigned to you." },
	{ kind: "open", title: "Open", empty: "No open issues." },
	{ kind: "closed", title: "Closed", empty: "No closed issues." },
];

/** One group as the sidebar shows it: folded or not, and this place's loaded pages. */
interface Group {
	expanded: boolean;
	page: IssueGroup | undefined;
	loading: boolean;
	loadingMore: boolean;
	failure: Failure | undefined;
}

export class Panel implements Role {
	/** The place shown (locationKey()), and which refresh is the latest: older ones drop their results. */
	context: string | null = null;
	latest = 0;
	// undefined: not known yet for this place.
	account: gh.Account | undefined;
	remote: RemoteRepo | null | undefined;
	failure: Failure | undefined;
	loading = false;
	/** Folded groups ask for nothing; which are expanded stays as the place changes. */
	groups: Record<GroupKind, Group> = {
		assigned: { expanded: true, page: undefined, loading: false, loadingMore: false, failure: undefined },
		open: { expanded: false, page: undefined, loading: false, loadingMore: false, failure: undefined },
		closed: { expanded: false, page: undefined, loading: false, loadingMore: false, failure: undefined },
	};
	/** The row under the pointer ("<kind>#<number>"): it shows its actions. */
	hovered: string | null = null;
	details = new DetailTabs();
	openFailure: string | null = null;
	notices = new Notices();

	visible = false;
	etag: string | null = null;
	checking: object | null = null;
	/** When this place's lists were last confirmed fresh (a successful change check), for the footer. */
	checkedAt: number | null = null;

	init(cx: AsyncContext): void {
		cx.timer.every(POLL_SECONDS * 1000, (cx) => {
			if (!this.isVisible()) {
				this.visible = false;
				return;
			}
			if (!this.loading) this.check(cx);
		});
	}

	private isVisible(): boolean {
		return Boolean(props()?.overlay) || sidebarVisible();
	}

	/** Only a changed list re-asks expanded groups. A shown/explicit refresh asks even on 304. */
	private check(cx: Context, refresh = false): void {
		const r = this.ready(),
			run = this.latest;
		if (!r || !this.isVisible() || this.checking) return;
		const checking = {};
		this.checking = checking;
		cx.spawn(async (cx) => {
			const current = () => run === this.latest && this.checking === checking && this.isVisible();
			let changed = false;
			try {
				const result = await listChanges(`${r.remote.owner}/${r.remote.repo}`, this.etag, r.on);
				if (!current()) return;
				if (result.changed) {
					this.etag = result.etag;
					changed = true;
				}
				this.checkedAt = Date.now();
				this.failure = undefined;
			} catch (e) {
				if (current()) this.failure = gh.failureOf(e);
			} finally {
				if (current()) {
					if (changed || refresh) {
						for (const { kind } of GROUPS) this.load(cx, kind, true);
					}
					// Every finished check redraws: the footer shows a failed check and its recovery.
					cx.notify();
				}
				if (this.checking === checking) this.checking = null;
			}
		});
	}

	/** The gh account's login on the folder's machine and the remote, once both are known and usable. */
	ready(): { remote: RemoteRepo; login: string; on: string | null } | null {
		const status = this.account?.status;
		return this.remote && status?.ok && this.account
			? { remote: this.remote, login: status.user, on: this.account.on }
			: null;
	}

	/** Shows what is known about the focused place at once, then asks for what is stale (all of it when `force`, ↻). */
	refresh(cx: Context, force = false): void {
		const where = location(),
			run = ++this.latest,
			current = () => run === this.latest,
			context = JSON.stringify(where);
		// Another place has other rows: the pointer is over none of them until it moves.
		if (context !== this.context) {
			this.hovered = null;
			this.etag = null;
			this.checkedAt = null;
		}
		this.checking = null;
		this.context = context;
		// Never the previous place's facts: this place's known ones, or "…" until they arrive.
		this.account = known.peekAccount(where.on);
		this.remote = known.peekRemote(where);
		this.failure = undefined;
		for (const { kind } of GROUPS) this.show(kind);
		this.loading = true;
		cx.spawn(async (cx) => {
			try {
				// git and gh both where the folder is (ADR 0003). account() never rejects: show its
				// status even when git fails there.
				const [, remote] = await Promise.all([
					known.account(where.on, force).then((a) => {
						if (current()) this.account = a;
					}),
					known.remote(where, force),
				]);
				if (!current()) return;
				this.remote = remote;
				this.check(cx, true);
			} catch (e) {
				if (current()) this.failure = gh.failureOf(e);
			} finally {
				if (current()) {
					this.loading = false;
					cx.notify();
				}
			}
		});
	}

	/** The group's kept pages for this place, or nothing yet. */
	show(kind: GroupKind): void {
		const g = this.groups[kind],
			r = this.ready();
		g.page = r ? known.peekGroup(kind, r.remote, r.login, r.on) : undefined;
		g.failure = undefined;
		g.loading = g.loadingMore = false;
	}

	/** Asks for the group's first page (an expanded group only). */
	load(cx: Context, kind: GroupKind, force = false): void {
		const g = this.groups[kind],
			r = this.ready(),
			run = this.latest;
		if (!r || !g.expanded || !this.isVisible()) return;
		g.loading = true;
		g.failure = undefined;
		cx.spawn(async (cx) => {
			try {
				const page = await known.group(kind, r.remote, r.login, r.on, force);
				// What is kept wins: a change from a reader may have replaced this answer while it was out.
				if (run === this.latest) g.page = known.peekGroup(kind, r.remote, r.login, r.on) ?? page;
			} catch (e) {
				if (run === this.latest) {
					g.failure = gh.failureOf(e);
					// Retry a failed refresh next tick even if the list itself has not changed.
					this.etag = null;
				}
			} finally {
				if (run === this.latest) {
					g.loading = false;
					cx.notify();
				}
			}
		});
	}

	/** Folds or unfolds a group; unfolding shows what is kept and asks for what is stale. */
	toggle(cx: Context, kind: GroupKind): void {
		const g = this.groups[kind];
		g.expanded = !g.expanded;
		if (g.expanded) {
			this.show(kind);
			this.load(cx, kind);
		}
		cx.notify();
	}

	/** Load more: the next 30 rows of the group. */
	more(cx: Context, kind: GroupKind): void {
		const g = this.groups[kind],
			r = this.ready(),
			run = this.latest,
			loaded = g.page;
		if (!r || !loaded?.more || g.loadingMore) return;
		g.loadingMore = true;
		cx.notify();
		cx.spawn(async (cx) => {
			try {
				const page = await known.more(kind, r.remote, r.login, r.on, loaded);
				if (run === this.latest) g.page = page;
			} catch (e) {
				if (run === this.latest) g.failure = gh.failureOf(e);
			} finally {
				if (run === this.latest) {
					g.loadingMore = false;
					cx.notify();
				}
			}
		});
	}

	/**
	 * An issue closed or reopened in a reader: every kept group of its repository shows it at once,
	 * then the shown expanded groups ask GitHub again (the change made them stale).
	 */
	receive(cx: Context): void {
		const changes = this.notices.take().flatMap((n) => (n.state ? [n.state] : []));
		if (changes.length === 0) return;
		changes.forEach(known.issueChanged);
		for (const { kind } of GROUPS) {
			this.show(kind);
			this.load(cx, kind);
		}
	}

	render(cx: Context): Element {
		// Readiness is live shared metadata, not a timer or persisted issue selection.
		this.details.deliver();
		this.receive(cx);
		// Follow the focused folder: live data re-renders us, so compare here.
		const visible = this.isVisible();
		const shown = visible && !this.visible;
		this.visible = visible;
		if (visible && (shown || locationKey() !== this.context)) this.refresh(cx, shown);
		const t = colors();
		const where = location();
		const overlay: string | undefined = props()?.overlay;
		// A gh problem is still said first; otherwise a folder without a GitHub remote is an empty state.
		const noRemote = this.remote === null && !(this.account && !this.account.status.ok);
		// A card like Herdr's Files and Changes panels; a window overlay gets Herdr's own frame instead.
		return (
			v_flex()
				.id("github")
				.size_full()
				.min_h(0)
				.overflow_hidden()
				.bg(t.background)
				.text_color(t.foreground)
				.text_size(13)
				.when(!overlay, (el) => el.rounded(10).border_1().border_color(t.border))
				.child(this.header(overlay, where.cwd ?? "no folder"))
				.when(noRemote, (el) => el.child(this.noRemote(where.cwd)))
				.when(!noRemote, (el) => el.child(this.tabs()).child(this.list()))
				// A fixed sibling of the scrolling list: Herdr already shows the branch, so this says who gh is and how fresh.
				.child(this.statusCard(where.on, where.cwd))
		);
	}

	/** The repository, then ↻ (Herdr's own spinner while anything loads, as its tab bar shows a working agent). */
	private header(overlay: string | undefined, context: string): Element {
		const t = colors();
		const busy = this.loading || GROUPS.some(({ kind }) => this.groups[kind].loading || this.groups[kind].loadingMore);
		const refresh = button("gh-refresh", "↻", "Refresh", (_e, cx) => {
			this.refresh(cx, true);
			cx.notify(); // a click doesn't redraw by itself: show the spinner now, not when it's done
		});
		return h_flex()
			.h(42)
			.flex_none()
			.px(14)
			.gap(8)
			.items_center()
			.border_b(1)
			.border_color(t.border)
			.child(div().font_semibold().tooltip(context).child("GitHub"))
			.child(div().flex_1().min_w(0).truncate().text_right().text_size(12).text_color(t.dim).child(this.repo()))
			.child(busy ? div().size(24).flex_none().flex().items_center().justify_center().child(spinner()) : refresh)
			.when(overlay, (el) => el.child(button("gh-close", "×", "Close", () => closeOverlay(overlay!))));
	}

	/** The gh account on the folder's machine, then how fresh the lists are. What to do about a problem is said in the list. */
	private statusCard(on: string | null, cwd: string | null): Element {
		const t = colors();
		const s = footerStatus(
			{
				account: this.account,
				on,
				checkedAt: this.checkedAt,
				failed: this.failure !== undefined && this.ready() !== null,
				polling: this.ready() !== null,
			},
			Date.now(),
		);
		const tip = `${this.account ? describeAccount(this.account).text : "checking gh…"} · ${cwd ?? "no folder"}`;
		const dot =
			s.tone === "pending"
				? spinner(10)
				: div()
						.size(8)
						.rounded(4)
						.bg(s.tone === "ok" ? t.done : t.blocked);
		return v_flex()
			.id("gh-status")
			.flex_none()
			.px(14)
			.py(8)
			.gap(2)
			.border_t(1)
			.border_color(t.border)
			.bg(t.surface)
			.text_size(12)
			.tooltip(tip)
			.accessibility_label(`${s.account} on ${s.machine}${s.sync ? `. ${s.sync}` : ""}`)
			.child(
				h_flex()
					.gap(8)
					.items_center()
					.child(div().w(10).flex_none().flex().items_center().justify_center().child(dot))
					.child(div().flex_none().max_w(160).truncate().font_medium().child(s.account))
					.child(div().flex_none().text_color(t.dim).child("·"))
					.child(div().flex_1().min_w(0).truncate().text_color(t.dim).child(s.machine)),
			)
			.when(s.sync, (el) =>
				el.child(
					div()
						.pl(18)
						.truncate()
						.text_color(s.tone === "problem" ? t.blocked : t.dim)
						.child(s.sync ?? ""),
				),
			);
	}

	private repo(): string {
		return this.remote ? `${this.remote.owner}/${this.remote.repo}` : "";
	}

	/** No GitHub remote here: nothing is wrong, there is just no repository. Said calmly, in place of the tabs and lists. */
	private noRemote(cwd: string | null): Element {
		const t = colors();
		const empty = noRepository(cwd);
		return v_flex()
			.flex_1()
			.min_h(0)
			.px(28)
			.gap(8)
			.items_center()
			.justify_center()
			.child(svg("mods/github/assets/github.svg").size(28).text_color(t.dim))
			.child(div().pt(4).font_medium().text_color(t.muted).child(empty.title))
			.child(div().text_size(12).text_center().text_color(t.dim).child(empty.detail));
	}

	/** Only Issues in this version; PRs, Actions and notifications join it later. */
	private tabs(): Element {
		const t = colors();
		return h_flex()
			.h(34)
			.flex_none()
			.px(10)
			.gap(4)
			.items_center()
			.border_b(1)
			.border_color(t.border)
			.child(div().px(8).py(3).rounded(6).bg(t.hover).text_size(12).font_medium().child("Issues"));
	}

	/**
	 * The groups, or what stands in their place. A missing repository (404) or Issues turned off is the same for
	 * every group: said once, in the list's place. Any other failure stays in its own group, beside the others' rows.
	 */
	private list(): Element {
		const t = colors();
		const loaded = GROUPS.map(({ kind }) => this.groups[kind]);
		const notice = issuesNotice({
			account: this.account,
			remote: this.remote,
			group: loaded.find((g) => g.page)?.page,
			failure: this.failure ?? loaded.find((g) => g.failure?.notFound)?.failure,
		});
		const problem = (text: string) => div().p(8).text_size(12).text_color(t.blocked).child(text);
		return v_flex()
			.id("gh-list")
			.flex_1()
			.min_h(0)
			.overflow_y_scroll()
			.p(6)
			.gap(4)
			.when(this.openFailure, (el) => el.child(problem(this.openFailure ?? "")))
			.when(notice, (el) => el.child(problem(notice ?? "")))
			.when(!notice && this.ready(), (el) => el.children(GROUPS.map((g) => this.group(g))))
			.when(!notice && !this.ready() && this.loading, (el) => el.child(div().p(8).text_color(t.dim).child("…")));
	}

	/** A foldable group: its title and count, then (unfolded) why it failed, its rows and Load more. */
	private group({ kind, title, empty }: (typeof GROUPS)[number]): Element {
		const t = colors();
		const g = this.groups[kind];
		const page = g.page;
		const heading = h_flex()
			.id(`group-${kind}`)
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
					button(`retry-${kind}`, "Retry", `Load ${title} again`, (_e, cx) => {
						this.load(cx, kind, true);
						cx.notify();
					}),
				),
			);
		const left = (page?.total ?? 0) - (page?.issues.length ?? 0);
		// Load more only while another page follows.
		const more = h_flex()
			.id(`more-${kind}`)
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
					.when(g.failure, (el) => el.child(failure))
					.when(page?.issues.length === 0, (el) =>
						el.child(div().px(8).pl(22).py(4).text_size(12).text_color(t.dim).child(empty)),
					)
					.children((page?.issues ?? []).map((issue) => this.row(kind, issue)))
					.when(page?.more, (el) => el.child(more)),
			);
	}

	/** One issue: click opens its tab; hovering swaps assignees and age for Copy and Open in browser. */
	private row(kind: GroupKind, issue: Issue): Element {
		const t = colors();
		const key = `${kind}#${issue.number}`;
		const hovered = this.hovered === key;
		const repo = this.repo();
		return h_flex()
			.id(`issue-${kind}-${issue.number}`)
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
				this.openFailure = null;
				cx.spawn(async (cx) => {
					try {
						await this.details.open({ repo, number: issue.number });
					} catch (e) {
						this.openFailure = e instanceof Error ? e.message : String(e);
					}
					cx.notify();
				});
			})
			.on_hover((h, cx) => {
				if (h) this.hovered = key;
				else if (this.hovered === key) this.hovered = null;
				cx.notify();
			})
			.child(div().flex_none().text_color(t.dim).child(`#${issue.number}`))
			.child(div().flex_1().min_w(0).truncate().child(issue.title))
			.when(!hovered, (el) =>
				el
					.child(
						div().flex_none().max_w(90).truncate().text_size(12).text_color(t.dim).child(issue.assignees.join(", ")),
					)
					.child(
						div()
							.flex_none()
							.w(28)
							.text_right()
							.text_size(12)
							.text_color(t.dim)
							.child(relativeTime(issue.updatedAt, Date.now())),
					),
			)
			.when(hovered, (el) =>
				el
					.child(
						button(`copy-${kind}-${issue.number}`, "#", `Copy #${issue.number}`, (_e, cx) =>
							cx.write_to_clipboard(`#${issue.number}`),
						),
					)
					.child(button(`open-${kind}-${issue.number}`, "↗", "Open in browser", (_e, cx) => cx.open_url(issue.url))),
			);
	}
}

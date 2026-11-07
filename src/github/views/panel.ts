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
import { isIssueNotice, Notices } from "../io/changes.ts";
import { location, locationKey } from "../io/context.ts";
import { DetailTabs } from "../io/detail-tabs.ts";
import * as gh from "../io/gh.ts";
import { listChanges } from "../io/issues.ts";
import * as known from "../io/known.ts";
import { sidebarVisible } from "../io/visibility.ts";
import { GroupList, type GroupSpec, type Ready } from "./groups.ts";
import { pullList } from "./pulls.ts";
import { button, colors, type Role, spinner, stop } from "./ui.ts";

/** The Issues tab's groups, in order: title, and what an empty one says. */
const GROUPS: GroupSpec<GroupKind>[] = [
	// One word like the others; the empty text says whose.
	{ kind: "assigned", title: "Assigned", empty: "No open issues assigned to you." },
	{ kind: "open", title: "Open", empty: "No open issues." },
	{ kind: "closed", title: "Closed", empty: "No closed issues." },
];

/** The sidebar's tabs, in order: id and label (the VS Code extension's view name for PRs). */
type SidebarTab = "issues" | "prs";
const TABS: { id: SidebarTab; label: string }[] = [
	{ id: "issues", label: "Issues" },
	{ id: "prs", label: "Pull Requests" },
];

export class Panel implements Role {
	/** The place shown (locationKey()), and which refresh is the latest: older ones drop their results. */
	context: string | null = null;
	latest = 0;
	// undefined: not known yet for this place.
	account: gh.Account | undefined;
	remote: RemoteRepo | null | undefined;
	failure: Failure | undefined;
	loading = false;
	/** The tab shown; each keeps its own state (folded groups and pages) while the other is shown. */
	tab: SidebarTab = "issues";
	details = new DetailTabs();
	openFailure: string | null = null;
	/** The Issues tab's groups. Folded groups ask for nothing; which are expanded stays as the place changes. */
	issues = new GroupList<GroupKind, IssueGroup, Issue>({
		id: "issue",
		groups: GROUPS,
		expanded: ["assigned"],
		ready: () => this.ready(),
		run: () => this.latest,
		asking: () => this.isVisible(),
		peek: (kind, r) => known.peekGroup(kind, r.remote, r.login, r.on),
		ask: (kind, r, force) => known.group(kind, r.remote, r.login, r.on, force),
		more: (kind, r, loaded) => known.more(kind, r.remote, r.login, r.on, loaded),
		rows: (page) => page.issues,
		key: (issue) => issue.number,
		open: (cx, issue) => this.openIssue(cx, issue),
		cells: (kind, issue, hovered) => issueCells(kind, issue, hovered),
		// Retry a failed refresh next tick even if the list itself has not changed.
		failed: () => {
			this.etag = null;
		},
	});
	/** The Pull Requests tab's groups; they load only while that tab is shown. */
	pulls = pullList({
		ready: () => this.ready(),
		run: () => this.latest,
		asking: () => this.isVisible(),
		details: this.details,
		openFailed: (message) => {
			this.openFailure = message;
		},
	});
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
	private check(cx: Context, refresh = false, asked = false): void {
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
					if (changed || refresh) this.issues.load(cx, true);
					// PR lists have their own change check later (#34); a refresh asks the shown tab's groups now.
					// Two of them are searches (30 a minute for the whole account, ADR 0006): kept pages under a minute
					// old are reused, and only ↻ asks them all again.
					if (refresh && this.tab === "prs") this.pulls.load(cx, asked);
					// Every finished check redraws: the footer shows a failed check and its recovery.
					cx.notify();
				}
				if (this.checking === checking) this.checking = null;
			}
		});
	}

	/** The gh account's login on the folder's machine and the remote, once both are known and usable. */
	ready(): Ready | null {
		const status = this.account?.status;
		return this.remote && status?.ok && this.account
			? { remote: this.remote, login: status.user, on: this.account.on }
			: null;
	}

	/** Shows what is known about the focused place at once, then asks for what is stale (all of it when `force`, ↻). */
	refresh(cx: Context, force = false, asked = false): void {
		const where = location(),
			run = ++this.latest,
			current = () => run === this.latest,
			context = JSON.stringify(where);
		// Another place has other rows: the pointer is over none of them until it moves.
		if (context !== this.context) {
			this.issues.hovered = this.pulls.hovered = null;
			this.etag = null;
			this.checkedAt = null;
		}
		this.checking = null;
		this.context = context;
		// Never the previous place's facts: this place's known ones, or "…" until they arrive.
		this.account = known.peekAccount(where.on);
		this.remote = known.peekRemote(where);
		this.failure = undefined;
		this.issues.show();
		this.pulls.show();
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
				this.check(cx, true, asked);
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

	/**
	 * An issue closed or reopened in a reader: every kept group of its repository shows it at once,
	 * then the shown expanded groups ask GitHub again (the change made them stale).
	 */
	receive(cx: Context): void {
		const changes = this.notices
			.take()
			.filter(isIssueNotice)
			.flatMap((n) => (n.state ? [n.state] : []));
		if (changes.length === 0) return;
		changes.forEach(known.issueChanged);
		this.issues.show();
		this.issues.load(cx);
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
				.when(!noRemote, (el) => el.child(this.tabs()).child(this.tab === "issues" ? this.list() : this.pullList()))
				// A fixed sibling of the scrolling list: Herdr already shows the branch, so this says who gh is and how fresh.
				.child(this.statusCard(where.on, where.cwd))
		);
	}

	/** The repository, then ↻ (Herdr's own spinner while anything loads, as its tab bar shows a working agent). */
	private header(overlay: string | undefined, context: string): Element {
		const t = colors();
		const busy = this.loading || this.issues.busy || this.pulls.busy;
		const refresh = button("gh-refresh", "↻", "Refresh", (_e, cx) => {
			this.refresh(cx, true, true);
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

	/** Issues and Pull Requests; Actions and notifications join them later. */
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
			.children(
				TABS.map(({ id, label }) =>
					div()
						.id(`gh-tab-${id}`)
						.px(8)
						.py(3)
						.rounded(6)
						.text_size(12)
						.font_medium()
						.cursor_pointer()
						.text_color(this.tab === id ? t.foreground : t.muted)
						.when(this.tab === id, (el) => el.bg(t.hover))
						.when(this.tab !== id, (el) => el.hover((s) => s.bg(t.hover)))
						.accessibility_label(label)
						.on_mouse_down("left", stop)
						.on_click((_e, cx) => {
							this.tab = id;
							// A tab that failed to open was asked from the other list.
							this.openFailure = null;
							if (id === "prs") this.pulls.load(cx);
							cx.notify();
						})
						.child(label),
				),
			);
	}

	/** The Pull Requests tab: gh, a missing repository or another shared problem in the list's place, else the groups. */
	private pullList(): Element {
		const t = colors();
		const notice = issuesNotice({
			account: this.account,
			remote: this.remote,
			failure: this.failure ?? this.pulls.notFound,
		});
		const problem = (text: string) => div().p(8).text_size(12).text_color(t.blocked).child(text);
		return v_flex()
			.id("gh-pulls")
			.flex_1()
			.min_h(0)
			.overflow_y_scroll()
			.p(6)
			.gap(4)
			.when(this.openFailure, (el) => el.child(problem(this.openFailure ?? "")))
			.when(notice, (el) => el.child(problem(notice ?? "")))
			.when(!notice && this.ready(), (el) => el.children(this.pulls.render()))
			.when(!notice && !this.ready() && this.loading, (el) => el.child(div().p(8).text_color(t.dim).child("…")));
	}

	/**
	 * The groups, or what stands in their place. A missing repository (404) or Issues turned off is the same for
	 * every group: said once, in the list's place. Any other failure stays in its own group, beside the others' rows.
	 */
	private list(): Element {
		const t = colors();
		const notice = issuesNotice({
			account: this.account,
			remote: this.remote,
			group: this.issues.anyPage,
			failure: this.failure ?? this.issues.notFound,
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
			.when(!notice && this.ready(), (el) => el.children(this.issues.render()))
			.when(!notice && !this.ready() && this.loading, (el) => el.child(div().p(8).text_color(t.dim).child("…")));
	}

	/** A click on an issue row opens (or selects) its tab. */
	private openIssue(cx: Context, issue: Issue): void {
		this.openFailure = null;
		const repo = this.repo();
		cx.spawn(async (cx) => {
			try {
				await this.details.open({ kind: "issue", repo, number: issue.number });
			} catch (e) {
				this.openFailure = e instanceof Error ? e.message : String(e);
			}
			cx.notify();
		});
	}
}

/** One issue: number and title; assignees and age, which hovering swaps for Copy and Open in browser. */
function issueCells(kind: GroupKind, issue: Issue, hovered: boolean): Element[] {
	const t = colors();
	const start = [
		div().flex_none().text_color(t.dim).child(`#${issue.number}`),
		div().flex_1().min_w(0).truncate().child(issue.title),
	];
	if (hovered)
		return [
			...start,
			button(`copy-${kind}-${issue.number}`, "#", `Copy #${issue.number}`, (_e, cx) =>
				cx.write_to_clipboard(`#${issue.number}`),
			),
			button(`open-${kind}-${issue.number}`, "↗", "Open in browser", (_e, cx) => cx.open_url(issue.url)),
		];
	return [
		...start,
		div().flex_none().max_w(90).truncate().text_size(12).text_color(t.dim).child(issue.assignees.join(", ")),
		div()
			.flex_none()
			.w(28)
			.text_right()
			.text_size(12)
			.text_color(t.dim)
			.child(relativeTime(issue.updatedAt, Date.now())),
	];
}

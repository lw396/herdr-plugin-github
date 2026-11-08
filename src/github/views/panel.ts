// The panel role (the sidebar): the current repository's Issues and Pull Requests.

import { h_flex, v_flex } from "gpui-base";
import { type AsyncContext, type Context, div, type Element, svg } from "gpui-kit";
import { closeOverlay, props } from "herdr";
import { type Account, describeAccount } from "../core/account.ts";
import type { DetailRef } from "../core/detail.ts";
import type { Change, Failure } from "../core/gh.ts";
import { ConditionalPoll } from "../core/polling.ts";
import type { RemoteRepo } from "../core/remote.ts";
import { footerStatus, listNotice, noRepository, POLL_SECONDS } from "../core/sidebar.ts";
import { Notices } from "../io/changes.ts";
import { location, sidebarVisible } from "../io/context.ts";
import { DetailTabs } from "../io/detail-tabs.ts";
import * as gh from "../io/gh.ts";
import { listChanges } from "../io/issues.ts";
import * as known from "../io/known.ts";
import type { ListHost } from "./groups.ts";
import { issueList } from "./issues.ts";
import { pullList } from "./pulls.ts";
import { button, colors, type Role, spinner, stop } from "./ui.ts";

/** The sidebar's tabs, in order: id and label (the VS Code extension's view name for PRs). */
type SidebarTab = "issues" | "prs";
const TABS: { id: SidebarTab; label: string }[] = [
	{ id: "issues", label: "Issues" },
	{ id: "prs", label: "Pull Requests" },
];

/** Why the place is asked again: focus moved to another, the sidebar was shown, or ↻ was pressed. */
type Refresh = "moved" | "shown" | "asked";

export class Panel implements Role {
	/** The place shown (the focused folder and its machine), and which refresh is the latest: older ones drop their results. */
	private context: string | null = null;
	private latest = 0;
	// undefined: not known yet for this place.
	private account: Account | undefined;
	private remote: RemoteRepo | null | undefined;
	/** The place could not be read (its git remote): said in the list's place. */
	private failure: Failure | undefined;
	/** The last list-change check failed: said in the footer, while the rows already shown stay. */
	private checkFailed = false;
	private loading = false;
	/** The tab shown; each keeps its own state (folded groups and pages) while the other is shown. */
	private tab: SidebarTab = "issues";
	private details = new DetailTabs();
	private openFailure: string | null = null;
	private notices = new Notices();
	/** The repository's issue list, checked for changes while the sidebar is shown. */
	private poll = new ConditionalPoll();
	/** When this place's lists were last confirmed fresh, for the footer. */
	private checkedAt: number | null = null;
	private host: ListHost = {
		ready: () => this.ready(),
		run: () => this.latest,
		asking: () => this.isVisible(),
		open: (cx, ref, file) => this.open(cx, ref, file),
	};
	/** Folded groups ask for nothing; which are expanded stays as the place changes. */
	private issues = issueList(this.host, () => this.poll.invalidate());
	/** They load only while their tab is shown. */
	private pulls = pullList(this.host);

	init(cx: AsyncContext): void {
		cx.timer.every(POLL_SECONDS * 1000, (cx) => {
			if (!this.isVisible()) {
				this.poll.sync(this.context, false);
				return;
			}
			if (!this.loading) {
				this.check(cx);
				// Local git branches can change without changing GitHub's list validator.
				if (this.tab === "prs" && !this.pulls.busy) this.pulls.load(cx, false, ["local"]);
			}
		});
	}

	private isVisible(): boolean {
		return Boolean(props()?.overlay) || sidebarVisible();
	}

	/** Only a changed list re-asks expanded groups; a refresh asks them even on 304. */
	private check(cx: Context, refresh?: Refresh): void {
		const r = this.ready(),
			run = this.latest;
		const request = r && this.poll.begin(refresh !== undefined);
		if (!r || !request) return;
		cx.spawn(async (cx) => {
			const current = () => run === this.latest && this.poll.current(request);
			let change: Change | undefined;
			try {
				change = await listChanges(`${r.remote.owner}/${r.remote.repo}`, request.etag, r.on);
				if (!current()) return;
				this.checkedAt = Date.now();
				this.checkFailed = false;
			} catch {
				if (current()) this.checkFailed = true;
			} finally {
				if (current()) {
					if (change?.changed || refresh) this.issues.load(cx, true);
					// PR lists have their own change check later (#34); a refresh asks the shown tab's groups now.
					// Two of them are searches (30 a minute for the whole account, ADR 0006): kept pages under a minute
					// old are reused, and only ↻ asks them all again.
					if (refresh && this.tab === "prs") this.pulls.load(cx, refresh === "asked");
					// Every finished check redraws: the footer shows a failed check and its recovery.
					cx.notify();
				}
				this.poll.finish(request, change);
			}
		});
	}

	/** The gh account's login on the folder's machine and the remote, once both are known and usable. */
	private ready(): known.Ready | null {
		const status = this.account?.status;
		return this.remote && status?.ok && this.account
			? { remote: this.remote, login: status.user, on: this.account.on, cwd: location().cwd }
			: null;
	}

	/** Shows what is known about the focused place at once, then asks for what is stale (all of it unless it only moved). */
	private refresh(cx: Context, why: Refresh): void {
		const where = location(),
			run = ++this.latest,
			current = () => run === this.latest,
			context = JSON.stringify(where),
			force = why !== "moved";
		// Another place has other rows: the pointer is over none of them until it moves.
		if (context !== this.context) {
			this.issues.hovered = this.pulls.hovered = null;
			this.checkedAt = null;
		}
		this.context = context;
		this.poll.sync(context, true);
		// Never the previous place's facts: this place's known ones, or "…" until they arrive.
		this.account = known.peekAccount(where.on);
		this.remote = known.peekRemote(where);
		this.failure = undefined;
		this.checkFailed = false;
		this.issues.show();
		this.pulls.show();
		this.loading = true;
		cx.spawn(async (cx) => {
			try {
				// account() never rejects: show its status even when git fails there.
				const [, remote] = await Promise.all([
					known.account(where.on, force).then((a) => {
						if (current()) this.account = a;
					}),
					known.remote(where, force),
				]);
				if (!current()) return;
				this.remote = remote;
				this.check(cx, why);
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
	private receive(cx: Context): void {
		const notices = this.notices.take();
		const ready = this.ready();
		let shownPullsChanged = false;
		for (const n of notices) {
			// A merge changes every account's lists; a submitted review only what that machine's account sees.
			if (!n.pull && !n.review) continue;
			const on = n.pull ? undefined : n.review?.on;
			known.pullsChanged(n.repo, on);
			shownPullsChanged ||=
				ready !== null &&
				(on === undefined || on === ready.on) &&
				n.repo.toLowerCase() === `${ready.remote.owner}/${ready.remote.repo}`.toLowerCase();
		}
		if (shownPullsChanged && this.isVisible() && this.tab === "prs") this.pulls.load(cx, true);
		const changes = notices.flatMap((n) => (n.state ? [n.state] : []));
		if (changes.length === 0) return;
		changes.forEach(known.issueChanged);
		this.issues.show();
		this.issues.load(cx);
	}

	private open(cx: Context, ref: DetailRef, file?: string): void {
		this.openFailure = null;
		cx.spawn(async (cx) => {
			try {
				await this.details.open(ref, file);
			} catch (e) {
				this.openFailure = e instanceof Error ? e.message : String(e);
			}
			cx.notify();
		});
	}

	render(cx: Context): Element {
		// Readiness is live shared metadata, not a timer or persisted issue selection.
		this.details.deliver();
		this.receive(cx);
		// Follow the focused folder: live data re-renders us, so compare here.
		const where = location();
		const visible = this.isVisible();
		if (!visible) this.poll.sync(this.context, false);
		else if (!this.poll.shown) this.refresh(cx, "shown");
		else if (JSON.stringify(where) !== this.context) this.refresh(cx, "moved");
		const t = colors();
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
				.when(!noRemote, (el) => el.child(this.tabs()).child(this.list(cx)))
				// A fixed sibling of the scrolling list: Herdr already shows the branch, so this says who gh is and how fresh.
				.child(this.statusCard(where.on, where.cwd))
		);
	}

	/** The repository, then ↻ (Herdr's own spinner while anything loads, as its tab bar shows a working agent). */
	private header(overlay: string | undefined, context: string): Element {
		const t = colors();
		const busy = this.loading || this.issues.busy || this.pulls.busy;
		const refresh = button("gh-refresh", "↻", "Refresh", (_e, cx) => {
			this.refresh(cx, "asked");
			cx.notify(); // a click doesn't redraw by itself: show the spinner now, not when it's done
		});
		const repo = this.remote ? `${this.remote.owner}/${this.remote.repo}` : "";
		return h_flex()
			.h(42)
			.flex_none()
			.px(14)
			.gap(8)
			.items_center()
			.border_b(1)
			.border_color(t.border)
			.child(div().font_semibold().tooltip(context).child("GitHub"))
			.child(div().flex_1().min_w(0).truncate().text_right().text_size(12).text_color(t.dim).child(repo))
			.child(busy ? div().size(24).flex_none().flex().items_center().justify_center().child(spinner()) : refresh)
			.when(overlay !== undefined, (el) => el.child(button("gh-close", "×", "Close", () => closeOverlay(overlay!))));
	}

	/** The gh account on the folder's machine, then how fresh the lists are. What to do about a problem is said in the list. */
	private statusCard(on: string | null, cwd: string | null): Element {
		const t = colors();
		const s = footerStatus(
			{
				account: this.account,
				on,
				checkedAt: this.checkedAt,
				failed: this.checkFailed && this.ready() !== null,
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
			.when(s.sync !== null, (el) =>
				el.child(
					div()
						.pl(18)
						.truncate()
						.text_color(s.tone === "problem" ? t.blocked : t.dim)
						.child(s.sync ?? ""),
				),
			);
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

	/**
	 * The shown tab's groups, or what stands in their place. A missing repository (404), gh or Issues turned off is
	 * the same for every group: said once, in the list's place. Any other failure stays in its own group.
	 */
	private list(cx: Context): Element {
		const t = colors();
		const list = this.tab === "issues" ? this.issues : this.pulls;
		const notice = listNotice({
			account: this.account,
			remote: this.remote,
			issuesEnabled: this.tab === "issues" ? this.issues.anyPage?.issuesEnabled : undefined,
			failure: this.failure ?? list.notFound,
		});
		const problem = (text: string) => div().p(8).text_size(12).text_color(t.blocked).child(text);
		return v_flex()
			.id(`gh-list-${this.tab}`)
			.flex_1()
			.min_h(0)
			.overflow_y_scroll()
			.p(6)
			.gap(4)
			.when(this.openFailure !== null, (el) => el.child(problem(this.openFailure ?? "")))
			.when(notice !== null, (el) => el.child(problem(notice ?? "")))
			.when(!notice && this.ready() !== null, (el) => el.children(list.render(cx)))
			.when(!notice && !this.ready() && this.loading, (el) => el.child(div().p(8).text_color(t.dim).child("…")));
	}
}

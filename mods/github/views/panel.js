// The panel role (the sidebar): the current repository's lists, starting with Issues.
import { div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { props, closeOverlay } from "herdr";
import { location, locationKey } from "../io/context.js";
import * as gh from "../io/gh.js";
import * as known from "../io/known.js";
import { describeAccount } from "../core/account.js";
import { issuesNotice, noRepository } from "../core/issues.js";
import { relativeTime } from "../core/time.js";
import { explain } from "../core/gh-args.js";
import { colors, stop, button } from "./ui.js";
import { DetailTabs } from "../io/detail-tabs.js";
/** The Issues tab's groups, in order: title, and what an empty one says. */
const GROUPS = [
    // One word like the others; the empty text says whose.
    { kind: "assigned", title: "Assigned", empty: "No open issues assigned to you." },
    { kind: "open", title: "Open", empty: "No open issues." },
    { kind: "closed", title: "Closed", empty: "No closed issues." },
];
/** A failed ask, in the sidebar's words (a dropped connection reads as such, not as gh's `Post "…": EOF`). */
function failureOf(e) {
    if (e instanceof gh.GhError)
        return { notFound: e.notFound, message: explain(e.message) };
    return { notFound: false, message: e instanceof Error ? e.message : String(e) };
}
export class Panel {
    /** The place shown (locationKey()), and which refresh is the latest: older ones drop their results. */
    context = null;
    latest = 0;
    // undefined: not known yet for this place.
    account;
    remote;
    failure;
    loading = false;
    /** Folded groups ask for nothing; which are expanded stays as the place changes. */
    groups = {
        assigned: { expanded: true, page: undefined, loading: false, loadingMore: false, failure: undefined },
        open: { expanded: false, page: undefined, loading: false, loadingMore: false, failure: undefined },
        closed: { expanded: false, page: undefined, loading: false, loadingMore: false, failure: undefined },
    };
    /** The row under the pointer ("<kind>#<number>"): it shows its actions. */
    hovered = null;
    details = new DetailTabs();
    openFailure = null;
    init(cx) {
        this.refresh(cx);
    }
    /** The gh account's login on the folder's machine and the remote, once both are known and usable. */
    ready() {
        const status = this.account?.status;
        return this.remote && status?.ok && this.account ? { remote: this.remote, login: status.user, on: this.account.on } : null;
    }
    /** Shows what is known about the focused place at once, then asks for what is stale (all of it when `force`, ↻). */
    refresh(cx, force = false) {
        const where = location(), run = ++this.latest, current = () => run === this.latest, context = JSON.stringify(where);
        // Another place has other rows: the pointer is over none of them until it moves.
        if (context !== this.context)
            this.hovered = null;
        this.context = context;
        // Never the previous place's facts: this place's known ones, or "…" until they arrive.
        this.account = known.peekAccount(where.on);
        this.remote = known.peekRemote(where);
        this.failure = undefined;
        for (const { kind } of GROUPS)
            this.show(kind);
        this.loading = true;
        cx.spawn(async (cx) => {
            try {
                // git and gh both where the folder is (ADR 0003). account() never rejects: show its
                // status even when git fails there.
                const [, remote] = await Promise.all([
                    known.account(where.on, force).then((a) => {
                        if (current())
                            this.account = a;
                    }),
                    known.remote(where, force),
                ]);
                if (!current())
                    return;
                this.remote = remote;
                for (const { kind } of GROUPS)
                    if (this.groups[kind].expanded)
                        this.load(cx, kind, force);
            }
            catch (e) {
                if (current())
                    this.failure = failureOf(e);
            }
            finally {
                if (current()) {
                    this.loading = false;
                    cx.notify();
                }
            }
        });
    }
    /** The group's kept pages for this place, or nothing yet. */
    show(kind) {
        const g = this.groups[kind], r = this.ready();
        g.page = r ? known.peekGroup(kind, r.remote, r.login, r.on) : undefined;
        g.failure = undefined;
        g.loading = g.loadingMore = false;
    }
    /** Asks for the group's first page (an expanded group only). */
    load(cx, kind, force = false) {
        const g = this.groups[kind], r = this.ready(), run = this.latest;
        if (!r || !g.expanded)
            return;
        g.loading = true;
        g.failure = undefined;
        cx.spawn(async (cx) => {
            try {
                const page = await known.group(kind, r.remote, r.login, r.on, force);
                if (run === this.latest)
                    g.page = page;
            }
            catch (e) {
                if (run === this.latest)
                    g.failure = failureOf(e);
            }
            finally {
                if (run === this.latest) {
                    g.loading = false;
                    cx.notify();
                }
            }
        });
    }
    /** Folds or unfolds a group; unfolding shows what is kept and asks for what is stale. */
    toggle(cx, kind) {
        const g = this.groups[kind];
        g.expanded = !g.expanded;
        if (g.expanded) {
            this.show(kind);
            this.load(cx, kind);
        }
        cx.notify();
    }
    /** Load more: the next 30 rows of the group. */
    more(cx, kind) {
        const g = this.groups[kind], r = this.ready(), run = this.latest, loaded = g.page;
        if (!r || !loaded?.more || g.loadingMore)
            return;
        g.loadingMore = true;
        cx.notify();
        cx.spawn(async (cx) => {
            try {
                const page = await known.more(kind, r.remote, r.login, r.on, loaded);
                if (run === this.latest)
                    g.page = page;
            }
            catch (e) {
                if (run === this.latest)
                    g.failure = failureOf(e);
            }
            finally {
                if (run === this.latest) {
                    g.loadingMore = false;
                    cx.notify();
                }
            }
        });
    }
    render(cx) {
        // Readiness is live shared metadata, not a timer or persisted issue selection.
        this.details.deliver();
        // Follow the focused folder: live data re-renders us, so compare here.
        if (locationKey() !== this.context)
            this.refresh(cx);
        const t = colors(), where = location(), overlay = props()?.overlay;
        const spinner = () => svg("mods/workspace-chrome/spinner.svg").size(12).flex_none().text_color(t.dim).spin(900);
        const repo = this.remote ? `${this.remote.owner}/${this.remote.repo}` : "";
        // A missing repository (404) or Issues turned off is the same for every group: said once, in
        // the list's place. Any other failure stays in its own group, beside the others' rows.
        const loaded = GROUPS.map(({ kind }) => this.groups[kind]);
        const notice = issuesNotice({
            account: this.account,
            remote: this.remote,
            group: loaded.find((g) => g.page)?.page,
            failure: this.failure ?? loaded.find((g) => g.failure?.notFound)?.failure,
        });
        const busy = this.loading || loaded.some((g) => g.loading || g.loadingMore);
        // A gh problem is still said first; otherwise a folder without a GitHub remote is an empty state.
        const noRemote = this.remote === null && !(this.account && !this.account.status.ok);
        const empty = noRepository(where.cwd);
        const row = (kind, issue) => {
            const key = `${kind}#${issue.number}`, hovered = this.hovered === key;
            return h_flex().id(`issue-${kind}-${issue.number}`).h(28).px(8).pl(22).gap(8).items_center().rounded(6).cursor_pointer().hover((s) => s.bg(t.hover))
                .on_mouse_down("left", stop).on_click((_e, cx) => {
                this.openFailure = null;
                cx.spawn(async (cx) => {
                    try {
                        await this.details.open({ repo, number: issue.number });
                    }
                    catch (e) {
                        this.openFailure = e instanceof Error ? e.message : String(e);
                    }
                    cx.notify();
                });
            })
                .on_hover((h, cx) => {
                if (h)
                    this.hovered = key;
                else if (this.hovered === key)
                    this.hovered = null;
                cx.notify();
            })
                .child(div().flex_none().text_color(t.dim).child(`#${issue.number}`))
                .child(div().flex_1().min_w(0).truncate().child(issue.title))
                .when(!hovered, (el) => el
                .child(div().flex_none().max_w(90).truncate().text_size(12).text_color(t.dim).child(issue.assignees.join(", ")))
                .child(div().flex_none().w(28).text_right().text_size(12).text_color(t.dim).child(relativeTime(issue.updatedAt, Date.now()))))
                .when(hovered, (el) => el
                .child(button(`copy-${kind}-${issue.number}`, "#", `Copy #${issue.number}`, (_e, cx) => cx.write_to_clipboard(`#${issue.number}`)))
                .child(button(`open-${kind}-${issue.number}`, "↗", "Open in browser", (_e, cx) => cx.open_url(issue.url))));
        };
        const group = ({ kind, title, empty }) => {
            const g = this.groups[kind], page = g.page;
            return v_flex().gap(1)
                .child(h_flex().id(`group-${kind}`).h(26).px(8).gap(6).items_center().rounded(6).text_size(12).text_color(t.dim).cursor_pointer()
                .hover((s) => s.bg(t.hover)).on_mouse_down("left", stop).on_click((_e, cx) => this.toggle(cx, kind))
                .accessibility_label(`${g.expanded ? "Fold" : "Unfold"} ${title}`)
                .child(div().w(10).flex_none().child(g.expanded ? "▾" : "▸"))
                .child(div().font_medium().child(title))
                .child(div().child(page ? String(page.total) : ""))
                .when(g.expanded && g.loading, (el) => el.child(spinner())))
                .when(g.expanded, (el) => el
                // A group that failed says why, quietly, with a way to ask again; the other groups stay.
                .when(Boolean(g.failure), (el) => el.child(h_flex().px(8).pl(22).py(2).gap(6).items_center().text_size(12)
                .child(div().flex_none().size(6).rounded(3).bg(t.blocked))
                .child(div().flex_1().min_w(0).text_color(t.dim).child(g.failure?.message ?? ""))
                .when(!g.loading, (el) => el.child(button(`retry-${kind}`, "Retry", `Load ${title} again`, (_e, cx) => {
                this.load(cx, kind, true);
                cx.notify();
            })))))
                .when(Boolean(page && page.issues.length === 0), (el) => el.child(div().px(8).pl(22).py(4).text_size(12).text_color(t.dim).child(empty)))
                .children((page?.issues ?? []).map((issue) => row(kind, issue)))
                // Load more only while another page follows.
                .when(Boolean(page?.more), (el) => el.child(h_flex().id(`more-${kind}`).h(26).px(8).pl(22).gap(6).items_center().rounded(6)
                .text_size(12).text_color(t.dim).cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
                .on_mouse_down("left", stop).on_click((_e, cx) => this.more(cx, kind))
                .child(g.loadingMore ? "Loading…" : `Load more (${(page?.total ?? 0) - (page?.issues.length ?? 0)} left)`)
                .when(g.loadingMore, (el) => el.child(spinner())))));
        };
        // What the sidebar says about gh: who is signed in where, or what to do on which machine.
        const ghLine = this.account ? describeAccount(this.account) : null;
        // A card like Herdr's Files and Changes panels; a window overlay gets Herdr's own frame instead.
        return v_flex().id("github").size_full().min_h(0).overflow_hidden().bg(t.background).text_color(t.foreground).text_size(13)
            .when(!overlay, (el) => el.rounded(10).border_1().border_color(t.border))
            .child(h_flex().h(42).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.border)
            .child(div().font_semibold().child("GitHub"))
            .child(div().flex_1().min_w(0).truncate().text_right().text_size(12).text_color(t.dim).child(repo))
            // While loading, Herdr's own spinner (as its tab bar shows a working agent); ↻ otherwise.
            .when(busy, (el) => el.child(div().size(24).flex_none().flex().items_center().justify_center().child(spinner())))
            .when(!busy, (el) => el.child(button("gh-refresh", "↻", "Refresh", (_e, cx) => {
            this.refresh(cx, true);
            cx.notify(); // a click doesn't redraw by itself: show the spinner now, not when it's done
        })))
            .when(Boolean(overlay), (el) => el.child(button("gh-close", "×", "Close", () => closeOverlay(overlay)))))
            // No GitHub remote here: nothing is wrong, there is just no repository. Say so calmly, in
            // place of the tabs and lists.
            .when(noRemote, (el) => el.child(v_flex().flex_1().min_h(0).px(28).gap(8).items_center().justify_center()
            .child(svg("mods/github/assets/github.svg").size(28).text_color(t.dim))
            .child(div().pt(4).font_medium().text_color(t.muted).child(empty.title))
            .child(div().text_size(12).text_center().text_color(t.dim).child(empty.detail))))
            // Tabs: only Issues in this version; PRs, Actions and notifications join it later.
            .when(!noRemote, (el) => el.child(h_flex().h(34).flex_none().px(10).gap(4).items_center().border_b(1).border_color(t.border)
            .child(div().px(8).py(3).rounded(6).bg(t.hover).text_size(12).font_medium().child("Issues"))))
            .when(!noRemote, (el) => el.child(v_flex().id("gh-list").flex_1().min_h(0).overflow_y_scroll().p(6).gap(4)
            .when(Boolean(this.openFailure), el => el.child(div().p(8).text_size(12).text_color(t.blocked).child(this.openFailure ?? "")))
            .when(Boolean(notice), (el) => el.child(div().p(8).text_size(12).text_color(t.blocked).child(notice ?? "")))
            .when(!notice && Boolean(this.ready()), (el) => el.children(GROUPS.map(group)))
            .when(!notice && !this.ready() && this.loading, (el) => el.child(div().p(8).text_color(t.dim).child("…")))))
            // Which gh and folder this is (ADR 0003), until the branch card (#18) takes the bottom.
            .child(div().flex_none().px(14).py(8).border_t(1).border_color(t.border).text_size(11).text_color(t.dim).truncate()
            .child(`${ghLine?.text ?? "checking gh…"} · ${where.cwd ?? "no folder"}`));
    }
}

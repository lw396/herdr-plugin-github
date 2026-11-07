// One issue at a time in one native Herdr tab; links to its repository's issues open here, with Back.
// The issue and its Back history are not restored after restart. Comments, close and reopen are
// announced to the other views (io/changes.ts); this one applies its own writes the same way.

import { h_flex, Textarea, TextareaState, TextView, v_flex } from "gpui-base";
import { type AsyncContext, type Context, div, type Element, svg } from "gpui-kit";
import { nextCommand, props } from "herdr";
import { describeAccount } from "../core/account.ts";
import { type Activity, activityText, issueTimeline } from "../core/activity.ts";
import type { Change } from "../core/conditional.ts";
import { transient } from "../core/gh-args.ts";
import { type Comment, type IssueDetail, type IssueRef, issueKey, type Label } from "../core/issue-detail.ts";
import { IssuePolling } from "../core/issue-polling.ts";
import { browserUrl, issueLink } from "../core/markdown.ts";
import type { Projects } from "../core/projects.ts";
import { relativeTime } from "../core/time.ts";
import { announce, type IssueNotice, Notices } from "../io/changes.ts";
import { detailLocation, issueCommand, navigatedDetail, readyDetail } from "../io/detail-tabs.ts";
import * as gh from "../io/gh.ts";
import { addComment, issueChanges, readIssue, readIssueProjects, setIssueState } from "../io/issues.ts";
import { button, chip, colors, link, type Role, spinner, square, stop } from "./ui.ts";

interface Loaded {
	key: string;
	issue?: IssueDetail;
	failure?: string;
	loading: boolean;
	/** The machine whose gh read the issue: writes go through the same one. */
	on?: string | null;
	projects?: Projects;
	projectsLoading: boolean;
}

/** What a timeline card shows: the issue's description or a comment. */
type Post = Pick<Comment, "author" | "createdAt" | "markdown"> & { reactions?: Comment["reactions"] };

/** A composer button: enabled or not, and the one primary action. */
interface Action {
	id: string;
	label: string;
	tip: string;
	enabled: boolean;
	primary: boolean;
}

export class Issue implements Role {
	reader = "";
	ref: IssueRef | null = null;
	/** Issues this tab showed before following links, most recent last. */
	history: IssueRef[] = [];
	entry: Loaded | null = null;
	wide = false;
	notices = new Notices();
	/** The new comment being written; kept when posting fails, and through refreshes. */
	box: TextareaState | null = null;
	draft = "";
	/** Unsent comments of the issues Back can return to. */
	drafts = new Map<string, string>();
	writing: "comment" | "state" | null = null;
	writeFailure: string | null = null;
	polling = new IssuePolling();

	init(cx: AsyncContext): void {
		this.reader = typeof props()?.reader === "string" ? props().reader : "";
		const box = TextareaState.new({ placeholder: "Leave a comment (Markdown)" });
		box.set_auto_grow(3, 12);
		box.on("change", (_e, cx) => {
			this.draft = box.value();
			cx.notify();
		});
		// Enter is a new line; ⌘/Ctrl+Enter posts.
		box.on("submit", (e, cx) => {
			if (e.secondary) this.comment(cx);
		});
		this.box = box;
		cx.timer.every(10_000, (cx) => {
			const shown = this.syncPolling();
			if (!this.writing) this.load(cx, shown);
		});
		// Waiting is a read: init neither opens tabs nor writes shared state.
		cx.spawn(async (cx) => {
			for (;;) {
				const ref = issueCommand(await nextCommand(), this.reader);
				if (!ref) continue;
				if (!this.ref || issueKey(this.ref) !== issueKey(ref)) {
					// The sidebar opens an issue afresh: Back belongs to links followed in this tab.
					this.history = [];
					this.ref = ref;
					this.load(cx);
				}
				cx.notify();
			}
		});
	}

	/** Follow a link: Back returns to the issue shown now. */
	follow(cx: Context, ref: IssueRef): void {
		if (this.ref) this.history.push(this.ref);
		this.show(cx, ref);
	}

	goBack(cx: Context): void {
		const ref = this.history.pop();
		if (ref) this.show(cx, ref);
	}

	/** The tab now shows, and is named after, that issue. */
	private show(cx: Context, ref: IssueRef): void {
		// Each issue keeps its own unsent comment: Back brings it back, and it is never posted elsewhere.
		if (this.ref) this.drafts.set(issueKey(this.ref), this.draft);
		this.draft = this.drafts.get(issueKey(ref)) ?? "";
		this.drafts.delete(issueKey(ref));
		this.box?.set_value(this.draft);
		this.ref = ref;
		this.writeFailure = null;
		navigatedDetail(this.reader, ref);
		this.load(cx);
		cx.notify();
	}

	/** Visibility is the reader's own native tab, not keyboard focus or the sidebar's repository. */
	private syncPolling(): boolean {
		const place = detailLocation(this.reader);
		const key = this.ref && place ? `${place.on ?? ""}\n${place.pane}\n${issueKey(this.ref)}` : null;
		return this.polling.sync(key, Boolean(place?.visible));
	}

	/** A forced refresh reloads even on 304; normal ticks leave unchanged discussions alone. Never touches the draft. */
	load(cx: Context, force = true): void {
		const ref = this.ref;
		const place = detailLocation(this.reader);
		this.syncPolling();
		const request = this.polling.begin(force);
		if (!ref || !place || !request) return;
		const key = issueKey(ref);
		const previous = this.entry?.key === key ? this.entry : null;
		let entry: Loaded =
			!force && previous && previous.on === place.on
				? previous
				: {
						key,
						issue: previous?.issue,
						on: previous?.on === place.on ? previous.on : undefined,
						failure: previous?.failure,
						projects: previous?.projects,
						loading: force,
						projectsLoading: false,
					};
		this.entry = entry;
		cx.spawn(async (cx) => {
			const current = () =>
				this.entry === entry && this.polling.current(request) && detailLocation(this.reader)?.visible;
			let completed: Change | undefined;
			try {
				let on = entry.on;
				if (on === undefined) {
					const account = await gh.account(place.on);
					if (!account.status.ok) throw new Error(describeAccount(account).text);
					on = account.on;
				}
				if (!current()) return;
				const change = await issueChanges(ref.repo, ref.number, request.etag, on);
				if (!current()) return;
				if (this.polling.reload(request, change)) {
					if (!force) {
						// A 304 keeps the entry (including slow Projects); a reload replaces it so old metadata cannot win.
						entry = { ...entry, projectsLoading: false };
						this.entry = entry;
					}
					const issue = await readIssue(ref.repo, ref.number, on);
					if (!current()) return;
					entry.issue = issue;
					entry.on = on;
					entry.projectsLoading = true;
					// Optional Projects load on their own, only after an actual discussion reload.
					cx.spawn(async (cx) => {
						const projects = await readIssueProjects(ref.repo, ref.number, on);
						if (this.entry !== entry) return;
						entry.projects = projects;
						entry.projectsLoading = false;
						cx.notify();
					});
				}
				completed = change;
				entry.failure = undefined;
			} catch (e) {
				if (!current()) return;
				const failure = gh.failureOf(e);
				entry.failure = failure.notFound
					? `${ref.repo} #${ref.number} isn't on GitHub, or this account can't see it.`
					: failure.message;
			} finally {
				if (!detailLocation(this.reader)?.visible) this.syncPolling();
				const result = this.polling.finish(request, completed);
				if (this.entry === entry) entry.loading = false;
				if (result.accepted && result.notify) cx.notify();
			}
		});
	}

	/** Posts the comment box's text; the box is emptied once GitHub has it. */
	comment(cx: Context): void {
		const body = this.draft;
		this.write(cx, "comment", body.trim() !== "", async (repo, number, on) => {
			const comment = await addComment(repo, number, body, on);
			this.publish({ repo, number, comment });
			// Empty the box only if it still holds what was sent, on the issue it was sent to.
			const sentKey = issueKey({ repo, number });
			if (this.ref && issueKey(this.ref) === sentKey && this.draft === body) {
				this.draft = "";
				this.box?.set_value("");
			} else if (this.drafts.get(sentKey) === body) this.drafts.delete(sentKey);
		});
	}

	setState(cx: Context, state: "open" | "closed"): void {
		this.write(cx, "state", true, async (repo, number, on) => {
			this.publish({ repo, number, state: await setIssueState(repo, number, state, on) });
		});
	}

	/** Shows this view's own write at once, then tells the other views. */
	private publish(notice: IssueNotice): void {
		this.apply(notice);
		announce(notice);
	}

	/** One write at a time, through the gh that read the issue; a failure is said with gh's words. */
	private write(
		cx: Context,
		kind: "comment" | "state",
		ready: boolean,
		act: (repo: string, number: number, on: string | null) => Promise<void>,
	): void {
		const ref = this.ref;
		const entry = this.entry;
		if (!ref || !entry?.issue || entry.on === undefined || this.writing || !ready) return;
		const on = entry.on;
		this.writing = kind;
		this.writeFailure = null;
		cx.notify();
		cx.spawn(async (cx) => {
			try {
				await act(ref.repo, ref.number, on);
			} catch (e) {
				this.writeFailure = gh.failureOf(e).message;
				// A dropped connection may still have reached GitHub: show what it has, so nothing is sent twice.
				if (e instanceof gh.GhError && transient(e.stderr) && this.entry === entry) this.load(cx);
			} finally {
				this.writing = null;
				cx.notify();
			}
		});
	}

	/** A write to the shown issue: a new comment joins the timeline (once), a new state shows. */
	private apply(notice: IssueNotice): void {
		const issue = this.entry?.issue;
		const comment = notice.comment;
		if (!issue || !this.ref || issueKey(notice) !== issueKey(this.ref)) return;
		this.polling.invalidate();
		if (this.entry) this.entry.loading = false;
		if (comment && !issue.comments.some((c) => c.id === comment.id)) issue.comments = [...issue.comments, comment];
		if (notice.state) issue.state = notice.state.state;
	}

	/** A link in a post: an issue of this repository opens here; any other web link, in the browser. */
	private openLink(cx: Context, url: string, issue: IssueDetail): void {
		const linked = issueLink(url, issue.url);
		if (!linked) {
			const external = browserUrl(url, issue.url);
			if (external) cx.open_url(external);
			// A link to the shown issue itself (e.g. one of its comments) has nothing new to show.
		} else if (this.ref && issueKey(linked) !== issueKey(this.ref)) this.follow(cx, linked);
	}

	render(cx: Context): Element {
		if (this.reader) readyDetail(this.reader);
		// Writes announced by other views (shared metadata re-renders this one).
		for (const notice of this.notices.take()) this.apply(notice);
		if (this.syncPolling()) this.load(cx);
		const t = colors();
		const root = v_flex()
			.id("issue-reader")
			.size_full()
			.min_h(0)
			.overflow_hidden()
			.bg(t.background)
			.text_color(t.foreground)
			.text_size(14)
			.on_size_change((size, cx) => {
				const wide = size.width >= 820;
				if (wide !== this.wide) {
					this.wide = wide;
					cx.notify();
				}
			});
		const ref = this.ref;
		if (!ref) return root.child(this.empty());
		return root.child(this.header(ref)).child(this.body(ref));
	}

	/** No issue yet: this tab was restored after a restart, or its issue hasn't arrived. */
	private empty(): Element {
		const t = colors();
		const hint = "Choose an issue in the GitHub sidebar. Issue details are not restored after restarting Herdr.";
		return v_flex()
			.flex_1()
			.gap(8)
			.items_center()
			.justify_center()
			.p(24)
			.child(div().font_semibold().child("Issue details"))
			.child(div().text_size(13).text_color(t.dim).text_center().child(hint));
	}

	/** Back, the title with its number (opens the browser) and copy, and refresh. */
	private header(ref: IssueRef): Element {
		const t = colors();
		const entry = this.entry;
		const url = entry?.issue?.url ?? `https://github.com/${ref.repo}/issues/${ref.number}`;
		const number = link("issue-browser", url, `#${ref.number}`)
			.px(2)
			.rounded(4)
			.text_color(t.accent)
			.hover((s) => s.bg(t.hover))
			.tooltip(`Open ${ref.repo} #${ref.number} in browser`)
			.accessibility_label(`Open #${ref.number} in browser`);
		const copy = button("issue-copy", svg("mods/github/assets/copy.svg").size(16), "Copy issue link", (_e, cx) =>
			cx.write_to_clipboard(url),
		);
		const refresh = entry?.loading
			? square(div()).child(spinner(18))
			: square(
					button("issue-refresh", "↻", "Refresh issue", (_e, cx) => {
						this.load(cx);
						cx.notify();
					}),
				).text_size(22);
		return h_flex()
			.flex_none()
			.px(24)
			.pt(18)
			.pb(12)
			.gap(12)
			.items_start()
			.when(this.history.length > 0, (el) => el.child(this.back()))
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
							.child(entry?.issue?.title ?? "Issue details"),
					)
					.child(h_flex().gap(2).items_center().flex_none().child(number).child(copy)),
			)
			.child(refresh);
	}

	private back(): Element {
		const previous = this.history.at(-1)!;
		return square(button("issue-back", "←", `Back to #${previous.number}`, (_e, cx) => this.goBack(cx))).text_size(22);
	}

	/** The scrolling part: loading and failure notes, then the issue. */
	private body(ref: IssueRef): Element {
		const t = colors();
		const entry = this.entry;
		// Keyed by issue: another issue starts at its top, not at the previous one's scroll position.
		return v_flex()
			.id(`issue-scroll-${issueKey(ref)}`)
			.flex_1()
			.min_h(0)
			.overflow_y_scroll()
			.px(24)
			.pb(18)
			.gap(12)
			.when(entry?.loading, (el) => el.child(div().text_size(12).text_color(t.dim).child("Loading issue…")))
			.when(entry?.failure, (el) =>
				el.child(
					div()
						.text_color(t.blocked)
						.child(entry?.failure ?? ""),
				),
			)
			.child(entry?.issue ? this.document(entry.issue) : div());
	}

	/** State and author, then the timeline beside (wide) or below (narrow) the metadata. */
	private document(issue: IssueDetail): Element {
		const timeline = v_flex()
			.min_w(0)
			.gap(20)
			.when(this.wide, (el) => el.flex_1())
			.when(!this.wide, (el) => el.w_full().flex_none())
			.child(this.card("issue-body", issue, issue, "opened this issue"))
			.children(
				issueTimeline(issue.comments, issue.activities).map((row) =>
					row.type === "comment"
						? this.card(`comment-${row.comment.id}`, issue, row.comment, "commented")
						: this.activity(row.activity),
				),
			)
			.child(this.composer(issue));
		const metadata = this.metadata(issue);
		const content = this.wide
			? h_flex().gap(24).items_start().child(timeline).child(metadata)
			: v_flex().gap(20).child(metadata).child(timeline);
		return v_flex()
			.gap(18)
			.child(
				h_flex()
					.gap(10)
					.pb(4)
					.items_center()
					.flex_wrap()
					.child(this.stateBadge(issue))
					.child(div().text_size(13).font_medium().child(issue.author)),
			)
			.child(content);
	}

	private stateBadge(issue: IssueDetail): Element {
		const t = colors();
		const open = issue.state === "open";
		const color = open ? t.done : t.accent;
		return div()
			.px(10)
			.py(4)
			.rounded(14)
			.bg(`${color}26`)
			.text_size(13)
			.font_semibold()
			.text_color(color)
			.child(open ? "○ Open" : "● Closed");
	}

	/** The description or a comment: who, what and when, its Markdown, and its reactions. */
	private card(id: string, issue: IssueDetail, post: Post, verb: string): Element {
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
		const text = TextView.markdown(id, post.markdown)
			.selectable(true)
			.scrollable(false)
			.on_link_click((url, cx) => this.openLink(cx, url, issue));
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

	/** A label or assignment change between the comments. */
	private activity(activity: Activity): Element {
		const t = colors();
		const avatar = div()
			.size(22)
			.flex_none()
			.rounded(11)
			.bg(t.raised)
			.text_color(t.muted)
			.font_semibold()
			.flex()
			.items_center()
			.justify_center()
			.child(activity.actor.slice(0, 1).toUpperCase());
		const labels = "labels" in activity ? activity.labels : null;
		return h_flex()
			.id(`activity-${activity.id}`)
			.px(16)
			.py(4)
			.gap(8)
			.items_center()
			.flex_wrap()
			.text_size(12)
			.child(avatar)
			.child(div().font_semibold().child(activity.actor))
			.child(div().text_color(t.dim).child(activityText(activity)))
			.when(labels, (el) =>
				el.children((labels ?? []).map((label) => this.label(label))).child(
					div()
						.text_color(t.dim)
						.child(labels?.length === 1 ? "label" : "labels"),
				),
			)
			.child(div().flex_1())
			.child(div().text_color(t.dim).tooltip(activity.createdAt).child(relativeTime(activity.createdAt, Date.now())));
	}

	private label(label: Label): Element {
		const t = colors();
		return chip(label.name, label.color ?? t.input, label.color ? `${label.color}26` : t.raised).text_color(
			t.foreground,
		);
	}

	/** A new comment, and close / reopen: GitHub's own order of the two buttons. */
	private composer(issue: IssueDetail): Element {
		const t = colors();
		const box = this.box;
		const open = issue.state === "open";
		const busy = this.writing !== null;
		const close = {
			id: "issue-state",
			label: open ? "Close issue" : "Reopen issue",
			tip: open ? `Close #${issue.number}` : `Reopen #${issue.number}`,
			enabled: !busy,
			primary: false,
		};
		const send = {
			id: "issue-comment",
			label: "Comment",
			tip: "Comment (⌘/Ctrl+Enter)",
			enabled: !busy && this.draft.trim() !== "",
			primary: true,
		};
		return v_flex()
			.id("issue-composer")
			.min_w(0)
			.w_full()
			.gap(10)
			.pt(4)
			.when(box, (el) =>
				el.child(
					div()
						.min_w(0)
						.rounded(8)
						.border_1()
						.border_color(t.border)
						.bg(t.background)
						.p(8)
						.on_mouse_down("left", stop)
						.child(Textarea.new(box!).w_full().text_size(13).text_color(t.foreground)),
				),
			)
			.when(this.writeFailure, (el) =>
				el.child(
					div()
						.text_size(12)
						.text_color(t.blocked)
						.child(this.writeFailure ?? ""),
				),
			)
			.child(
				h_flex()
					.gap(8)
					.items_center()
					.justify_end()
					.when(busy, (el) => el.child(spinner(14)))
					.child(this.action(close, (cx) => this.setState(cx, open ? "closed" : "open")))
					.child(this.action(send, (cx) => this.comment(cx))),
			);
	}

	private action({ id, label, tip, enabled, primary }: Action, act: (cx: Context) => void): Element {
		const t = colors();
		return h_flex()
			.id(id)
			.h(32)
			.px(14)
			.gap(6)
			.items_center()
			.rounded(6)
			.border_1()
			.text_size(13)
			.font_medium()
			.border_color(primary ? t.accent : t.border)
			.bg(primary ? t.accent : t.raised)
			.text_color(primary ? t.background : t.foreground)
			.when(enabled, (el) =>
				el
					.cursor_pointer()
					.hover((s) => s.opacity(0.85))
					.on_click((_e, cx) => {
						cx.stop_propagation();
						act(cx);
					}),
			)
			.when(!enabled, (el) => el.opacity(0.5))
			.tooltip(tip)
			.accessibility_label(tip)
			.on_mouse_down("left", stop)
			.child(label);
	}

	/** Assignees, labels, Projects and milestone: a column beside the timeline (wide) or a row above it. */
	private metadata(issue: IssueDetail): Element {
		const t = colors();
		const quiet = (text: string) => div().text_size(12).text_color(t.dim).child(text);
		const section = (title: string, value: Element) =>
			v_flex()
				.gap(10)
				.py(16)
				.border_b(1)
				.border_color(t.border)
				.when(!this.wide, (el) => el.w(180).min_w(140).flex_1())
				.child(div().text_size(13).font_semibold().child(title))
				.child(value);
		const assignees =
			issue.assignees.length === 0
				? quiet("No assignees")
				: v_flex()
						.gap(8)
						.children(issue.assignees.map((login) => div().text_size(13).font_medium().child(login)));
		const labels =
			issue.labels.length === 0
				? quiet("None yet")
				: h_flex()
						.gap(6)
						.flex_wrap()
						.children(issue.labels.map((label) => this.label(label)));
		const sections = [
			section("Assignees", assignees),
			section("Labels", labels),
			section("Project", this.projects(quiet)),
			section("Milestone", issue.milestone ? div().text_size(13).child(issue.milestone) : quiet("No milestone")),
		];
		return this.wide ? v_flex().w(220).flex_none().children(sections) : h_flex().gap(20).flex_wrap().children(sections);
	}

	/** The issue's Projects, each opening in the browser; why there are none shows in a tooltip. */
	private projects(quiet: (text: string) => Element): Element {
		const t = colors();
		const projects = this.entry?.projects;
		if (!projects) return quiet(this.entry?.projectsLoading ? "Loading Projects…" : "Projects not loaded.");
		if (!projects.ok) return quiet("None yet").tooltip(projects.message);
		if (projects.projects.length === 0) return quiet("None yet");
		return v_flex()
			.gap(8)
			.children(
				projects.projects.map((project) =>
					link(`project-${project.url}`, project.url, project.title)
						.text_size(13)
						.text_color(t.accent)
						.tooltip(project.url),
				),
			);
	}
}

import { h_flex, Textarea, TextareaState, v_flex } from "gpui-base";
import { type AsyncContext, type Context, div, type Element } from "gpui-kit";
import { type Activity, activityText, issueTimeline } from "../../detail/core/activity.ts";
import { type DetailRef, detailKey } from "../../detail/core/detail.ts";
import type { Projects } from "../../detail/core/projects.ts";
import { type Notice, Notices } from "../../detail/io/changes.ts";
import { detailLocation } from "../../detail/io/detail-tabs.ts";
import {
	activityRuns,
	type DetailHost,
	type DetailLayout,
	DetailMetadata,
	detailBody,
	detailDocument,
	detailEmpty,
	detailHeader,
	labelChip,
	openLink,
	postCard,
	stateBadge,
} from "../../detail/views/detail.ts";
import { loadProjects, readFailure } from "../../detail/views/item-load.ts";
import { type Change, failureOf } from "../../shared/core/gh.ts";
import { ConditionalPoll, DETAIL_POLL_MS } from "../../shared/core/polling.ts";
import { relativeTime } from "../../shared/core/time.ts";
import * as gh from "../../shared/io/gh.ts";
import { colors, spinner, stop } from "../../shared/views/ui.ts";
import type { IssueDetail } from "../core/issue-detail.ts";
import { addComment, issueChanges, readIssue, setIssueState } from "../io/issues.ts";

interface Loaded {
	key: string;
	issue?: IssueDetail;
	failure?: string;
	loading: boolean;
	/** The machine whose gh read the issue (its space's, which never changes): writes go through the same one. */
	on?: string | null;
	projects?: Projects;
	projectsLoading: boolean;
}

interface Action {
	id: string;
	label: string;
	tip: string;
	enabled: boolean;
	primary: boolean;
}

export class Issue {
	ref: DetailRef | null = null;
	entry: Loaded | null = null;
	draft = "";
	private readonly host: DetailHost;
	private metadata = new DetailMetadata();
	private notices = new Notices();
	private box: TextareaState | null = null;
	private drafts = new Map<string, string>();
	private writing: "comment" | "state" | null = null;
	private writeFailure: string | null = null;
	private polling = new ConditionalPoll();

	constructor(host: DetailHost) {
		this.host = host;
	}

	init(cx: AsyncContext): void {
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
		cx.timer.every(DETAIL_POLL_MS, (cx) => {
			const shown = this.syncPolling();
			if (!this.writing) this.load(cx, shown);
		});
	}

	show(cx: Context, ref: DetailRef): void {
		// Each issue keeps its own unsent comment: Back brings it back, and it is never posted elsewhere.
		if (this.ref) this.drafts.set(detailKey(this.ref), this.draft);
		this.draft = this.drafts.get(detailKey(ref)) ?? "";
		this.drafts.delete(detailKey(ref));
		this.box?.set_value(this.draft);
		this.metadata.expanded = false;
		this.ref = ref;
		this.writeFailure = null;
		this.load(cx);
	}

	/** Visibility is the reader's own native tab, not keyboard focus or the sidebar's repository. */
	private syncPolling(): boolean {
		const place = detailLocation(this.host.reader);
		const key = this.ref && place ? `${place.on ?? ""}\n${place.pane}\n${detailKey(this.ref)}` : null;
		return this.polling.sync(key, Boolean(place?.visible) && this.host.active("issue"));
	}

	/** A forced refresh reloads even on 304; normal ticks leave unchanged discussions alone. Never touches the draft. */
	private load(cx: Context, force = true): void {
		const ref = this.ref;
		const place = detailLocation(this.host.reader);
		this.syncPolling();
		const request = this.polling.begin(force);
		if (!ref || !place || !request) return;
		const key = detailKey(ref);
		const previous = this.entry?.key === key ? this.entry : null;
		let entry: Loaded =
			!force && previous
				? previous
				: {
						key,
						issue: previous?.issue,
						on: previous?.on,
						failure: previous?.failure,
						projects: previous?.projects,
						loading: force,
						projectsLoading: false,
					};
		this.entry = entry;
		cx.spawn(async (cx) => {
			const current = () =>
				this.entry === entry &&
				this.polling.current(request) &&
				detailLocation(this.host.reader)?.visible &&
				this.host.active("issue");
			let completed: Change | undefined;
			try {
				if (entry.on === undefined) await gh.signedIn(place.on);
				const on = place.on;
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
					// Projects load on their own, only after an actual discussion reload.
					loadProjects(cx, ref, on, entry, () => this.entry === entry);
				}
				completed = change;
				entry.failure = undefined;
			} catch (e) {
				if (current()) entry.failure = readFailure(ref, e);
			} finally {
				if (!detailLocation(this.host.reader)?.visible) this.syncPolling();
				const result = this.polling.finish(request, completed);
				if (this.entry === entry) entry.loading = false;
				if (result.accepted && result.notify) cx.notify();
			}
		});
	}

	private comment(cx: Context): void {
		const body = this.draft;
		this.write(cx, "comment", body.trim() !== "", async (repo, number, on) => {
			await addComment(repo, number, body, on);
			// Empty the box only if it still holds what was sent, on the issue it was sent to.
			const sentKey = detailKey({ kind: "issue", repo, number });
			if (this.ref && detailKey(this.ref) === sentKey && this.draft === body) {
				this.draft = "";
				this.box?.set_value("");
			} else if (this.drafts.get(sentKey) === body) this.drafts.delete(sentKey);
		});
	}

	private setState(cx: Context, state: "open" | "closed"): void {
		this.write(cx, "state", true, async (repo, number, on) => {
			await setIssueState(repo, number, state, on);
		});
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
				this.writeFailure = failureOf(e).message;
			} finally {
				this.writing = null;
				cx.notify();
			}
		});
	}

	private apply(notice: Notice): void {
		const issue = this.entry?.issue;
		const comment = notice.comment;
		if (!issue || !this.ref || detailKey({ kind: "issue", ...notice }) !== detailKey(this.ref)) return;
		this.polling.invalidate();
		if (this.entry) this.entry.loading = false;
		if (comment && !issue.comments.some((c) => c.id === comment.id)) issue.comments = [...issue.comments, comment];
		if (notice.state) issue.state = notice.state.state;
	}

	render(cx: Context, layout: DetailLayout): Element[] {
		// Writes announced by other views (shared metadata re-renders this one).
		const notices = this.notices.take();
		for (const notice of notices) this.apply(notice);
		if (notices.some((n) => n.issue && this.ref && detailKey({ kind: "issue", ...n }) === detailKey(this.ref)))
			this.load(cx);
		if (this.syncPolling()) this.load(cx);
		const ref = this.ref;
		const entry = this.entry;
		if (!ref) return [detailEmpty()];
		const issue = entry?.issue;
		return [
			detailHeader(this.host, ref, { title: issue?.title, url: issue?.url, loading: Boolean(entry?.loading) }, (cx) =>
				this.load(cx),
			),
			detailBody(ref, Boolean(entry?.loading), entry?.failure, issue ? this.document(issue, layout) : null),
		];
	}

	private document(issue: IssueDetail, layout: DetailLayout): Element {
		const t = colors();
		const open = issue.state === "open";
		const onLink = (url: string, cx: Context) => openLink(cx, this.host, url, issue.url);
		return detailDocument(
			layout,
			[
				stateBadge(open ? "○ Open" : "● Closed", open ? t.done : t.accent),
				div().text_size(13).font_medium().child(issue.author),
			],
			[
				postCard("issue-body", issue, "opened this issue", onLink),
				...activityRuns(
					issueTimeline(issue.comments, issue.activities).map((row) => ({
						activity: row.type === "activity",
						element:
							row.type === "comment"
								? postCard(`comment-${row.comment.id}`, row.comment, "commented", onLink)
								: this.activity(row.activity),
					})),
				),
				this.composer(issue),
			],
			{
				item: issue,
				projects: this.entry?.projects,
				projectsLoading: Boolean(this.entry?.projectsLoading),
			},
			this.metadata,
		);
	}

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
		const changed = "labels" in activity ? activity.labels : null;
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
			.when(changed !== null, (el) =>
				el.children((changed ?? []).map(labelChip)).child(
					div()
						.text_color(t.dim)
						.child(changed?.length === 1 ? "label" : "labels"),
				),
			)
			.child(div().flex_1())
			.child(div().text_color(t.dim).tooltip(activity.createdAt).child(relativeTime(activity.createdAt, Date.now())));
	}

	private composer(issue: IssueDetail): Element {
		const t = colors();
		const box = this.box;
		const open = issue.state === "open";
		const busy = this.writing !== null;
		const close = {
			id: "issue-state",
			label: open ? "Close issue" : "Reopen issue",
			tip: `${open ? "Close" : "Reopen"} #${this.ref?.number}`,
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
			.when(box !== null, (el) =>
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
			.when(this.writeFailure !== null, (el) =>
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
}

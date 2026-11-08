import { h_flex, v_flex } from "gpui-base";
import { type AsyncContext, type Context, div, type Element } from "gpui-kit";
import { type DetailRef, detailKey, detailUrl } from "../../detail/core/detail.ts";
import type { Projects } from "../../detail/core/projects.ts";
import { Notices } from "../../detail/io/changes.ts";
import { detailLocation } from "../../detail/io/detail-tabs.ts";
import {
	type DetailHost,
	type DetailLayout,
	DetailMetadata,
	detailBody,
	detailDocument,
	detailEmpty,
	detailHeader,
	openLink,
	postCard,
	quiet,
	stateBadge,
} from "../../detail/views/detail.ts";
import { loadProjects, readFailure } from "../../detail/views/item-load.ts";
import { PULL_STATES } from "../../detail/views/state.ts";
import { failureOf } from "../../shared/core/gh.ts";
import { ConditionalPoll, DETAIL_POLL_MS } from "../../shared/core/polling.ts";
import { actionButton, button, colors, link } from "../../shared/views/ui.ts";
import { checkSummary } from "../core/checks.ts";
import { type MergeMethod, mergeStateReason, selectedMergeMethod } from "../core/merge.ts";
import type { PullDetail } from "../core/pull-detail.ts";
import { timelineKey } from "../core/pull-timeline.ts";
import type { ReviewState } from "../core/reviewers.ts";
import { deletePullBranch, mergePull, PullReader, readyPull, setPullState } from "../io/pulls.ts";
import { type DiffSubject, FileDiff } from "./diff.ts";
import { ChangedFiles } from "./files.ts";
import { timelineItem } from "./pull-timeline.ts";
import { ReviewThreads } from "./review-threads.ts";

interface Loaded {
	pull?: PullDetail;
	/** The machine whose gh read what is shown: writes go through the same one. */
	on?: string | null;
	projects?: Projects;
	loading: boolean;
	projectsLoading: boolean;
	failure?: string;
}

const REVIEWS: Record<ReviewState, { label: string; icon: string; color: string }> = {
	requested: { label: "Awaiting requested review", icon: "○", color: "dim" },
	approved: { label: "Approved these changes", icon: "✓", color: "done" },
	changes_requested: { label: "Requested changes", icon: "×", color: "blocked" },
	commented: { label: "Left review comments", icon: "◇", color: "dim" },
	dismissed: { label: "Review dismissed", icon: "−", color: "dim" },
};

export class Pull {
	private method: MergeMethod | null = null;
	private methodOptions = false;
	private checksExpanded = false;
	private confirming: MergeMethod | null = null;
	private writing = false;
	private writeFailure = "";
	private stateFailure = "";
	ref: DetailRef | null = null;
	entry: Loaded | null = null;
	files: ChangedFiles | null = null;
	private selected: string | null = null;
	private diff = new FileDiff();
	private discussions: ReviewThreads | null = null;
	private notices = new Notices();
	private expandedActivity = new Set<string>();

	private polling = new ConditionalPoll();
	private reader: PullReader | null = null;

	init(cx: AsyncContext): void {
		cx.timer.every(DETAIL_POLL_MS, (cx) => {
			const shown = this.syncPolling();
			if (!this.writing && !this.entry?.loading) this.load(cx, true, shown);
		});
	}

	private syncPolling(): boolean {
		const place = detailLocation(this.host.reader);
		return this.polling.sync(
			this.ref && place ? `${place.on}\n${place.pane}\n${detailKey(this.ref)}` : null,
			Boolean(place?.visible) && this.host.active("pr"),
		);
	}

	private readonly host: DetailHost;
	private metadata = new DetailMetadata();

	constructor(host: DetailHost) {
		this.host = host;
	}

	show(cx: Context, ref: DetailRef): void {
		this.method = null;
		this.methodOptions = false;
		this.checksExpanded = false;
		this.confirming = null;
		this.writeFailure = "";
		this.stateFailure = "";
		this.metadata.expanded = false;
		this.ref = ref;
		this.reader = null;
		this.polling.invalidate();
		this.entry = null;
		this.files = null;
		this.discussions = null;
		this.expandedActivity.clear();
		this.diff.jump(null);
		this.selected = null;
		this.load(cx);
	}

	/** A sidebar file command changes this view even when the PR identity did not change. */
	select(cx: Context, path: string | null, comment: number | null = null): void {
		this.selected = path;
		this.diff.jump(comment);
		if (path !== null) this.files?.load(cx);
		cx.notify();
	}

	private load(cx: Context, refreshRelated = true, force = true): void {
		const ref = this.ref;
		const place = detailLocation(this.host.reader);
		this.syncPolling();
		const request = this.polling.begin(force);
		if (!ref || !place || !request) return;
		this.reader ??= new PullReader(ref.repo, ref.number, place.on);
		const reader = this.reader;
		this.discussions ??= new ReviewThreads(ref, place.on, this.host);
		this.files ??= new ChangedFiles(`reader-${this.host.reader}`, ref, place.on, (cx, path) => this.select(cx, path));
		if (force && refreshRelated) {
			this.discussions.load(cx);
			if (this.selected !== null) this.files.load(cx, true);
		}
		let entry: Loaded = force
			? { pull: this.entry?.pull, on: this.entry?.on, loading: true, projectsLoading: false }
			: (this.entry ?? { loading: false, projectsLoading: false });
		this.entry = entry;
		cx.spawn(async (cx) => {
			const current = () => {
				this.syncPolling();
				return this.entry === entry && this.polling.current(request) && this.host.active("pr");
			};
			let completed: import("../../shared/core/gh.ts").Change | undefined;
			try {
				const pull = await reader.refresh(force, current);
				this.syncPolling();
				if (!current()) return;
				if (pull) {
					entry = { ...entry, pull, on: place.on, projectsLoading: false };
					this.entry = entry;
					loadProjects(cx, ref, place.on, entry, () => this.entry === entry);
					if (!force && refreshRelated) {
						this.discussions?.load(cx);
						if (this.selected !== null) this.files?.load(cx, true);
					}
				}
				entry.failure = undefined;
				completed = { changed: pull !== null, etag: null };
			} catch (e) {
				if (current() && force) entry.failure = readFailure(ref, e);
			} finally {
				this.syncPolling();
				const result = this.polling.finish(request, completed);
				if (this.entry === entry) entry.loading = false;
				if (result.accepted && result.notify) cx.notify();
			}
		});
	}

	render(cx: Context, layout: DetailLayout): Element[] {
		if (this.syncPolling()) this.load(cx);
		const on = detailLocation(this.host.reader)?.on;
		if (
			this.notices
				.take()
				.some(
					(n) =>
						n.repo === this.ref?.repo && n.number === this.ref.number && (n.pull || (n.threads && n.threads.on === on)),
				)
		)
			this.load(cx, false);
		this.files?.sync(cx);
		this.discussions?.sync(cx);
		const ref = this.ref;
		const entry = this.entry;
		if (!ref) return [detailEmpty()];
		const pull = entry?.pull;
		return [
			detailHeader(this.host, ref, { title: pull?.title, url: pull?.url, loading: Boolean(entry?.loading) }, (cx) =>
				this.load(cx),
			),
			...(this.selected !== null
				? [
						h_flex()
							.flex_none()
							.px(24)
							.pb(8)
							.child(
								button("pull-description", "Description", "Show pull request description", (_e, cx) =>
									this.select(cx, null),
								).text_color(colors().accent),
							),
					]
				: []),
			this.selected !== null
				? this.fileView()
				: detailBody(ref, Boolean(entry?.loading), entry?.failure, pull ? this.document(pull, layout) : null),
		];
	}

	private fileView(): Element {
		const file = this.files?.files?.find((f) => f.path === this.selected);
		if (file)
			return v_flex()
				.flex_1()
				.min_h(0)
				.child(
					h_flex()
						.px(16)
						.gap(8)
						.items_center()
						.child(this.files!.viewedButton(file))
						.child(
							div()
								.text_size(12)
								.child(file.viewed ? "Viewed" : "Not viewed"),
						)
						.when(Boolean(this.files?.failure), (el) =>
							el.child(
								div()
									.text_color(colors().blocked)
									.child(this.files?.failure ?? ""),
							),
						),
				)
				.child(this.diff.render(file, this.discussions ?? undefined, this.entry?.pull?.headSha));
		if (
			this.selected &&
			this.files?.files &&
			this.discussions?.threads.some((thread) => thread.path === this.selected)
		) {
			const missing: DiffSubject = {
				path: this.selected,
				url: this.entry?.pull?.url ?? (this.ref ? detailUrl(this.ref) : ""),
				missing: true,
			};
			return v_flex()
				.flex_1()
				.min_h(0)
				.child(quiet("This file is no longer in the changed-files list. Its discussions are shown below."))
				.child(this.diff.render(missing, this.discussions));
		}
		const failure = this.files?.failure ?? this.discussions?.failure;
		const message =
			failure ??
			(this.files?.loading
				? "Loading changed files…"
				: "This file is not in the changed-files list. Choose another file in the GitHub sidebar or refresh.");
		return v_flex()
			.flex_1()
			.min_h(0)
			.p(24)
			.gap(8)
			.child(
				div()
					.text_color(failure ? colors().blocked : colors().dim)
					.child(message),
			)
			.when(!this.files?.loading, (el) =>
				el.child(
					button("pull-files-retry", failure ? "Retry" : "Refresh", "Load changed files again", (_e, cx) => {
						this.files?.load(cx, true);
						cx.notify();
					}),
				),
			);
	}

	private document(pull: PullDetail, layout: DetailLayout): Element {
		const t = colors();
		const state = PULL_STATES[pull.state];
		const onLink = (url: string, cx: Context) => openLink(cx, this.host, url, pull.url);
		const merged = pull.state === "merged" ? "merged changes" : "wants to merge changes";
		return detailDocument(
			layout,
			[
				stateBadge(state.label, state.color(t), state.icon),
				div().text_size(13).child(`${pull.author} ${merged} into ${pull.base} from ${pull.head}`),
			],
			[
				postCard("pull-body", pull, "opened this pull request", onLink),
				// Discussion metadata is fetched once per PR; report its progress/failure once, not per thread.
				...(this.discussions?.loading || this.discussions?.failure ? [this.discussions.status()] : []),
				...(this.discussions?.acknowledged.timeline(pull.timeline) ?? pull.timeline).map((item) => {
					const key = timelineKey(item);
					return timelineItem(item, this.discussions, onLink, (cx, path, comment) => this.select(cx, path, comment), {
						expanded: this.expandedActivity.has(key),
						toggle: (cx) => {
							if (this.expandedActivity.has(key)) this.expandedActivity.delete(key);
							else this.expandedActivity.add(key);
							cx.notify();
						},
					});
				}),
				this.statusCard(pull),
				...(this.discussions
					? [this.discussions.summary(pull.headSha, this.stateActions(pull))]
					: [this.stateActions(pull)]),
			],
			{
				item: pull,
				projects: this.entry?.projects,
				projectsLoading: Boolean(this.entry?.projectsLoading),
				before: [["Reviewers", this.reviewers(pull)]],
			},
			this.metadata,
		);
	}

	private changeState(cx: Context, pull: PullDetail, ready: boolean): void {
		const ref = this.ref;
		const on = this.entry?.on;
		if (!ref || on === undefined || this.writing) return;
		this.writing = true;
		this.stateFailure = "";
		cx.spawn(async (cx) => {
			try {
				const state = ready
					? await readyPull(ref.repo, ref.number, on)
					: await setPullState(ref.repo, ref.number, pull.state === "closed" ? "open" : "closed", on);
				if (this.ref === ref) {
					if (this.entry?.pull) this.entry.pull.state = state;
					// A state transition invalidates any earlier merge confirmation.
					this.confirming = null;
					this.load(cx);
				}
			} catch (e) {
				if (this.ref === ref) this.stateFailure = failureOf(e).message;
			} finally {
				this.writing = false;
				cx.notify();
			}
		});
		cx.notify();
	}

	private stateActions(pull: PullDetail): Element {
		if (pull.state === "merged") return div();
		const label = pull.state === "closed" ? "Reopen Pull Request" : "Close Pull Request";
		return actionButton("pull-state", label, (_e, cx) => this.changeState(cx, pull, false), false, this.writing);
	}

	private statusCard(pull: PullDetail): Element {
		const t = colors();
		const summary = checkSummary(pull.checks);
		return v_flex()
			.w_full()
			.min_w(0)
			.border_1()
			.border_color(t.border)
			.rounded(6)
			.overflow_hidden()
			.child(
				v_flex()
					.px(16)
					.py(12)
					.gap(10)
					.child(
						button(
							"pull-checks-toggle",
							h_flex()
								.w_full()
								.gap(10)
								.items_center()
								.child(div().text_color(t[summary.tone]).child(summary.icon))
								.child(div().flex_1().child(summary.label))
								.when(pull.checks.length > 0, (el) => el.child(div().child(this.checksExpanded ? "⌄" : "›"))),
							"Show or hide checks",
							(_e, cx) => {
								this.checksExpanded = !this.checksExpanded;
								cx.notify();
							},
						)
							.w_full()
							.p(0)
							.text_color(t.foreground)
							.text_size(13),
					)
					.when(this.checksExpanded, (el) =>
						el.children(
							pull.checks.map((c) =>
								c.url
									? link(c.id, c.url, `${c.name} · ${c.status} · ${c.duration}`).text_size(12).text_color(t.accent)
									: quiet(`${c.name} · ${c.status} · ${c.duration}`),
							),
						),
					),
			)
			.child(this.mergeArea(pull));
	}

	private mergeArea(pull: PullDetail): Element {
		const info = pull.merge;
		const method = selectedMergeMethod(info.methods, this.method);
		const t = colors();
		const reason = mergeStateReason(pull.state) ?? info.reason ?? "This branch has no conflicts with the base branch.";
		const area = v_flex()
			.border_t(1)
			.border_color(t.border)
			.child(
				h_flex()
					.px(16)
					.py(12)
					.gap(10)
					.items_center()
					.child(
						div()
							.text_color(!info.reason || pull.state === "merged" ? t.done : t.dim)
							.child(!info.reason || pull.state === "merged" ? "✓" : "○"),
					)
					.child(div().text_size(13).child(reason)),
			);
		for (const failure of [this.writeFailure, this.stateFailure])
			if (failure) area.child(div().px(16).py(8).text_size(12).text_color(t.blocked).child(failure));
		const actions = h_flex().px(16).py(16).gap(8).items_center().flex_wrap().border_t(1).border_color(t.border);
		const act = (cx: Context, remove: boolean) => {
			const ref = this.ref,
				on = this.entry?.on;
			if (!ref || on === undefined || this.writing) return;
			this.writing = true;
			this.writeFailure = "";
			cx.notify();
			cx.spawn(async (cx) => {
				try {
					if (remove) {
						await deletePullBranch(ref.repo, ref.number, info, on);
						info.deletable = false;
					} else {
						if (!method) return;
						await mergePull(ref.repo, ref.number, method, info.sha, on);
					}
					if (this.ref === ref) {
						this.confirming = null;
						this.writeFailure = "";
						if (!remove) this.load(cx);
					}
				} catch (e) {
					if (this.ref === ref) this.writeFailure = failureOf(e).message;
				} finally {
					this.writing = false;
					cx.notify();
				}
			});
		};
		if (this.writing) return area.child(quiet("Updating pull request…"));
		if (info.deletable)
			return area.child(actions.child(actionButton("delete-branch", "Delete branch", (_e, cx) => act(cx, true))));
		if (pull.state === "draft")
			return area.child(
				actions
					.child(actionButton("pull-ready", "Ready for Review", (_e, cx) => this.changeState(cx, pull, true), true))
					.child(quiet("Draft pull requests cannot be merged.")),
			);
		// Retained metadata can predate a state write until the refresh finishes.
		if (!info.reason && method && pull.state === "open" && !this.entry?.loading) {
			const options = info.methods.map((value) => ({
				value,
				label: value === "merge" ? "Create Merge Commit" : value === "squash" ? "Squash and Merge" : "Rebase and Merge",
			}));
			const label = options.find((o) => o.value === method)!.label;
			actions
				.child(
					actionButton(
						"merge-confirm",
						this.confirming === method ? `Confirm ${label}` : "Merge Pull Request",
						(_e, cx) => {
							if (this.confirming === method) act(cx, false);
							else {
								this.confirming = method;
								cx.notify();
							}
						},
						true,
					),
				)
				.child(div().text_size(13).text_color(t.dim).child(`using method ${label}`))
				.when(options.length > 1, (el) =>
					el.child(
						button(
							"merge-change-method",
							this.methodOptions ? "Hide methods" : "Change method…",
							"Change merge method",
							(_e, cx) => {
								this.methodOptions = !this.methodOptions;
								cx.notify();
							},
						).text_color(t.accent),
					),
				);
			if (this.confirming)
				actions.child(
					actionButton("merge-cancel", "Cancel", (_e, cx) => {
						this.confirming = null;
						cx.notify();
					}),
				);
			area.child(actions);
			if (this.methodOptions && options.length > 1)
				area.child(
					h_flex()
						.px(16)
						.pb(16)
						.gap(8)
						.flex_wrap()
						.children(
							options.map((option) =>
								actionButton(
									`merge-method-${option.value}`,
									`${option.value === method ? "✓ " : ""}${option.label}`,
									(_e, cx) => {
										this.method = option.value;
										this.confirming = null;
										this.methodOptions = false;
										cx.notify();
									},
								)
									.border_color(option.value === method ? t.accent : t.input)
									.text_color(option.value === method ? t.accent : t.foreground),
							),
						),
				);
		}
		return area;
	}

	private reviewers(pull: PullDetail): Element {
		const t = colors();
		if (pull.reviewers.length === 0) return quiet("None yet");
		return v_flex()
			.gap(8)
			.children(
				pull.reviewers.map((r) => {
					const state = REVIEWS[r.state];
					return h_flex()
						.gap(8)
						.items_center()
						.tooltip(state.label)
						.accessibility_label(`${r.name}: ${state.label}`)
						.child(
							div()
								.flex_1()
								.min_w(0)
								.text_size(13)
								.child(`${r.name}${r.team ? " (team)" : ""}`),
						)
						.child(div().text_color(t[state.color]).child(state.icon));
				}),
			);
	}
}

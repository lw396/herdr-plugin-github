// A PR reader switches between its published discussion and a changed file's read-only unified diff.
import { h_flex, v_flex } from "gpui-base";
import { type Context, div, type Element } from "gpui-kit";
import { type DetailRef, notVisible } from "../core/detail.ts";
import type { ChangedFile } from "../core/files.ts";
import type { MergeMethod } from "../core/merge.ts";
import type { Projects } from "../core/projects.ts";
import type { PullDetail } from "../core/pull-detail.ts";
import type { ReviewState } from "../core/reviewers.ts";
import { announce, Notices } from "../io/changes.ts";
import { detailLocation } from "../io/detail-tabs.ts";
import * as gh from "../io/gh.ts";
import { readProjects } from "../io/projects.ts";
import { deletePullBranch, mergePull, readPull } from "../io/pulls.ts";
import {
	type DetailHost,
	type DetailLayout,
	DetailMetadata,
	detailBody,
	detailDocument,
	detailEmpty,
	detailHeader,
	labels,
	milestone,
	openLink,
	people,
	postCard,
	projects,
	quiet,
	stateBadge,
} from "./detail.ts";
import { FileDiff } from "./diff.ts";
import { ChangedFiles } from "./files.ts";
import { timelineItem } from "./pull-timeline.ts";
import { ReviewThreads } from "./review-threads.ts";
import { button, colors, link, PULL_STATES } from "./ui.ts";

interface Loaded {
	pull?: PullDetail;
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
	private confirming = false;
	private writing = false;
	private writeFailure = "";
	ref: DetailRef | null = null;
	entry: Loaded | null = null;
	files: ChangedFiles | null = null;
	private selected: string | null = null;
	private diff = new FileDiff();
	private discussions: ReviewThreads | null = null;
	private notices = new Notices();
	private missingFile: ChangedFile | null = null;
	private expandedActivity = new Set<string>();

	init(): void {
		this.diff.init();
	}
	private readonly host: DetailHost;
	private metadata = new DetailMetadata();

	constructor(host: DetailHost) {
		this.host = host;
	}

	show(cx: Context, ref: DetailRef): void {
		this.method = null;
		this.confirming = false;
		this.writeFailure = "";
		this.metadata.expanded = false;
		this.ref = ref;
		this.entry = null;
		this.files = null;
		this.discussions = null;
		this.missingFile = null;
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

	private load(cx: Context, refreshRelated = true): void {
		const ref = this.ref;
		const place = detailLocation(this.host.reader);
		if (!ref || !place || !this.host.active("pr")) return;
		this.discussions ??= new ReviewThreads(ref, place.on, this.host);
		if (refreshRelated) this.discussions.load(cx);
		this.files ??= new ChangedFiles(`reader-${this.host.reader}`, ref, place.on, (cx, path) => this.select(cx, path));
		if (refreshRelated && this.selected !== null) this.files.load(cx, true);
		const entry: Loaded = { pull: this.entry?.pull, loading: true, projectsLoading: false };
		this.entry = entry;
		cx.spawn(async (cx) => {
			const current = () => this.entry === entry && this.host.active("pr");
			try {
				await gh.signedIn(place.on);
				if (!current()) return;
				const pull = await readPull(ref.repo, ref.number, place.on);
				if (!current()) return;
				entry.pull = pull;
				entry.projectsLoading = true;
				cx.spawn(async (cx) => {
					const projects = await readProjects(ref, place.on);
					if (!current()) return;
					entry.projects = projects;
					entry.projectsLoading = false;
					cx.notify();
				});
			} catch (e) {
				if (current()) {
					const failure = gh.failureOf(e);
					entry.failure = failure.notFound ? notVisible(ref) : failure.message;
				}
			} finally {
				if (current()) {
					entry.loading = false;
					cx.notify();
				}
			}
		});
	}

	render(cx: Context, layout: DetailLayout): Element[] {
		const on = detailLocation(this.host.reader)?.on;
		if (
			this.notices
				.take()
				.some((n) => n.repo === this.ref?.repo && n.number === this.ref.number && n.threads?.on === on && n.threads)
		)
			this.load(cx, false);
		this.files?.sync(cx);
		this.discussions?.sync(cx);
		const ref = this.ref;
		const entry = this.entry;
		if (!ref) return [detailEmpty("pr")];
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
			if (this.missingFile?.path !== this.selected)
				this.missingFile = {
					path: this.selected,
					previousPath: null,
					status: "unchanged",
					additions: 0,
					deletions: 0,
					patch: null,
					viewed: false,
					url: this.entry?.pull?.url ?? `https://github.com/${this.ref?.repo}/pull/${this.ref?.number}`,
				};
			return v_flex()
				.flex_1()
				.min_h(0)
				.child(quiet("This file is no longer in the changed-files list. Its discussions are shown below."))
				.child(this.diff.render(this.missingFile, this.discussions));
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
				this.mergeArea(pull),
				// Discussion metadata is fetched once per PR; report its progress/failure once, not per thread.
				...(this.discussions?.loading || this.discussions?.failure ? [this.discussions.status()] : []),
				...(this.discussions?.published.timeline(pull.timeline) ?? pull.timeline).map((item) => {
					// Commit timeline events have no REST id; their fallback index can move during refresh.
					const key = JSON.stringify([item.author, item.createdAt, item.body]);
					return timelineItem(item, this.discussions, onLink, (cx, path, comment) => this.select(cx, path, comment), {
						expanded: this.expandedActivity.has(key),
						toggle: (cx) => {
							if (this.expandedActivity.has(key)) this.expandedActivity.delete(key);
							else this.expandedActivity.add(key);
							cx.notify();
						},
					});
				}),
				v_flex()
					.gap(10)
					.child(div().font_semibold().child("Checks"))
					.when(!pull.checks.length, (el) => el.child(quiet("No checks reported")))
					.children(
						pull.checks.map((c) =>
							c.url
								? link(c.id, c.url, `${c.name} · ${c.status} · ${c.duration}`).text_color(t.accent)
								: quiet(`${c.name} · ${c.status} · ${c.duration}`),
						),
					),
				...(this.discussions ? [this.discussions.summary(pull.headSha)] : []),
			],
			[
				["Reviewers", this.reviewers(pull)],
				["Assignees", people(pull.assignees, "None yet")],
				["Labels", labels(pull.labels), pull.labels.length],
				["Project", projects(this.entry?.projects, Boolean(this.entry?.projectsLoading))],
				["Milestone", milestone(pull.milestone)],
			],
			this.metadata,
		);
	}

	private mergeArea(pull: PullDetail): Element {
		const info = pull.merge;
		const area = v_flex().gap(10).child(div().font_semibold().child("Merge"));
		area.child(quiet(info.reason ?? "This branch has no conflicts with the base branch"));
		if (this.writeFailure) area.child(quiet(this.writeFailure));
		const act = (cx: Context, remove: boolean) => {
			const ref = this.ref,
				place = detailLocation(this.host.reader);
			if (!ref || !place || this.writing) return;
			this.writing = true;
			cx.spawn(async (cx) => {
				try {
					if (remove) {
						await deletePullBranch(info, place.on);
						info.deletable = false;
					} else await mergePull(ref.repo, ref.number, this.method ?? info.methods[0], info.sha, place.on);
					announce({ repo: ref.repo, number: ref.number, pull: true });
					if (this.ref === ref) {
						this.confirming = false;
						this.writeFailure = "";
						if (!remove) this.load(cx);
					}
				} catch (e) {
					if (this.ref === ref) this.writeFailure = gh.failureOf(e).message;
				} finally {
					this.writing = false;
					cx.notify();
				}
			});
		};
		if (this.writing) return area.child(quiet("Updating pull request…"));
		if (info.deletable)
			area.child(button("delete-branch", "Delete branch", "Delete remote branch", (_e, cx) => act(cx, true)));
		if (!info.reason) {
			for (const method of info.methods)
				area.child(
					button(
						`method-${method}`,
						`${(this.method ?? info.methods[0]) === method ? "●" : "○"} ${method === "merge" ? "Create a merge commit" : method === "squash" ? "Squash and merge" : "Rebase and merge"}`,
						"Merge method",
						(_e, cx) => {
							this.method = method;
							this.confirming = false;
							cx.notify();
						},
					),
				);
			area.child(
				button(
					"merge-confirm",
					this.confirming ? "Confirm Merge" : "Merge Pull Request",
					"Merge pull request",
					(_e, cx) => {
						if (this.confirming) act(cx, false);
						else {
							this.confirming = true;
							cx.notify();
						}
					},
				),
			);
			if (this.confirming)
				area.child(
					button("merge-cancel", "Cancel", "Cancel merge", (_e, cx) => {
						this.confirming = false;
						cx.notify();
					}),
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

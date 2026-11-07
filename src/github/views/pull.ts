// The PR description page: published timeline and checks. Writes, files and polling follow.
import { h_flex, v_flex } from "gpui-base";
import { type Context, div, type Element } from "gpui-kit";
import { type DetailRef, notVisible } from "../core/detail.ts";
import type { MergeMethod } from "../core/merge.ts";
import type { Projects } from "../core/projects.ts";
import type { PullDetail, ReviewState } from "../core/pull-detail.ts";
import { announce } from "../io/changes.ts";
import { detailLocation } from "../io/detail-tabs.ts";
import * as gh from "../io/gh.ts";
import { readProjects } from "../io/projects.ts";
import { deletePullBranch, mergePull, readPull } from "../io/pulls.ts";
import {
	type DetailHost,
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
	private readonly host: DetailHost;

	constructor(host: DetailHost) {
		this.host = host;
	}

	show(cx: Context, ref: DetailRef): void {
		this.method = null;
		this.confirming = false;
		this.writeFailure = "";
		this.ref = ref;
		this.entry = null;
		this.load(cx);
	}

	private load(cx: Context): void {
		const ref = this.ref;
		const place = detailLocation(this.host.reader);
		if (!ref || !place || !this.host.active("pr")) return;
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

	render(wide: boolean): Element[] {
		const ref = this.ref;
		const entry = this.entry;
		if (!ref) return [detailEmpty("pr")];
		const pull = entry?.pull;
		return [
			detailHeader(this.host, ref, { title: pull?.title, url: pull?.url, loading: Boolean(entry?.loading) }, (cx) =>
				this.load(cx),
			),
			detailBody(ref, Boolean(entry?.loading), entry?.failure, pull ? this.document(pull, wide) : null),
		];
	}

	private document(pull: PullDetail, wide: boolean): Element {
		const t = colors();
		const state = PULL_STATES[pull.state];
		const onLink = (url: string, cx: Context) => openLink(cx, this.host, url, pull.url);
		const merged = pull.state === "merged" ? "merged changes" : "wants to merge changes";
		return detailDocument(
			wide,
			[
				stateBadge(state.label, state.color(t), state.icon),
				div().text_size(13).child(`${pull.author} ${merged} into ${pull.base} from ${pull.head}`),
			],
			[
				postCard("pull-body", pull, "opened this pull request", onLink),
				this.mergeArea(pull),
				...(pull.timeline ?? []).map((item, index) =>
					v_flex()
						.gap(8)
						.child(postCard(`pull-event-${index}`, item, item.verb, onLink))
						.children(
							item.discussion.map((d) =>
								v_flex()
									.gap(6)
									.child(div().text_size(12).child(d.path))
									.when(Boolean(d.snippet), (el) => el.child(div().text_size(12).child(d.snippet)))
									.child(postCard(`inline-${d.comment.id}`, d.comment, "commented", onLink)),
							),
						),
				),
				v_flex()
					.gap(10)
					.child(div().font_semibold().child("Checks"))
					.children(
						(pull.checks ?? []).map((c) =>
							c.url
								? link(c.id, c.url, `${c.name} · ${c.status} · ${c.duration}`).text_color(t.accent)
								: quiet(`${c.name} · ${c.status} · ${c.duration}`),
						),
					),
			],
			[
				["Reviewers", this.reviewers(pull)],
				["Assignees", people(pull.assignees, "None yet")],
				["Labels", labels(pull.labels)],
				["Project", projects(this.entry?.projects, Boolean(this.entry?.projectsLoading))],
				["Milestone", milestone(pull.milestone)],
			],
		);
	}

	private mergeArea(pull: PullDetail): Element {
		const info = pull.merge;
		const area = v_flex().gap(10).child(div().font_semibold().child("Merge"));
		if (!info) return area;
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

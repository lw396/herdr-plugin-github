// The PR description page: published timeline and checks. Writes, files and polling follow.
import { h_flex, v_flex } from "gpui-base";
import { type Context, div, type Element } from "gpui-kit";
import { type DetailRef, notVisible } from "../core/detail.ts";
import type { Projects } from "../core/projects.ts";
import type { PullDetail, ReviewState } from "../core/pull-detail.ts";
import { detailLocation } from "../io/detail-tabs.ts";
import * as gh from "../io/gh.ts";
import { readProjects } from "../io/projects.ts";
import { readPull } from "../io/pulls.ts";
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
import { colors, link, PULL_STATES } from "./ui.ts";

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
	ref: DetailRef | null = null;
	entry: Loaded | null = null;
	private readonly host: DetailHost;
	private metadata = new DetailMetadata();

	constructor(host: DetailHost) {
		this.host = host;
	}

	show(cx: Context, ref: DetailRef): void {
		this.metadata.expanded = false;
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

	render(layout: DetailLayout): Element[] {
		const ref = this.ref;
		const entry = this.entry;
		if (!ref) return [detailEmpty("pr")];
		const pull = entry?.pull;
		return [
			detailHeader(this.host, ref, { title: pull?.title, url: pull?.url, loading: Boolean(entry?.loading) }, (cx) =>
				this.load(cx),
			),
			detailBody(ref, Boolean(entry?.loading), entry?.failure, pull ? this.document(pull, layout) : null),
		];
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
				["Labels", labels(pull.labels), pull.labels.length],
				["Project", projects(this.entry?.projects, Boolean(this.entry?.projectsLoading))],
				["Milestone", milestone(pull.milestone)],
			],
			this.metadata,
		);
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

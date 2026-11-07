// The PR description page. Timeline events, files, review writes and polling follow in later tickets.
import { h_flex, v_flex } from "gpui-base";
import { type Context, div, type Element, svg } from "gpui-kit";
import { describeAccount } from "../core/account.ts";
import type { DetailRef } from "../core/detail.ts";
import { browserUrl, detailLink } from "../core/markdown.ts";
import type { Projects } from "../core/projects.ts";
import type { PullDetail, ReviewState } from "../core/pull-detail.ts";
import type { PullState } from "../core/pulls.ts";
import { detailLocation } from "../io/detail-tabs.ts";
import * as gh from "../io/gh.ts";
import { readPull, readPullProjects } from "../io/pulls.ts";
import { postCard } from "./discussion.ts";
import type { DetailHost } from "./reader.ts";
import { button, chip, colors, link, spinner, square } from "./ui.ts";

interface Loaded {
	pull?: PullDetail;
	projects?: Projects;
	loading: boolean;
	projectsLoading: boolean;
	failure?: string;
}

const STATES: Record<PullState, { label: string; icon: string; color: string }> = {
	open: { label: "Open", icon: "git-pull-request", color: "done" },
	draft: { label: "Draft", icon: "git-pull-request-draft", color: "dim" },
	merged: { label: "Merged", icon: "git-merge", color: "ansi5" },
	closed: { label: "Closed", icon: "git-pull-request-closed", color: "blocked" },
};
const REVIEWS: Record<ReviewState, { label: string; icon: string; color: string }> = {
	requested: { label: "Awaiting requested review", icon: "○", color: "dim" },
	approved: { label: "Approved these changes", icon: "✓", color: "done" },
	changes_requested: { label: "Requested changes", icon: "×", color: "blocked" },
	commented: { label: "Left review comments", icon: "◇", color: "dim" },
	dismissed: { label: "Review dismissed", icon: "−", color: "dim" },
};

export class Pull {
	reader: string;
	host: DetailHost;
	ref: DetailRef | null = null;
	entry: Loaded | null = null;
	wide = false;

	constructor(reader: string, host: DetailHost) {
		this.reader = reader;
		this.host = host;
	}

	show(cx: Context, ref: DetailRef): void {
		this.ref = ref;
		this.entry = null;
		this.load(cx);
	}

	load(cx: Context): void {
		const ref = this.ref;
		const place = detailLocation(this.reader);
		if (!ref || !place || !this.host.active("pr")) return;
		const entry: Loaded = { pull: this.entry?.pull, loading: true, projectsLoading: false };
		this.entry = entry;
		cx.spawn(async (cx) => {
			const current = () => this.entry === entry && this.host.active("pr");
			try {
				const account = await gh.account(place.on);
				if (!account.status.ok) throw new Error(describeAccount(account).text);
				if (!current()) return;
				const pull = await readPull(ref.repo, ref.number, account.on);
				if (!current()) return;
				entry.pull = pull;
				entry.projectsLoading = true;
				// Optional scope failures cannot hide a successfully loaded discussion.
				cx.spawn(async (cx) => {
					const projects = await readPullProjects(ref.repo, ref.number, account.on);
					if (!current()) return;
					entry.projects = projects;
					entry.projectsLoading = false;
					cx.notify();
				});
			} catch (e) {
				if (current()) {
					const failure = gh.failureOf(e);
					entry.failure = failure.notFound
						? `${ref.repo} #${ref.number} isn't on GitHub, or this account can't see it.`
						: failure.message;
				}
			} finally {
				if (current()) {
					entry.loading = false;
					cx.notify();
				}
			}
		});
	}

	private openLink(cx: Context, url: string, base: string): void {
		const ref = detailLink(url, base);
		if (ref) this.host.follow(cx, ref);
		else {
			const external = browserUrl(url, base);
			if (external) cx.open_url(external);
		}
	}

	render(_cx: Context): Element {
		const t = colors();
		const ref = this.ref;
		const entry = this.entry;
		const root = v_flex()
			.id("pull-reader")
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
		if (!ref)
			return root.child(
				v_flex()
					.flex_1()
					.gap(8)
					.items_center()
					.justify_center()
					.p(24)
					.child(div().font_semibold().child("Pull request details"))
					.child(
						div()
							.text_size(13)
							.text_color(t.dim)
							.text_center()
							.child(
								"Choose a pull request in the GitHub sidebar. Pull request details are not restored after restarting Herdr.",
							),
					),
			);
		return root.child(this.header(ref)).child(
			v_flex()
				.id(`pull-scroll-${ref.repo}-${ref.number}`)
				.flex_1()
				.min_h(0)
				.overflow_y_scroll()
				.px(24)
				.pb(18)
				.gap(12)
				.when(entry?.loading, (el) => el.child(div().text_size(12).text_color(t.dim).child("Loading pull request…")))
				.when(entry?.failure, (el) =>
					el.child(
						div()
							.text_color(t.blocked)
							.child(entry?.failure ?? ""),
					),
				)
				.when(entry?.pull, (el) => el.child(entry?.pull ? this.document(entry.pull) : div())),
		);
	}

	private header(ref: DetailRef): Element {
		const t = colors();
		const url = this.entry?.pull?.url ?? `https://github.com/${ref.repo}/pull/${ref.number}`;
		const previous = this.host.previous();
		return h_flex()
			.flex_none()
			.px(24)
			.pt(18)
			.pb(12)
			.gap(12)
			.items_start()
			.when(previous, (el) =>
				el.child(
					square(button("pull-back", "←", `Back to #${previous?.number}`, (_e, cx) => this.host.back(cx))).text_size(
						22,
					),
				),
			)
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
							.child(this.entry?.pull?.title ?? "Pull request details"),
					)
					.child(
						h_flex()
							.gap(2)
							.items_center()
							.flex_none()
							.child(
								link("pull-browser", url, `#${ref.number}`)
									.px(2)
									.rounded(4)
									.text_color(t.accent)
									.hover((s) => s.bg(t.hover))
									.tooltip(`Open ${ref.repo} #${ref.number} in browser`),
							)
							.child(
								button("pull-copy", svg("mods/github/assets/copy.svg").size(16), "Copy pull request link", (_e, cx) =>
									cx.write_to_clipboard(url),
								),
							),
					),
			)
			.child(
				this.entry?.loading
					? square(div()).child(spinner(18))
					: square(
							button("pull-refresh", "↻", "Refresh pull request", (_e, cx) => {
								this.load(cx);
								cx.notify();
							}),
						).text_size(22),
			);
	}

	private document(pull: PullDetail): Element {
		const t = colors();
		const state = STATES[pull.state];
		const timeline = v_flex()
			.min_w(0)
			.gap(20)
			.when(this.wide, (el) => el.flex_1())
			.when(!this.wide, (el) => el.w_full().flex_none())
			.child(postCard("pull-body", pull, "opened this pull request", (url, cx) => this.openLink(cx, url, pull.url)))
			.children(
				pull.comments.map((comment) =>
					postCard(`pull-comment-${comment.id}`, comment, "commented", (url, cx) => this.openLink(cx, url, pull.url)),
				),
			);
		const metadata = this.metadata(pull);
		return v_flex()
			.gap(18)
			.child(
				h_flex()
					.gap(10)
					.pb(4)
					.items_center()
					.flex_wrap()
					.child(
						h_flex()
							.gap(6)
							.items_center()
							.px(10)
							.py(4)
							.rounded(14)
							.bg(`${t[state.color]}26`)
							.text_size(13)
							.font_semibold()
							.text_color(t[state.color])
							.child(svg(`mods/github/assets/${state.icon}.svg`).size(14))
							.child(state.label),
					)
					.child(
						div()
							.text_size(13)
							.child(
								`${pull.author} ${pull.state === "merged" ? "merged changes" : "wants to merge changes"} into ${pull.base} from ${pull.head}`,
							),
					),
			)
			.child(
				this.wide
					? h_flex().gap(24).items_start().child(timeline).child(metadata)
					: v_flex().gap(20).child(metadata).child(timeline),
			);
	}

	private metadata(pull: PullDetail): Element {
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
		const reviewers =
			pull.reviewers.length === 0
				? quiet("None yet")
				: v_flex()
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
		const projects = this.entry?.projects;
		const projectList = !projects
			? quiet(this.entry?.projectsLoading ? "Loading Projects…" : "Projects not loaded.")
			: !projects.ok
				? quiet("None yet").tooltip(projects.message)
				: projects.projects.length === 0
					? quiet("None yet")
					: v_flex()
							.gap(8)
							.children(
								projects.projects.map((p) =>
									link(`pull-project-${p.url}`, p.url, p.title).text_size(13).text_color(t.accent).tooltip(p.url),
								),
							);
		const sections = [
			section("Reviewers", reviewers),
			section(
				"Assignees",
				pull.assignees.length === 0
					? quiet("None yet")
					: v_flex()
							.gap(8)
							.children(pull.assignees.map((a) => div().text_size(13).font_medium().child(a))),
			),
			section(
				"Labels",
				pull.labels.length === 0
					? quiet("None yet")
					: h_flex()
							.gap(6)
							.flex_wrap()
							.children(
								pull.labels.map((label) =>
									chip(label.name, label.color ?? t.border, label.color ? `${label.color}33` : t.raised),
								),
							),
			),
			section("Project", projectList),
			section("Milestone", pull.milestone ? div().text_size(13).child(pull.milestone) : quiet("No milestone")),
		];
		return this.wide ? v_flex().w(220).flex_none().children(sections) : h_flex().gap(20).flex_wrap().children(sections);
	}
}

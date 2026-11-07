// The sidebar's Pull Requests tab: the VS Code extension's categories as foldable groups (views/groups.ts).

import { type Color, type Context, div, type Element, svg } from "gpui-kit";
import type { Pull, PullGroup, PullGroupKind, PullState } from "../core/pulls.ts";
import type { DetailTabs } from "../io/detail-tabs.ts";
import * as known from "../io/known.ts";
import { GroupList, type Ready } from "./groups.ts";
import { button, colors } from "./ui.ts";

/** What the extension says in an empty category. */
const EMPTY = "0 pull requests in this category";

/** The state icons (Octicons) and the theme color each takes. Merged and closed rows come with Local Pull Request Branches (#24). */
const ICONS: Record<PullState, { svg: string; color: (t: Record<string, Color>) => Color; label: string }> = {
	open: { svg: "git-pull-request", color: (t) => t.done, label: "Open" },
	draft: { svg: "git-pull-request-draft", color: (t) => t.dim, label: "Draft" },
	merged: { svg: "git-merge", color: (t) => t.ansi5, label: "Merged" },
	closed: { svg: "git-pull-request-closed", color: (t) => t.blocked, label: "Closed" },
};

/** What the tab needs from the sidebar, asked each time (the place can change between calls). */
export interface PullHost {
	ready(): Ready | null;
	run(): number;
	asking(): boolean;
	details: DetailTabs;
	/** Says why opening a PR's tab failed, in the list's place (null: clears it). */
	openFailed(message: string | null): void;
}

/** The extension's row: state icon, `#number title` (a draft in italics), `by @author`; hover offers Copy and Open in browser. */
function cells(kind: PullGroupKind, pull: Pull, hovered: boolean): Element[] {
	const t = colors();
	const icon = ICONS[pull.state];
	const title = div()
		.flex_1()
		.min_w(0)
		.truncate()
		.child(`#${pull.number} ${pull.title}`)
		.when(pull.state === "draft", (el) => el.italic());
	const iconEl = svg(`mods/github/assets/${icon.svg}.svg`)
		.size(14)
		.flex_none()
		.text_color(icon.color(t))
		.accessibility_label(icon.label);
	if (!hovered)
		return [
			iconEl,
			title,
			div()
				.flex_none()
				.max_w(110)
				.truncate()
				.text_size(12)
				.text_color(t.dim)
				.child(pull.author ? `by @${pull.author}` : "by ghost"),
		];
	return [
		iconEl,
		title,
		button(`pr-copy-${kind}-${pull.number}`, "#", `Copy #${pull.number}`, (_e, cx) =>
			cx.write_to_clipboard(`#${pull.number}`),
		),
		button(`pr-open-${kind}-${pull.number}`, "↗", "Open in browser", (_e, cx) => cx.open_url(pull.url)),
	];
}

/** The tab's groups, in the extension's order (Local Pull Request Branches joins first with #24). */
export function pullList(host: PullHost): GroupList<PullGroupKind, PullGroup, Pull> {
	return new GroupList<PullGroupKind, PullGroup, Pull>({
		id: "pr",
		groups: [
			{ kind: "review", title: "Waiting For My Review", empty: EMPTY },
			{ kind: "mine", title: "Created By Me", empty: EMPTY },
			{ kind: "all", title: "All Open", empty: EMPTY },
		],
		// As the extension starts: only All Open; the searches wait until their group is unfolded.
		expanded: ["all"],
		ready: () => host.ready(),
		run: () => host.run(),
		asking: () => host.asking(),
		peek: (kind, r) => known.peekPullGroup(kind, r.remote, r.login, r.on),
		ask: (kind, r, force) => known.pullGroup(kind, r.remote, r.login, r.on, force),
		more: (kind, r, loaded) => known.morePulls(kind, r.remote, r.login, r.on, loaded),
		rows: (page) => page.pulls,
		key: (pull) => pull.number,
		open: (cx: Context, pull) => {
			const r = host.ready();
			if (!r) return;
			host.openFailed(null);
			cx.spawn(async (cx) => {
				try {
					await host.details.open({ kind: "pr", repo: `${r.remote.owner}/${r.remote.repo}`, number: pull.number });
				} catch (e) {
					host.openFailed(e instanceof Error ? e.message : String(e));
				}
				cx.notify();
			});
		},
		cells,
	});
}

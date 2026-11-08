import { div, svg } from "gpui-kit";
import { PULL_STATES } from "../../detail/views/state.ts";
import { button, colors } from "../../shared/views/ui.ts";
import { GroupList, type ListHost } from "../../sidebar/views/groups.ts";
import type { Pull, PullCategory, PullGroup } from "../core/pulls.ts";
import * as kept from "../io/groups.ts";
import { ChangedFiles } from "./files.ts";

/** What the extension says in an empty category. */
const EMPTY = "0 pull requests in this category";

/** The extension's row: state icon, `#number title` (a draft in italics), then `by @author`. */
export function pullList(host: ListHost): GroupList<PullCategory, Pull, PullGroup> {
	const disclosures = new Map<string, { expanded: boolean; files: ChangedFiles }>();
	const disclosure = (pull: Pull, row: string) => {
		const r = host.ready();
		if (!r) return null;
		const repo = `${r.remote.owner}/${r.remote.repo}`;
		const key = JSON.stringify([r.on, repo, r.login, row]);
		let state = disclosures.get(key);
		if (!state) {
			const ref = { kind: "pr", repo, number: pull.number } as const;
			state = {
				expanded: false,
				files: new ChangedFiles(`sidebar-${row}`, ref, r.on, (cx, path) => host.open(cx, ref, path)),
			};
			disclosures.set(key, state);
		}
		return state;
	};
	return new GroupList<PullCategory, Pull, PullGroup>(host, {
		kind: "pr",
		groups: [
			{ kind: "local", title: "Local Pull Request Branches", empty: EMPTY },
			{ kind: "review", title: "Waiting For My Review", empty: EMPTY },
			{ kind: "mine", title: "Created By Me", empty: EMPTY },
			{ kind: "all", title: "All Open", empty: EMPTY },
		],
		// As the extension starts: only All Open; the searches wait until their group is unfolded.
		expanded: ["all"],
		peek: kept.peekPullGroup,
		ask: kept.pullGroup,
		more: kept.morePulls,
		disclosure: (pull, key) => {
			const state = disclosure(pull, key);
			return button(
				`pr-files-${key}`,
				state?.expanded ? "▾" : "▸",
				`${state?.expanded ? "Collapse" : "Expand"} changed files`,
				(_e, cx) => {
					if (!state) return;
					state.expanded = !state.expanded;
					if (state.expanded) state.files.load(cx);
					cx.notify();
				},
			)
				.px(2)
				.flex_none();
		},
		expandedRow: (pull, key, cx) => {
			const state = disclosure(pull, key);
			return state?.expanded ? div().pl(16).child(state.files.render(cx)) : null;
		},
		cells: (pull) => {
			const state = PULL_STATES[pull.state];
			return [
				svg(state.icon).size(14).flex_none().text_color(state.color(colors())).accessibility_label(state.label),
				div()
					.flex_1()
					.min_w(0)
					.truncate()
					.child(`#${pull.number} ${pull.title}`)
					.when(pull.state === "draft", (el) => el.italic()),
			];
		},
		idle: (pull) => [
			div()
				.flex_none()
				.max_w(110)
				.truncate()
				.text_size(12)
				.text_color(colors().dim)
				.child(pull.author ? `by @${pull.author}` : "by ghost"),
		],
	});
}

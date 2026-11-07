// The sidebar's Pull Requests tab: the VS Code extension's categories as foldable groups (views/groups.ts).

import { div, svg } from "gpui-kit";
import type { Pull, PullCategory, PullGroup } from "../core/pulls.ts";
import * as known from "../io/known.ts";
import { GroupList, type ListHost } from "./groups.ts";
import { colors, PULL_STATES } from "./ui.ts";

/** What the extension says in an empty category. */
const EMPTY = "0 pull requests in this category";

/** The extension's row: state icon, `#number title` (a draft in italics), then `by @author`. */
export function pullList(host: ListHost): GroupList<PullCategory, Pull, PullGroup> {
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
		peek: known.peekPullGroup,
		ask: known.pullGroup,
		more: known.morePulls,
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

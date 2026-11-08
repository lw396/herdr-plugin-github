// The sidebar's Issues tab: Assigned, Open and Closed as foldable groups (views/groups.ts).

import { div } from "gpui-kit";
import type { GroupKind, Issue, IssueGroup } from "../core/issues.ts";
import { relativeTime } from "../core/time.ts";
import * as known from "../io/known.ts";
import { GroupList, type ListHost } from "./groups.ts";
import { colors } from "./ui.ts";

/** `failed`: a group's ask failed. */
export function issueList(host: ListHost, failed: () => void): GroupList<GroupKind, Issue, IssueGroup> {
	return new GroupList<GroupKind, Issue, IssueGroup>(host, {
		kind: "issue",
		groups: [
			// One word like the others; the empty text says whose.
			{ kind: "assigned", title: "Assigned", empty: "No open issues assigned to you." },
			{ kind: "open", title: "Open", empty: "No open issues." },
			{ kind: "closed", title: "Closed", empty: "No closed issues." },
		],
		expanded: ["assigned"],
		peek: known.peekIssueGroup,
		ask: known.issueGroup,
		more: known.moreIssues,
		failed,
		cells: (issue) => [
			div().flex_none().text_color(colors().dim).child(`#${issue.number}`),
			div().flex_1().min_w(0).truncate().child(issue.title),
		],
		idle: (issue) => {
			const t = colors();
			return [
				div().flex_none().max_w(90).truncate().text_size(12).text_color(t.dim).child(issue.assignees.join(", ")),
				div()
					.flex_none()
					.w(28)
					.text_right()
					.text_size(12)
					.text_color(t.dim)
					.child(relativeTime(issue.updatedAt, Date.now())),
			];
		},
	});
}

import { div } from "gpui-kit";
import { relativeTime } from "../../shared/core/time.ts";
import { colors } from "../../shared/views/ui.ts";
import { GroupList, type ListHost } from "../../sidebar/views/groups.ts";
import type { GroupKind, Issue, IssueGroup } from "../core/issues.ts";
import * as kept from "../io/groups.ts";

// A REST list ETag cannot confirm that the separate GraphQL groups loaded successfully.
export function issueList(host: ListHost, failed: () => void): GroupList<GroupKind, Issue, IssueGroup> {
	return new GroupList<GroupKind, Issue, IssueGroup>(host, {
		kind: "issue",
		groups: [
			{ kind: "assigned", title: "Assigned", empty: "No open issues assigned to you." },
			{ kind: "open", title: "Open", empty: "No open issues." },
			{ kind: "closed", title: "Closed", empty: "No closed issues." },
		],
		expanded: ["assigned"],
		peek: kept.peekIssueGroup,
		ask: kept.issueGroup,
		more: kept.moreIssues,
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

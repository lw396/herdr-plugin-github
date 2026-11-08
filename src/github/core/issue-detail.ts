import { type Activity, parseActivity } from "./activity.ts";
import { type Comment, parseComments } from "./discussion.ts";
import { type Item, parseItem, type RestItem } from "./item.ts";

export interface IssueDetail extends Item {
	state: "open" | "closed";
	comments: Comment[];
	activities: Activity[];
}

/** GitHub's REST issue and its timeline, which carries both the comments and the activity. */
export function parseIssueDetail(issue: unknown, timeline: unknown): IssueDetail {
	const i = issue as RestItem & { state: "open" | "closed" },
		events = timeline as { event?: string }[];
	return {
		...parseItem(i),
		state: i.state,
		activities: parseActivity(events),
		comments: parseComments(
			events.filter((e) => e.event === "commented"),
			i.html_url,
		),
	};
}

import { type Comment, login } from "./discussion.ts";
import { type Label, parseLabel } from "./labels.ts";

interface EventBase {
	id: number;
	actor: string;
	createdAt: string;
}
export type Activity = EventBase &
	({ kind: "labeled" | "unlabeled"; labels: Label[] } | { kind: "assigned" | "unassigned"; assignee: string });
export type TimelineItem = { type: "comment"; comment: Comment } | { type: "activity"; activity: Activity };

/** The visible timeline: comments and events ordered together, adjacent same-time label changes grouped. */
export function issueTimeline(comments: Comment[], activities: Activity[]): TimelineItem[] {
	const items: TimelineItem[] = [
		...comments.map((comment): TimelineItem => ({ type: "comment", comment })),
		...activities.map((activity): TimelineItem => ({ type: "activity", activity })),
	];
	const time = (item: TimelineItem) => (item.type === "comment" ? item.comment.createdAt : item.activity.createdAt);
	items.sort((a, b) => time(a).localeCompare(time(b)));
	const shown: TimelineItem[] = [];
	for (const item of items) {
		const previous = shown.at(-1);
		if (
			item.type === "activity" &&
			"labels" in item.activity &&
			previous?.type === "activity" &&
			"labels" in previous.activity &&
			item.activity.kind === previous.activity.kind &&
			item.activity.actor === previous.activity.actor &&
			item.activity.createdAt === previous.activity.createdAt
		) {
			shown[shown.length - 1] = {
				type: "activity",
				activity: { ...previous.activity, labels: [...previous.activity.labels, ...item.activity.labels] },
			};
		} else shown.push(item);
	}
	return shown;
}

export function activityText(activity: Activity): string {
	if ("labels" in activity) return activity.kind === "labeled" ? "added" : "removed";
	if (activity.kind === "assigned")
		return activity.actor === activity.assignee ? "self-assigned this" : `assigned ${activity.assignee}`;
	return activity.actor === activity.assignee ? "removed their assignment" : `unassigned ${activity.assignee}`;
}

interface RestEvent {
	id: number;
	event: string;
	actor: { login: string } | null;
	created_at: string;
	label?: { name: string; color?: string };
	assignee?: { login: string };
}

/** Label and assignment events; other kinds are not shown. */
export function parseActivity(data: unknown): Activity[] {
	return (data as RestEvent[]).flatMap((event): Activity[] => {
		const base = { id: event.id, actor: login(event.actor), createdAt: event.created_at };
		if ((event.event === "labeled" || event.event === "unlabeled") && event.label) {
			return [{ ...base, kind: event.event, labels: [parseLabel(event.label)] }];
		}
		if ((event.event === "assigned" || event.event === "unassigned") && event.assignee) {
			return [{ ...base, kind: event.event, assignee: event.assignee.login }];
		}
		return [];
	});
}

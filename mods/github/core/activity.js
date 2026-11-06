// Read-only label/assignee events. Comments are loaded separately and must not be duplicated.
import { parseLabel } from "./issue-detail.js";
/** The visible timeline: comments and events ordered together, adjacent same-time label changes grouped. */
export function issueTimeline(comments, activities) {
    const items = [
        ...comments.map((comment) => ({ type: "comment", comment })),
        ...activities.map((activity) => ({ type: "activity", activity })),
    ];
    const time = (item) => item.type === "comment" ? item.comment.createdAt : item.activity.createdAt;
    items.sort((a, b) => time(a).localeCompare(time(b)));
    const shown = [];
    for (const item of items) {
        const previous = shown.at(-1);
        if (item.type === "activity" && "labels" in item.activity && previous?.type === "activity" && "labels" in previous.activity
            && item.activity.kind === previous.activity.kind && item.activity.actor === previous.activity.actor
            && item.activity.createdAt === previous.activity.createdAt) {
            shown[shown.length - 1] = { type: "activity", activity: { ...previous.activity, labels: [...previous.activity.labels, ...item.activity.labels] } };
        }
        else
            shown.push(item);
    }
    return shown;
}
export function activityText(activity) {
    if ("labels" in activity)
        return activity.kind === "labeled" ? "added" : "removed";
    if (activity.kind === "assigned")
        return activity.actor === activity.assignee ? "self-assigned this" : `assigned ${activity.assignee}`;
    return activity.actor === activity.assignee ? "removed their assignment" : `unassigned ${activity.assignee}`;
}
/** Ignore commented and other event kinds rather than inventing unsupported descriptions. */
export function parseActivity(data) {
    return data.flatMap((event) => {
        const base = { id: event.id, actor: event.actor?.login ?? "deleted user", createdAt: event.created_at };
        if ((event.event === "labeled" || event.event === "unlabeled") && event.label) {
            return [{ ...base, kind: event.event, labels: [parseLabel(event.label)] }];
        }
        if ((event.event === "assigned" || event.event === "unassigned") && event.assignee) {
            return [{ ...base, kind: event.event, assignee: event.assignee.login }];
        }
        return [];
    });
}

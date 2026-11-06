export const issueKey = (ref) => `${ref.repo.toLowerCase()}#${ref.number}`;
const EMOJI = [
    ["+1", "👍"], ["-1", "👎"], ["laugh", "😄"], ["hooray", "🎉"],
    ["confused", "😕"], ["heart", "❤️"], ["rocket", "🚀"], ["eyes", "👀"],
];
/** GitHub's REST replies, with comments in creation order and non-zero reaction counts. */
export function parseIssueDetail(issue, comments) {
    const i = issue;
    return {
        number: i.number, title: i.title, state: i.state, author: i.user?.login ?? "deleted user",
        createdAt: i.created_at, url: i.html_url, labels: i.labels.map(l => typeof l === "string" ? l : l.name),
        assignees: i.assignees.map(a => a.login), milestone: i.milestone?.title ?? null, body: i.body ?? "",
        comments: comments.map(c => ({
            id: c.id, author: c.user?.login ?? "deleted user", createdAt: c.created_at, body: c.body ?? "",
            reactions: EMOJI.flatMap(([key, emoji]) => {
                const count = c.reactions[key];
                return typeof count === "number" && count > 0 ? [{ emoji, count }] : [];
            }),
        })).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id),
    };
}

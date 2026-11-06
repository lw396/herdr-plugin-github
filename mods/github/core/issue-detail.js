export const issueKey = (ref) => `${ref.repo.toLowerCase()}#${ref.number}`;
/** Keep native tabs compact; the full repository remains visible in the reader's link tooltip. */
export const issueTabName = (ref) => `#${ref.number} · ${ref.repo.split("/").at(-1)}`;
/** GitHub supplies six-digit hex colors, without '#'; older replies can contain names only. */
export function parseLabel(label) {
    return typeof label === "string" ? { name: label, color: null } : {
        name: label.name,
        color: label.color && /^[a-f\d]{6}$/i.test(label.color) ? `#${label.color.toLowerCase()}` : null,
    };
}
const EMOJI = [
    ["+1", "👍"], ["-1", "👎"], ["laugh", "😄"], ["hooray", "🎉"],
    ["confused", "😕"], ["heart", "❤️"], ["rocket", "🚀"], ["eyes", "👀"],
];
/** GitHub's REST replies, with comments in creation order and non-zero reaction counts. */
export function parseIssueDetail(issue, comments) {
    const i = issue;
    return {
        number: i.number, title: i.title, state: i.state, author: i.user?.login ?? "deleted user",
        createdAt: i.created_at, url: i.html_url, labels: i.labels.map(parseLabel),
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

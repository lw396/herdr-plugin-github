// The REST issue and its discussion as the detail reader displays them.
export interface IssueRef { repo: string; number: number }
export const issueKey = (ref: IssueRef): string => `${ref.repo.toLowerCase()}#${ref.number}`;

/** Keep native tabs compact; the full repository remains visible in the reader's link tooltip. */
export const issueTabName = (ref: IssueRef): string => `#${ref.number} · ${ref.repo.split("/").at(-1)}`;

export interface Reaction { emoji: string; count: number }
export interface Label { name: string; color: `#${string}` | null }

/** GitHub supplies six-digit hex colors, without '#'; older replies can contain names only. */
export function parseLabel(label: string | { name: string; color?: string }): Label {
  return typeof label === "string" ? { name: label, color: null } : {
    name: label.name,
    color: label.color && /^[a-f\d]{6}$/i.test(label.color) ? `#${label.color.toLowerCase()}` : null,
  };
}

export interface Comment {
  id: number;
  author: string;
  createdAt: string;
  body: string;
  reactions: Reaction[];
}

export interface IssueDetail {
  number: number;
  title: string;
  state: "open" | "closed";
  author: string;
  createdAt: string;
  url: string;
  labels: Label[];
  assignees: string[];
  milestone: string | null;
  body: string;
  comments: Comment[];
}

interface RestComment {
  id: number;
  user: { login: string } | null;
  created_at: string;
  body: string | null;
  reactions: Record<string, number | string>;
}

interface RestIssue {
  number: number;
  title: string;
  state: "open" | "closed";
  user: { login: string } | null;
  created_at: string;
  html_url: string;
  labels: (string | { name: string; color?: string })[];
  assignees: { login: string }[];
  milestone: { title: string } | null;
  body: string | null;
}

const EMOJI: [string, string][] = [
  ["+1", "👍"], ["-1", "👎"], ["laugh", "😄"], ["hooray", "🎉"],
  ["confused", "😕"], ["heart", "❤️"], ["rocket", "🚀"], ["eyes", "👀"],
];

/** GitHub's REST replies, with comments in creation order and non-zero reaction counts. */
export function parseIssueDetail(issue: unknown, comments: unknown): IssueDetail {
  const i = issue as RestIssue;
  return {
    number: i.number, title: i.title, state: i.state, author: i.user?.login ?? "deleted user",
    createdAt: i.created_at, url: i.html_url, labels: i.labels.map(parseLabel),
    assignees: i.assignees.map(a => a.login), milestone: i.milestone?.title ?? null, body: i.body ?? "",
    comments: (comments as RestComment[]).map(c => ({
      id: c.id, author: c.user?.login ?? "deleted user", createdAt: c.created_at, body: c.body ?? "",
      reactions: EMOJI.flatMap(([key, emoji]) => {
        const count = c.reactions[key];
        return typeof count === "number" && count > 0 ? [{ emoji, count }] : [];
      }),
    })).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id),
  };
}

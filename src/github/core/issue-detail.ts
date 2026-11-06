import { parseLabel, type Label } from "./labels.ts";
import { parseActivity, type Activity } from "./activity.ts";
import { readerMarkdown } from "./markdown.ts";

export type { Label };
export interface IssueRef { repo: string; number: number }
export const issueKey = (ref: IssueRef): string => `${ref.repo.toLowerCase()}#${ref.number}`;

/** Keep native tabs compact; the full repository remains visible in the reader's link tooltip. */
export const issueTabName = (ref: IssueRef): string => `#${ref.number} · ${ref.repo.split("/").at(-1)}`;

export interface Reaction { emoji: string; count: number }

export interface Comment {
  id: number;
  author: string;
  createdAt: string;
  body: string;
  /** body as the reader renders it: prepared once here, not on every render (parsing is slow in QuickJS). */
  markdown: string;
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
  markdown: string;
  comments: Comment[];
  activities: Activity[];
}

/** A timeline "commented" event: the same fields as the comments endpoint's comment. */
interface RestComment {
  event: string;
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

/** GitHub's REST issue and timeline, with comments in creation order and non-zero reaction counts. */
export function parseIssueDetail(issue: unknown, timeline: unknown): IssueDetail {
  const i = issue as RestIssue, events = timeline as RestComment[];
  return {
    number: i.number, title: i.title, state: i.state, author: i.user?.login ?? "deleted user",
    createdAt: i.created_at, url: i.html_url, labels: i.labels.map(parseLabel),
    assignees: i.assignees.map(a => a.login), milestone: i.milestone?.title ?? null,
    body: i.body ?? "", markdown: readerMarkdown(i.body ?? "", i.html_url), activities: parseActivity(events),
    comments: events.filter(e => e.event === "commented").map(c => ({
      id: c.id, author: c.user?.login ?? "deleted user", createdAt: c.created_at, body: c.body ?? "", markdown: readerMarkdown(c.body ?? "", i.html_url),
      reactions: EMOJI.flatMap(([key, emoji]) => {
        const count = c.reactions[key];
        return typeof count === "number" && count > 0 ? [{ emoji, count }] : [];
      }),
    })).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id),
  };
}

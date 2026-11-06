// Writes made in one view (a reader's comment, close or reopen) reach the others through Herdr's
// shared metadata: setting it re-renders every mod, so listeners take new notices when they render.
import { shared, setShared } from "herdr";
import type { Comment } from "../core/issue-detail.ts";
import type { IssueChange } from "../core/issues.ts";

/** One write to an issue: a new comment, or its new state. */
export interface IssueNotice {
  repo: string;
  number: number;
  comment?: Comment;
  state?: IssueChange;
}

interface Log { last: number; notices: { seq: number; notice: IssueNotice }[] }

const CHANGES = "github.changes";
/** The most recent notices kept for views that render late. */
const KEPT = 20;
const log = (): Log => (shared(CHANGES) as Log | null) ?? { last: 0, notices: [] };

export function announce(notice: IssueNotice): void {
  const { last, notices } = log(), seq = last + 1;
  setShared(CHANGES, { last: seq, notices: [...notices, { seq, notice }].slice(-KEPT) });
}

/** What one view has taken: it starts after what was announced before it (a read: safe in init). */
export class Notices {
  private seen = log().last;

  /** Notices announced since the last take, oldest first. */
  take(): IssueNotice[] {
    const { last, notices } = log();
    const fresh = notices.filter((n) => n.seq > this.seen).map((n) => n.notice);
    this.seen = last;
    return fresh;
  }
}

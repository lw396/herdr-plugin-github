// Writes made in one view (a reader's comment, close or reopen) reach the others through Herdr's
// shared metadata: setting it re-renders every mod, so listeners take new notices when they render.
import { setShared, shared } from "herdr";
import type { Comment } from "../core/discussion.ts";
import type { IssueChange } from "../core/issues.ts";
import { GhError } from "./gh.ts";

/** One write to an issue: a new comment, or its new state. */
export interface Notice {
	pull?: boolean;
	repo: string;
	number: number;
	comment?: Comment;
	state?: IssueChange;
	/** Re-read this PR's viewed-file state, only on the machine that performed the write. */
	files?: { on: string | null };
	/** Re-read discussions through the same machine/account, without sharing private review data. */
	threads?: { on: string | null };
	/** A submitted review can move a PR out of Waiting For My Review. */
	review?: { on: string | null };
}

/**
 * Each notice has its own id, not a shared counter: a mod instance announcing from an older copy
 * of the log must not reuse a number another view has already taken.
 */
type Log = { id: string; notice: Notice }[];

const CHANGES = "github.changes";
/** The most recent notices kept for views that render late. */
const KEPT = 20;
const log = (): Log => (shared(CHANGES) as { notices: Log } | null)?.notices ?? [];

export function announce(notice: Notice): void {
	const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
	setShared(CHANGES, { notices: [...log(), { id, notice }].slice(-KEPT) });
}

/**
 * A write, never retried. Unless GitHub refused it, it may have happened even when its reply was lost
 * or unreadable: every view affected re-reads.
 */
export async function written<T>(notice: Notice, write: () => Promise<T>): Promise<T> {
	try {
		const result = await write();
		announce(notice);
		return result;
	} catch (e) {
		if (!(e instanceof GhError) || e.transient) announce(notice);
		throw e;
	}
}

/** What one view has taken: it starts after what was announced before it (a read: safe in init). */
export class Notices {
	private taken = new Set(log().map((n) => n.id));

	/** Notices announced since the last take, oldest first. */
	take(): Notice[] {
		const notices = log(),
			fresh = notices.filter((n) => !this.taken.has(n.id));
		// Only ids still in the log can come again.
		this.taken = new Set(notices.map((n) => n.id));
		return fresh.map((n) => n.notice);
	}
}

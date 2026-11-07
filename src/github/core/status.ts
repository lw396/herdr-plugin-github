// The sidebar footer: which gh speaks for this folder, and whether checking the lists failed (ADR 0003, 0006).
import type { Account } from "./account.ts";

/** How often the visible sidebar checks its lists for changes. */
export const POLL_SECONDS = 60;

export interface SyncState {
	/** undefined: not known yet for this place. */
	account: Account | undefined;
	/** The folder's machine (null: this computer), known before its account is. */
	on: string | null;
	/** When a change check last succeeded (ms), or null. */
	checkedAt: number | null;
	/** Whether the latest check failed. */
	failed: boolean;
	/** Whether the lists are polled at all: a repository and a signed-in gh. */
	polling: boolean;
}

export interface FooterStatus {
	tone: "ok" | "pending" | "problem";
	account: string;
	machine: string;
	/** Only a failed check has a second line; a healthy one says nothing. */
	sync: string | null;
}

const PROBLEM = { missing: "gh is not installed", auth: "Not signed in to gh", error: "gh is not working" } as const;

const ago = (ms: number): string => (ms < 60_000 ? "just now" : `${Math.floor(ms / 60_000)}m ago`);

export function footerStatus(s: SyncState, now: number): FooterStatus {
	const machine = s.on ?? "this computer";
	if (!s.account) return { tone: "pending", account: "Checking gh…", machine, sync: null };
	const { status } = s.account;
	if (!status.ok) return { tone: "problem", account: PROBLEM[status.reason], machine, sync: null };
	if (!s.polling || !s.failed) return { tone: "ok", account: status.user, machine, sync: null };
	const last = s.checkedAt === null ? null : ago(Math.max(0, now - s.checkedAt));
	const sync = last ? `Check failed · last ok ${last}` : `Check failed · retrying every ${POLL_SECONDS}s`;
	return { tone: "problem", account: status.user, machine, sync };
}

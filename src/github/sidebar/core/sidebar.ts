// What the sidebar says besides its rows: a problem in the list's place, a folder without a repository,
// and the footer's gh account and list checks (ADR 0003, 0006).
import { ACCOUNT_PROBLEM, type Account, describeAccount } from "../../shared/core/account.ts";
import type { Failure } from "../../shared/core/gh.ts";
import type { RemoteRepo } from "../../shared/core/remote.ts";

/** How often the visible sidebar checks its lists for changes. */
export const POLL_SECONDS = 60;

/** In a folder (`cwd`) without a GitHub remote: a quiet empty state, not an error. */
export function noRepository(cwd: string | null): { title: string; detail: string } {
	const hint = "Focus a terminal in a repository cloned from GitHub.";
	const name = cwd ? cwd.replace(/\/+$/, "").split("/").pop() || "/" : null;
	return { title: "No GitHub repository", detail: name ? `${name} has no GitHub remote. ${hint}` : hint };
}

/** What the sidebar knows when it draws a tab's list; undefined: not known yet. */
export interface ListState {
	account: Account | undefined;
	remote: RemoteRepo | null | undefined;
	/** False when the repository has Issues turned off (the Issues tab only). */
	issuesEnabled?: boolean;
	failure?: Failure;
}

/**
 * The problem every group of a tab shares, said once in the list's place; null when there is none:
 * a list, nothing known yet, or a folder without a GitHub remote (not a problem: see noRepository).
 */
export function listNotice(s: ListState): string | null {
	if (s.account && !s.account.status.ok) return describeAccount(s.account).text;
	if (s.remote === null) return null;
	const repo = s.remote ? `${s.remote.owner}/${s.remote.repo}` : "the repository";
	if (s.failure?.notFound && s.remote) {
		const user = s.account?.status.ok ? s.account.status.user : "this account";
		return `${repo} (remote "${s.remote.remote}") isn't on GitHub, or ${user} can't see it. Check git remote -v.`;
	}
	if (s.failure) return s.failure.message;
	if (s.issuesEnabled === false) return `Issues are turned off for ${repo}.`;
	return null;
}

export interface SyncState {
	/** undefined: not known yet for this place. */
	account: Account | undefined;
	/** The folder's machine (null: this computer), known before its account is. */
	on: string | null;
	/** When a change check last succeeded (ms), or null. */
	checkedAt: number | null;
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

const ago = (ms: number): string => (ms < 60_000 ? "just now" : `${Math.floor(ms / 60_000)}m ago`);

export function footerStatus(s: SyncState, now: number): FooterStatus {
	const machine = s.on ?? "this computer";
	if (!s.account) return { tone: "pending", account: "Checking gh…", machine, sync: null };
	const { status } = s.account;
	if (!status.ok) return { tone: "problem", account: ACCOUNT_PROBLEM[status.reason], machine, sync: null };
	if (!s.polling || !s.failed) return { tone: "ok", account: status.user, machine, sync: null };
	const last = s.checkedAt === null ? null : ago(Math.max(0, now - s.checkedAt));
	const sync = last ? `Check failed · last ok ${last}` : `Check failed · retrying every ${POLL_SECONDS}s`;
	return { tone: "problem", account: status.user, machine, sync };
}

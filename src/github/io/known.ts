// What the sidebar knows about a place, kept per what each fact depends on: the gh account per
// machine, the GitHub remote per machine and folder, each issue group per machine,
// host/owner/repo and login (each machine's gh may be another account). Switching back to a
// place shows what is known at once and asks again only once it is stale (or on ↻); two looks
// at once share one call.

import type { Account } from "../core/account.ts";
import { Cache } from "../core/cache.ts";
import { appendPage, applyChange, type GroupKind, type IssueChange, type IssueGroup } from "../core/issues.ts";
import type { RemoteRepo } from "../core/remote.ts";
import * as gh from "./gh.ts";
import { githubRemote } from "./git.ts";
import { issuePage } from "./issues.ts";

/**
 * One kind of fact: kept answers, fresh for `fresh` ms (stale ones still show while asked
 * again), and the ask still out per key. Only answers `keep` accepts are kept.
 */
function facts<T>(limit: number, fresh: number, keep: (value: T) => boolean) {
	const cache = new Cache<T>(limit),
		asking = new Map<string, Promise<T>>();
	return {
		peek: (key: string): T | undefined => cache.get(key),
		/** The kept answer when fresh (unless forced), else the ask already out (unless forced), else a new ask. */
		look(key: string, force: boolean, ask: () => Promise<T>): Promise<T> {
			if (!force && cache.fresh(key, fresh, Date.now())) return Promise.resolve(cache.get(key) as T);
			const pending = asking.get(key);
			if (pending && !force) return pending;
			const p: Promise<T> = ask()
				.then((value) => {
					// Only the newest ask is kept: a slower, older answer arriving after a ↻ is already out of date.
					if (asking.get(key) === p && keep(value)) cache.set(key, value, Date.now());
					return value;
				})
				.finally(() => {
					if (asking.get(key) === p) asking.delete(key);
				});
			asking.set(key, p);
			return p;
		},
		/** Keeps `value` as the answer now (a page loaded by other means: Load more). */
		put(key: string, value: T): void {
			cache.set(key, value, Date.now());
		},
		/** Shows `change(value)` for every kept key until asked again: kept stale, and an answer still out is dropped. */
		patch(match: (key: string) => boolean, change: (key: string, value: T) => T): void {
			for (const key of cache.keys().filter(match)) {
				cache.set(key, change(key, cache.get(key) as T), -Infinity);
				asking.delete(key);
			}
		},
		clear(): void {
			cache.clear();
			asking.clear();
		},
	};
}

// Not kept: a gh that isn't signed in, and a folder without a GitHub remote (yet): both are
// what the person is about to fix, so the next look asks again.
// A GitHub account hardly ever changes: a signed-in one is kept for an hour, even through ↻.
// Remotes rarely change; lists do (until #16 polls for changes).
const accounts = facts<Account>(16, 60 * 60_000, (a) => a.status.ok);
const remotes = facts<RemoteRepo | null>(64, 5 * 60_000, (r) => r !== null);
const groups = facts<IssueGroup>(64, 60_000, () => true);

const machineKey = (on: string | null | undefined): string => on ?? "";
const folderKey = (where: gh.Where): string => `${where.on ?? ""}\n${where.cwd ?? ""}`;
const groupKey = (kind: GroupKind, r: RemoteRepo, login: string, on: string | null): string =>
	`${kind}\n${on ?? ""}\n${r.host}/${r.owner}/${r.repo}\n${login}`;

/** The gh on that machine (null: this computer). ↻ (`force`) asks again only when none is signed in. */
export const account = (on: string | null, force = false): Promise<Account> =>
	accounts.look(machineKey(on), force && !accounts.peek(machineKey(on)), () => gh.account(on));
export const peekAccount = (on: string | null): Account | undefined => accounts.peek(machineKey(on));

/** The folder's GitHub remote, or null when it has none. */
export const remote = (where: gh.Where, force = false): Promise<RemoteRepo | null> =>
	remotes.look(folderKey(where), force, () => githubRemote(where));
/** undefined: not known (yet). */
export const peekRemote = (where: gh.Where): RemoteRepo | null | undefined => remotes.peek(folderKey(where));

/** A group's first page in the repository, asked with the gh on `on` (whose account is `login`). */
export const group = (
	kind: GroupKind,
	r: RemoteRepo,
	login: string,
	on: string | null,
	force = false,
): Promise<IssueGroup> => groups.look(groupKey(kind, r, login, on), force, () => issuePage(kind, r, login, on, null));
/** What is kept for the group: its first page, and any pages Load more added. */
export const peekGroup = (kind: GroupKind, r: RemoteRepo, login: string, on: string | null): IssueGroup | undefined =>
	groups.peek(groupKey(kind, r, login, on));

/** Load more: `loaded` with the page after it; kept, so switching back shows every loaded row. */
export async function more(
	kind: GroupKind,
	r: RemoteRepo,
	login: string,
	on: string | null,
	loaded: IssueGroup,
): Promise<IssueGroup> {
	const key = groupKey(kind, r, login, on);
	const both = appendPage(loaded, await issuePage(kind, r, login, on, loaded.cursor));
	// Kept only if `loaded` is still what is kept: a ↻ in the meantime replaced it with newer rows.
	if (groups.peek(key) === loaded) groups.put(key, both);
	return both;
}

/**
 * An issue closed or reopened (in a reader, maybe another view's): every kept group of its
 * repository shows it where it now belongs at once, and is asked again on the next look.
 */
export function issueChanged(change: IssueChange): void {
	const repo = `github.com/${change.repo}`.toLowerCase();
	groups.patch(
		(key) => key.split("\n")[2]?.toLowerCase() === repo,
		(key, group) => {
			const [kind, , , login] = key.split("\n");
			return applyChange(kind as GroupKind, group, change, login ?? "");
		},
	);
}

/** Forgets everything (tests). */
export function clear(): void {
	accounts.clear();
	remotes.clear();
	groups.clear();
}

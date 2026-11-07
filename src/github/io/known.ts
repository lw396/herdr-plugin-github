// What the sidebar knows about a place, kept per what each fact depends on: the gh account per
// machine, the GitHub remote per machine and folder, and each issue or PR group per machine,
// repository and login (each machine's gh may be another account). Switching back to a place
// shows what is known at once and asks again only once it is stale (or on ↻); two looks at once
// share one call.

import type { Account } from "../core/account.ts";
import { Cache } from "../core/cache.ts";
import { applyChange, type GroupKind, type IssueChange, type IssueGroup } from "../core/issues.ts";
import type { Folder } from "../core/location.ts";
import { appendPage, PAGE, type Page } from "../core/page.ts";
import { localPage, type Pull, type PullCategory, type PullGroup, type PullGroupKind } from "../core/pulls.ts";
import type { RemoteRepo } from "../core/remote.ts";
import * as gh from "./gh.ts";
import { githubRemote, localBranches } from "./git.ts";
import { issuePage } from "./issues.ts";
import { localPulls, pullPage } from "./pulls.ts";

/** Where a tab's groups are asked: the folder, its repository, and the login of the gh on its machine. */
export interface Ready extends Folder {
	remote: RemoteRepo;
	login: string;
}

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
		/** Shows what `change` returns for a kept key until asked again (undefined: untouched); an answer still out is dropped. */
		patch(change: (key: string, value: T) => T | undefined): void {
			for (const key of cache.keys()) {
				const changed = change(key, cache.get(key) as T);
				if (changed === undefined) continue;
				cache.set(key, changed, -Infinity);
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
// Remotes rarely change; visible lists also use conditional polling to detect external changes.
const accounts = facts<Account>(16, 60 * 60_000, (a) => a.status.ok);
const remotes = facts<RemoteRepo | null>(64, 5 * 60_000, (r) => r !== null);

const folderKey = ({ on, cwd }: Folder): string => JSON.stringify([on, cwd]);

/** The gh on that machine (null: this computer). ↻ (`force`) asks again only when none is signed in. */
export const account = (on: string | null, force = false): Promise<Account> =>
	accounts.look(JSON.stringify(on), force && !accounts.peek(JSON.stringify(on)), () => gh.account(on));
export const peekAccount = (on: string | null): Account | undefined => accounts.peek(JSON.stringify(on));

/** The folder's GitHub remote, or null when it has none. */
export const remote = (folder: Folder, force = false): Promise<RemoteRepo | null> =>
	remotes.look(folderKey(folder), force, () => githubRemote(folder));
/** undefined: not known (yet). */
export const peekRemote = (folder: Folder): RemoteRepo | null | undefined => remotes.peek(folderKey(folder));

/** A group's key and back: what its rows depend on, the login too (what an account can see). */
const groupKey = (kind: string, r: Ready): string =>
	JSON.stringify([kind, r.on, r.remote.host, r.remote.owner, r.remote.repo, r.login]);
const groupOf = (key: string) => {
	const [kind, , host, owner, repo, login] = JSON.parse(key) as string[];
	return { kind: kind ?? "", repo: `${host}/${owner}/${repo}`.toLowerCase(), login: login ?? "" };
};

/** Groups asked a page at a time: the first page kept for a minute, and the pages Load more adds to it. */
function pagedGroups<K extends string, P extends Page<{ number: number }>>(
	ask: (kind: K, r: Ready, after: string | null) => Promise<P>,
) {
	const kept = facts<P>(64, 60_000, () => true);
	return {
		kept,
		look: (kind: K, r: Ready, force = false): Promise<P> =>
			kept.look(groupKey(kind, r), force, () => ask(kind, r, null)),
		peek: (kind: K, r: Ready): P | undefined => kept.peek(groupKey(kind, r)),
		async more(kind: K, r: Ready, loaded: P): Promise<P> {
			const key = groupKey(kind, r);
			const both = appendPage(loaded, await ask(kind, r, loaded.cursor));
			// Kept only if `loaded` is still what is kept: a ↻ in the meantime replaced it with newer rows.
			if (kept.peek(key) === loaded) kept.put(key, both);
			return both;
		},
	};
}

const issueGroups = pagedGroups<GroupKind, IssueGroup>((kind, r, after) =>
	issuePage(kind, r.remote, r.login, r.on, after),
);
const pullGroups = pagedGroups<PullGroupKind, PullGroup>((kind, r, after) =>
	pullPage(kind, r.remote, r.login, r.on, after),
);

/** An issue group's first page, and any pages Load more added. */
export const issueGroup = issueGroups.look;
export const peekIssueGroup = issueGroups.peek;
export const moreIssues = issueGroups.more;

/**
 * An issue closed or reopened (in a reader, maybe another view's): every kept group of its
 * repository shows it where it now belongs at once, and is asked again on the next look.
 */
export function issueChanged(change: IssueChange): void {
	const repo = `github.com/${change.repo}`.toLowerCase();
	issueGroups.kept.patch((key, group) => {
		const g = groupOf(key);
		return g.repo === repo ? applyChange(g.kind as GroupKind, group, change, g.login) : undefined;
	});
}

// Local matches depend on the focused checkout too, and are asked again whenever looked at: its
// branches are read each time, and only a changed snapshot asks GitHub again (ADR 0006).
const localMatches = facts<{ signature: string; rows: Pull[] }>(64, 0, () => true);
/** The page of a kept batch that was last shown: Load more grows it without another request. */
const localShown = new WeakMap<Pull[], PullGroup>();

const localKey = (r: Ready): string => JSON.stringify([groupKey("local", r), r.cwd]);

function showLocal(rows: Pull[], count: number): PullGroup {
	const page = localPage(rows, count);
	localShown.set(rows, page);
	return page;
}

async function localGroup(r: Ready, force: boolean): Promise<PullGroup> {
	const key = localKey(r);
	const { rows } = await localMatches.look(key, force, async () => {
		const snapshot = await localBranches(r.remote, r);
		const signature = JSON.stringify(snapshot);
		const kept = localMatches.peek(key);
		if (!force && kept?.signature === signature) return kept;
		return { signature, rows: await localPulls(r.remote, snapshot, r.on) };
	});
	return localShown.get(rows) ?? showLocal(rows, PAGE);
}

/** A PR group's first page, and any pages Load more added. */
export const pullGroup = (kind: PullCategory, r: Ready, force = false): Promise<PullGroup> =>
	kind === "local" ? localGroup(r, force) : pullGroups.look(kind, r, force);

export function peekPullGroup(kind: PullCategory, r: Ready): PullGroup | undefined {
	if (kind !== "local") return pullGroups.peek(kind, r);
	const rows = localMatches.peek(localKey(r))?.rows;
	return rows && localShown.get(rows);
}

export async function morePulls(kind: PullCategory, r: Ready, loaded: PullGroup): Promise<PullGroup> {
	if (kind !== "local") return pullGroups.more(kind, r, loaded);
	const rows = localMatches.peek(localKey(r))?.rows;
	return rows && localShown.get(rows) === loaded ? showLocal(rows, loaded.rows.length + PAGE) : loaded;
}

/** Forgets everything (tests). */
export function clear(): void {
	accounts.clear();
	remotes.clear();
	issueGroups.kept.clear();
	pullGroups.kept.clear();
	localMatches.clear();
}

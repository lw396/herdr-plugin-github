// What the sidebar knows about a place, kept per what each fact depends on: the gh account per
// machine, the GitHub remote per machine and folder, the "Assigned to me" group per machine,
// host/owner/repo and login (each machine's gh may be another account). Switching back to a
// place shows what is known at once and asks again only once it is stale (or on ↻); two looks
// at once share one call.
import { Cache } from "../core/cache.ts";
import type { Account } from "../core/account.ts";
import type { RemoteRepo } from "../core/remote.ts";
import type { IssueGroup } from "../core/issues.ts";
import * as gh from "./gh.ts";
import { githubRemote } from "./git.ts";
import { assignedToMe } from "./issues.ts";

/**
 * One kind of fact: kept answers, fresh for `fresh` ms (stale ones still show while asked
 * again), and the ask still out per key. Only answers `keep` accepts are kept.
 */
function facts<T>(limit: number, fresh: number, keep: (value: T) => boolean) {
  const cache = new Cache<T>(limit), asking = new Map<string, Promise<T>>();
  return {
    peek: (key: string): T | undefined => cache.get(key),
    /** The kept answer when fresh (unless forced), else the ask already out (unless forced), else a new ask. */
    look(key: string, force: boolean, ask: () => Promise<T>): Promise<T> {
      if (!force && cache.fresh(key, fresh, Date.now())) return Promise.resolve(cache.get(key) as T);
      const pending = asking.get(key);
      if (pending && !force) return pending;
      const p: Promise<T> = ask().then((value) => {
        // Only the newest ask is kept: a slower, older answer arriving after a ↻ is already out of date.
        if (asking.get(key) === p && keep(value)) cache.set(key, value, Date.now());
        return value;
      }).finally(() => {
        if (asking.get(key) === p) asking.delete(key);
      });
      asking.set(key, p);
      return p;
    },
    clear(): void {
      cache.clear();
      asking.clear();
    },
  };
}

// Not kept: a gh that isn't signed in, and a folder without a GitHub remote (yet): both are
// what the person is about to fix, so the next look asks again.
// Accounts and remotes rarely change; lists do (until #16 polls for changes).
const accounts = facts<Account>(16, 5 * 60_000, (a) => a.status.ok);
const remotes = facts<RemoteRepo | null>(64, 5 * 60_000, (r) => r !== null);
const assignedGroups = facts<IssueGroup>(64, 60_000, () => true);

const machineKey = (on: string | null | undefined): string => on ?? "";
const folderKey = (where: gh.Where): string => `${where.on ?? ""}\n${where.cwd ?? ""}`;
const groupKey = (r: RemoteRepo, login: string, on: string | null): string => `${on ?? ""}\n${r.host}/${r.owner}/${r.repo}\n${login}`;

/** The gh on that machine (null: this computer). */
export const account = (on: string | null, force = false): Promise<Account> =>
  accounts.look(machineKey(on), force, () => gh.account(on));
export const peekAccount = (on: string | null): Account | undefined => accounts.peek(machineKey(on));

/** The folder's GitHub remote, or null when it has none. */
export const remote = (where: gh.Where, force = false): Promise<RemoteRepo | null> =>
  remotes.look(folderKey(where), force, () => githubRemote(where));
/** undefined: not known (yet). */
export const peekRemote = (where: gh.Where): RemoteRepo | null | undefined => remotes.peek(folderKey(where));

/** The repository's open issues assigned to `login`, the gh account on `on`. */
export const assigned = (r: RemoteRepo, login: string, on: string | null, force = false): Promise<IssueGroup> =>
  assignedGroups.look(groupKey(r, login, on), force, () => assignedToMe(r, login, on));
export const peekAssigned = (r: RemoteRepo, login: string, on: string | null): IssueGroup | undefined =>
  assignedGroups.peek(groupKey(r, login, on));

/** Forgets everything (tests). */
export function clear(): void {
  accounts.clear();
  remotes.clear();
  assignedGroups.clear();
}

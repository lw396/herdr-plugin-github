// What the sidebar knows about a place, kept per what each fact depends on: the gh account per
// machine, the GitHub remote per machine and folder, the repository per owner/repo and the
// machine whose gh asked. Switching back to a place shows what is known at once and asks again
// only once it is stale (or on ↻); two looks at once share one call.
import { Cache } from "../core/cache.ts";
import type { Account } from "../core/account.ts";
import type { RemoteRepo } from "../core/remote.ts";
import * as gh from "./gh.ts";
import { githubRemote } from "./git.ts";

/** How long a fact counts as fresh (ms). Stale facts still show while they are asked again. */
const FRESH = 5 * 60_000;

const accounts = new Cache<Account>(16);
const remotes = new Cache<RemoteRepo | null>(64);
const repositories = new Cache<string>(64);
const asking = new Map<string, Promise<unknown>>();

/** The cached value when fresh (unless forced), else one shared ask; failures are not kept. */
function look<T>(name: string, cache: Cache<T>, key: string, force: boolean, ask: () => Promise<T>, keep: (v: T) => boolean = () => true): Promise<T> {
  if (!force && cache.fresh(key, FRESH, Date.now())) return Promise.resolve(cache.get(key) as T);
  const id = `${name}\n${key}`;
  const pending = asking.get(id);
  if (pending && !force) return pending as Promise<T>;
  const p = ask().then((v) => {
    if (keep(v)) cache.set(key, v, Date.now());
    return v;
  }).finally(() => {
    if (asking.get(id) === p) asking.delete(id);
  });
  asking.set(id, p);
  return p;
}

const machineKey = (on: string | null | undefined): string => on ?? "";
const folderKey = (where: gh.Where): string => `${where.on ?? ""}\n${where.cwd ?? ""}`;
const repositoryKey = (r: RemoteRepo, on: string | null): string => `${on ?? ""}\n${r.host}/${r.owner}/${r.repo}`;

/** The gh on that machine (null: this computer); only a signed-in account is kept. */
export const account = (on: string | null, force = false): Promise<Account> =>
  look("account", accounts, machineKey(on), force, () => gh.account(on), (a) => a.status.ok);
export const peekAccount = (on: string | null): Account | undefined => accounts.get(machineKey(on));

/** The folder's GitHub remote, or null when it has none. */
export const remote = (where: gh.Where, force = false): Promise<RemoteRepo | null> =>
  look("remote", remotes, folderKey(where), force, () => githubRemote(where));
/** undefined: not known yet; null: no GitHub remote. */
export const peekRemote = (where: gh.Where): RemoteRepo | null | undefined => remotes.get(folderKey(where));

/** The repository's full name as GitHub has it, asked with the gh on `on`. */
export const repository = (r: RemoteRepo, on: string | null, force = false): Promise<string> =>
  look("repository", repositories, repositoryKey(r, on), force, () => gh.apiText(`repos/${r.owner}/${r.repo}`, ".full_name", { on }));
export const peekRepository = (r: RemoteRepo, on: string | null): string | undefined => repositories.get(repositoryKey(r, on));

/** Forgets everything (tests). */
export function clear(): void {
  accounts.clear();
  remotes.clear();
  repositories.clear();
  asking.clear();
}

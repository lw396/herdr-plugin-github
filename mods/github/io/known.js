// What the sidebar knows about a place, kept per what each fact depends on: the gh account per
// machine, the GitHub remote per machine and folder, the repository per owner/repo and the
// machine whose gh asked. Switching back to a place shows what is known at once and asks again
// only once it is stale (or on ↻); two looks at once share one call.
import { Cache } from "../core/cache.js";
import * as gh from "./gh.js";
import { githubRemote } from "./git.js";
/** How long a fact counts as fresh (ms). Stale facts still show while they are asked again. */
const FRESH = 5 * 60_000;
const accounts = new Cache(16);
const remotes = new Cache(64);
const repositories = new Cache(64);
const asking = new Map();
/** The cached value when fresh (unless forced), else one shared ask; failures are not kept. */
function look(name, cache, key, force, ask, keep = () => true) {
    if (!force && cache.fresh(key, FRESH, Date.now()))
        return Promise.resolve(cache.get(key));
    const id = `${name}\n${key}`;
    const pending = asking.get(id);
    if (pending && !force)
        return pending;
    const p = ask().then((v) => {
        if (keep(v))
            cache.set(key, v, Date.now());
        return v;
    }).finally(() => {
        if (asking.get(id) === p)
            asking.delete(id);
    });
    asking.set(id, p);
    return p;
}
const machineKey = (on) => on ?? "";
const folderKey = (where) => `${where.on ?? ""}\n${where.cwd ?? ""}`;
const repositoryKey = (r, on) => `${on ?? ""}\n${r.host}/${r.owner}/${r.repo}`;
/** The gh on that machine (null: this computer); only a signed-in account is kept. */
export const account = (on, force = false) => look("account", accounts, machineKey(on), force, () => gh.account(on), (a) => a.status.ok);
export const peekAccount = (on) => accounts.get(machineKey(on));
/** The folder's GitHub remote, or null when it has none. */
export const remote = (where, force = false) => look("remote", remotes, folderKey(where), force, () => githubRemote(where));
/** undefined: not known yet; null: no GitHub remote. */
export const peekRemote = (where) => remotes.get(folderKey(where));
/** The repository's full name as GitHub has it, asked with the gh on `on`. */
export const repository = (r, on, force = false) => look("repository", repositories, repositoryKey(r, on), force, () => gh.apiText(`repos/${r.owner}/${r.repo}`, ".full_name", { on }));
export const peekRepository = (r, on) => repositories.get(repositoryKey(r, on));
/** Forgets everything (tests). */
export function clear() {
    accounts.clear();
    remotes.clear();
    repositories.clear();
    asking.clear();
}

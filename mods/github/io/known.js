// What the sidebar knows about a place, kept per what each fact depends on: the gh account per
// machine, the GitHub remote per machine and folder, the repository per host/owner/repo and the
// machine whose gh asked (each machine's gh may be another account). Switching back to a place
// shows what is known at once and asks again only once it is stale (or on ↻); two looks at once
// share one call.
import { Cache } from "../core/cache.js";
import * as gh from "./gh.js";
import { githubRemote } from "./git.js";
/** How long a fact counts as fresh (ms). Stale facts still show while they are asked again. */
const FRESH = 5 * 60_000;
/** One kind of fact: kept answers, and the ask still out per key. Only answers `keep` accepts are kept. */
function facts(limit, keep) {
    const cache = new Cache(limit), asking = new Map();
    return {
        peek: (key) => cache.get(key),
        /** The kept answer when fresh (unless forced), else the ask already out (unless forced), else a new ask. */
        look(key, force, ask) {
            if (!force && cache.fresh(key, FRESH, Date.now()))
                return Promise.resolve(cache.get(key));
            const pending = asking.get(key);
            if (pending && !force)
                return pending;
            const p = ask().then((value) => {
                // Only the newest ask is kept: a slower, older answer arriving after a ↻ is already out of date.
                if (asking.get(key) === p && keep(value))
                    cache.set(key, value, Date.now());
                return value;
            }).finally(() => {
                if (asking.get(key) === p)
                    asking.delete(key);
            });
            asking.set(key, p);
            return p;
        },
        clear() {
            cache.clear();
            asking.clear();
        },
    };
}
// Not kept: a gh that isn't signed in, and a folder without a GitHub remote (yet): both are
// what the person is about to fix, so the next look asks again.
const accounts = facts(16, (a) => a.status.ok);
const remotes = facts(64, (r) => r !== null);
const repositories = facts(64, () => true);
const machineKey = (on) => on ?? "";
const folderKey = (where) => `${where.on ?? ""}\n${where.cwd ?? ""}`;
const repositoryKey = (r, on) => `${on ?? ""}\n${r.host}/${r.owner}/${r.repo}`;
/** The gh on that machine (null: this computer). */
export const account = (on, force = false) => accounts.look(machineKey(on), force, () => gh.account(on));
export const peekAccount = (on) => accounts.peek(machineKey(on));
/** The folder's GitHub remote, or null when it has none. */
export const remote = (where, force = false) => remotes.look(folderKey(where), force, () => githubRemote(where));
/** undefined: not known (yet). */
export const peekRemote = (where) => remotes.peek(folderKey(where));
/** The repository's full name as GitHub has it, asked with the gh on `on`. */
export const repository = (r, on, force = false) => repositories.look(repositoryKey(r, on), force, () => gh.apiText(`repos/${r.owner}/${r.repo}`, ".full_name", { on }));
export const peekRepository = (r, on) => repositories.peek(repositoryKey(r, on));
/** Forgets everything (tests). */
export function clear() {
    accounts.clear();
    remotes.clear();
    repositories.clear();
}

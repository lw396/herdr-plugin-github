// What the sidebar knows about a place: the gh account per machine and the GitHub remote per machine
// and folder. Switching back to a place shows what is known at once and asks again only once it is
// stale (or on ↻); two looks at once share one call.

import type { Account } from "../core/account.ts";
import type { Folder } from "../core/location.ts";
import type { RemoteRepo } from "../core/remote.ts";
import { Facts } from "./facts.ts";
import * as gh from "./gh.ts";
import { githubRemote } from "./git.ts";

// Not kept: a gh that isn't signed in, and a folder without a GitHub remote (yet): both are
// what the person is about to fix, so the next look asks again.
// A GitHub account hardly ever changes: a signed-in one is kept for an hour, even through ↻.
// Remotes rarely change; visible lists also use conditional polling to detect external changes.
const accounts = new Facts<Account>(16, 60 * 60_000, (a) => a.status.ok);
const remotes = new Facts<RemoteRepo | null>(64, 5 * 60_000, (r) => r !== null);

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

export function clear(): void {
	accounts.clear();
	remotes.clear();
}

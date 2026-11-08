// The sidebar's groups, kept per what each depends on: machine, repository and login (each machine's
// gh may be another account). Switching back shows what is kept at once and asks again only once it
// is stale (or on ↻); two looks at once share one call. Each tab's groups are built on these.

import type { Folder } from "../../shared/core/location.ts";
import type { RemoteRepo } from "../../shared/core/remote.ts";
import { Facts } from "../../shared/io/facts.ts";
import { appendPage, type Page } from "../core/page.ts";

/** Where a tab's groups are asked: the folder, its repository, and the login of the gh on its machine. */
export interface Ready extends Folder {
	remote: RemoteRepo;
	login: string;
}

/**
 * What a group's rows depend on: its machine, repository (`owner/repo`, lower case) and login (what an
 * account can see); local branches also on the checkout. Kept groups are found again by these parts.
 */
interface GroupWhere {
	kind: string;
	on: string | null;
	repo: string;
	login: string;
	cwd: string | null;
}
export const where = (kind: string, r: Ready, cwd: string | null = null): GroupWhere => ({
	kind,
	on: r.on,
	repo: `${r.remote.owner}/${r.remote.repo}`.toLowerCase(),
	login: r.login,
	cwd,
});
export const groupKey = (w: GroupWhere): string => JSON.stringify([w.kind, w.on, w.repo, w.login, w.cwd]);
export function groupOf(key: string): GroupWhere {
	const [kind, on, repo, login, cwd] = JSON.parse(key) as [string, string | null, string, string, string | null];
	return { kind, on, repo, login, cwd };
}

/** Groups asked a page at a time: the first page kept for a minute, and the pages Load more adds to it. */
export function pagedGroups<K extends string, P extends Page<{ number: number }>>(
	ask: (kind: K, r: Ready, after: string | null) => Promise<P>,
) {
	const kept = new Facts<P>(64, 60_000);
	return {
		kept,
		look: (kind: K, r: Ready, force = false): Promise<P> =>
			kept.look(groupKey(where(kind, r)), force, () => ask(kind, r, null)),
		peek: (kind: K, r: Ready): P | undefined => kept.peek(groupKey(where(kind, r))),
		async more(kind: K, r: Ready, loaded: P): Promise<P> {
			const key = groupKey(where(kind, r));
			const both = appendPage(loaded, await ask(kind, r, loaded.cursor));
			// Kept only if `loaded` is still what is kept: a ↻ in the meantime replaced it with newer rows.
			if (kept.peek(key) === loaded) kept.put(key, both);
			return both;
		},
	};
}

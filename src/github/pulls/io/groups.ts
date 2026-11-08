// The Pull Requests tab's groups, kept per kind, machine, repository and login; local branches also
// per checkout.

import { localBranches } from "../../shared/io/git.ts";
import { PAGE } from "../../sidebar/core/page.ts";
import { GroupCache, pagedGroups, type Ready } from "../../sidebar/io/groups.ts";
import { localPage, type Pull, type PullCategory, type PullGroup, type PullGroupKind } from "../core/pulls.ts";
import { localPulls, pullPage } from "./pulls.ts";

const pullGroups = pagedGroups<PullGroupKind, PullGroup>((kind, r, after) =>
	pullPage(kind, r.remote, r.login, r.on, after),
);

// Local matches depend on the focused checkout too, and are asked again whenever looked at: its
// branches are read each time, and only a changed snapshot asks GitHub again (ADR 0006).
const localMatches = new GroupCache<"local", { signature: string; rows: Pull[]; page: PullGroup }>(0, true);

async function localGroup(r: Ready, force: boolean): Promise<PullGroup> {
	const batch = await localMatches.look("local", r, force, async () => {
		const snapshot = await localBranches(r.remote, r);
		const signature = JSON.stringify(snapshot);
		const kept = localMatches.peek("local", r);
		if (!force && kept?.signature === signature) return kept;
		const rows = await localPulls(r.remote, snapshot, r.on);
		return { signature, rows, page: localPage(rows, PAGE) };
	});
	return batch.page;
}

/**
 * A PR of `repo` changed: kept groups are asked again on their next look, without fetching hidden or
 * folded ones. A submitted review changes only what that machine's account sees (`on`); a merge, every one.
 */
export function pullsChanged(repo: string, on?: string | null): void {
	const matches = (w: { repo: string; on: string | null }) =>
		w.repo === repo.toLowerCase() && (on === undefined || w.on === on);
	pullGroups.patch((where, group) => (matches(where) ? group : undefined));
	// Local branch snapshots can stay identical while their PRs change.
	localMatches.patch((where, value) => (matches(where) ? { ...value, signature: "" } : undefined));
}

/** A PR group's first page, and any pages Load more added. */
export const pullGroup = (kind: PullCategory, r: Ready, force = false): Promise<PullGroup> =>
	kind === "local" ? localGroup(r, force) : pullGroups.look(kind, r, force);

export function peekPullGroup(kind: PullCategory, r: Ready): PullGroup | undefined {
	if (kind !== "local") return pullGroups.peek(kind, r);
	return localMatches.peek("local", r)?.page;
}

export async function morePulls(kind: PullCategory, r: Ready, loaded: PullGroup): Promise<PullGroup> {
	if (kind !== "local") return pullGroups.more(kind, r, loaded);
	const batch = localMatches.peek("local", r);
	if (!batch || batch.page !== loaded) return loaded;
	batch.page = localPage(batch.rows, loaded.rows.length + PAGE);
	return batch.page;
}

export function clear(): void {
	pullGroups.clear();
	localMatches.clear();
}

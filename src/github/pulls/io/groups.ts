// The Pull Requests tab's groups, kept per kind, machine, repository and login; local branches also
// per checkout.

import { Facts } from "../../shared/io/facts.ts";
import { localBranches } from "../../shared/io/git.ts";
import { PAGE } from "../../sidebar/core/page.ts";
import { groupKey, groupOf, pagedGroups, type Ready, where } from "../../sidebar/io/groups.ts";
import { localPage, type Pull, type PullCategory, type PullGroup, type PullGroupKind } from "../core/pulls.ts";
import { localPulls, pullPage } from "./pulls.ts";

const pullGroups = pagedGroups<PullGroupKind, PullGroup>((kind, r, after) =>
	pullPage(kind, r.remote, r.login, r.on, after),
);

// Local matches depend on the focused checkout too, and are asked again whenever looked at: its
// branches are read each time, and only a changed snapshot asks GitHub again (ADR 0006).
const localMatches = new Facts<{ signature: string; rows: Pull[] }>(64, 0);
/** The page of a kept batch that was last shown: Load more grows it without another request. */
const localShown = new WeakMap<Pull[], PullGroup>();

const localKey = (r: Ready): string => groupKey(where("local", r, r.cwd));

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

/**
 * A PR of `repo` changed: kept groups are asked again on their next look, without fetching hidden or
 * folded ones. A submitted review changes only what that machine's account sees (`on`); a merge, every one.
 */
export function pullsChanged(repo: string, on?: string | null): void {
	const matches = (key: string) => {
		const w = groupOf(key);
		return w.repo === repo.toLowerCase() && (on === undefined || w.on === on);
	};
	pullGroups.kept.patch((key, group) => (matches(key) ? group : undefined));
	// Local branch snapshots can stay identical while their PRs change.
	localMatches.patch((key, value) => (matches(key) ? { ...value, signature: "" } : undefined));
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
	pullGroups.kept.clear();
	localMatches.clear();
}

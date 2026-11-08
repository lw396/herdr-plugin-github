import type { Context } from "gpui-kit";
import { failureOf } from "../../shared/core/gh.ts";
import { type DetailRef, notVisible } from "../core/detail.ts";
import type { Projects } from "../core/projects.ts";
import { readProjects } from "../io/projects.ts";

/** A page's failed read in the reader's words: GitHub's 404 means this account cannot see it. */
export function readFailure(ref: DetailRef, e: unknown): string {
	const failure = failureOf(e);
	return failure.notFound ? notVisible(ref) : failure.message;
}

/** Optional Projects load after the item, on its machine; `current` drops a stale answer. */
export function loadProjects(
	cx: Context,
	ref: DetailRef,
	on: string | null,
	entry: { projects?: Projects; projectsLoading: boolean },
	current: () => boolean,
): void {
	entry.projectsLoading = true;
	cx.spawn(async (cx) => {
		const projects = await readProjects(ref, on);
		if (!current()) return;
		entry.projects = projects;
		entry.projectsLoading = false;
		cx.notify();
	});
}

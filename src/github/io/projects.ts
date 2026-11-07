// Optional read-only metadata shared by issue and pull request readers.
import type { DetailRef } from "../core/detail.ts";
import {
	PROJECTS_QUERY,
	type Project,
	type Projects,
	PULL_PROJECTS_QUERY,
	projectPage,
	projectsFailure,
} from "../core/projects.ts";
import { graphql } from "./gh.ts";

export async function readProjects(ref: DetailRef, on: string | null): Promise<Projects> {
	const [owner, name] = ref.repo.split("/");
	const projects: Project[] = [];
	let after: string | null = null;
	try {
		do {
			const query = ref.kind === "pr" ? PULL_PROJECTS_QUERY : PROJECTS_QUERY;
			const page = projectPage(
				await graphql(query, { owner: owner!, name: name!, number: ref.number, after }, { on }),
				ref.kind,
			);
			projects.push(...page.projects);
			if (!page.more) return { ok: true, projects };
			if (!page.cursor || page.cursor === after) throw new Error("GitHub did not return the next Projects page.");
			after = page.cursor;
		} while (after);
	} catch (e) {
		return projectsFailure(e instanceof Error ? e.message : String(e), on);
	}
	return { ok: true, projects };
}

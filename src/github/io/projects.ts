// Optional Projects of an issue or PR: lack of access must never hide its discussion.
import type { DetailRef } from "../core/detail.ts";
import { type Project, type Projects, projectPage, projectsFailure, projectsQuery } from "../core/projects.ts";
import { graphql } from "./gh.ts";

export async function readProjects(ref: DetailRef, on: string | null): Promise<Projects> {
	const projects: Project[] = [];
	let after: string | null = null;
	try {
		for (;;) {
			const page = projectPage(await graphql(projectsQuery(ref, after), on), ref.kind);
			projects.push(...page.projects);
			if (!page.more) return { ok: true, projects };
			if (!page.cursor || page.cursor === after) throw new Error("GitHub did not return the next Projects page.");
			after = page.cursor;
		}
	} catch (e) {
		return projectsFailure(e instanceof Error ? e.message : String(e), on);
	}
}

// Optional Projects of an issue or PR: lack of access must never hide its discussion.
import type { DetailRef } from "../core/detail.ts";
import { type Project, type Projects, projectItems, projectsFailure, projectsQuery } from "../core/projects.ts";
import { eachPage } from "./gh.ts";

export async function readProjects(ref: DetailRef, on: string | null): Promise<Projects> {
	const projects: Project[] = [];
	try {
		await eachPage(
			`this ${ref.kind === "pr" ? "pull request" : "issue"}'s Projects`,
			(after) => projectsQuery(ref, after),
			(data) => projectItems(data, ref.kind),
			(page) => {
				projects.push(...page.nodes.map((n) => ({ title: n.project.title, url: n.project.url })));
				return false;
			},
			on,
		);
		return { ok: true, projects };
	} catch (e) {
		return projectsFailure(e instanceof Error ? e.message : String(e), on);
	}
}

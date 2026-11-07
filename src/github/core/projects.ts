// Read-only GitHub Projects (v2) associated with an issue; independent of the REST discussion.
import type { DetailKind } from "./detail.ts";
import { explain } from "./gh-args.ts";

export interface Project {
	title: string;
	url: string;
}
export type Projects = { ok: true; projects: Project[] } | { ok: false; message: string };

export const PROJECTS_QUERY = `query($owner: String!, $name: String!, $number: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) {
      projectItems(first: 100, after: $after, includeArchived: true) {
        pageInfo { hasNextPage endCursor }
        nodes { project { title url } }
      }
    }
  }
}`;

export const PULL_PROJECTS_QUERY = PROJECTS_QUERY.replace("issue(number:", "pullRequest(number:");

interface ProjectData {
	repository: Partial<
		Record<
			"issue" | "pullRequest",
			{
				projectItems: {
					pageInfo: { hasNextPage: boolean; endCursor: string | null };
					nodes: { project: Project }[];
				};
			} | null
		>
	> | null;
}

export function projectPage(
	data: unknown,
	kind: DetailKind = "issue",
): { projects: Project[]; more: boolean; cursor: string | null } {
	const items = (data as ProjectData)?.repository?.[kind === "pr" ? "pullRequest" : "issue"]?.projectItems;
	if (!items) throw new Error(`GitHub did not return this ${kind === "pr" ? "pull request" : "issue"}'s Projects.`);
	return {
		projects: items.nodes.map((n) => ({ title: n.project.title, url: n.project.url })),
		more: items.pageInfo.hasNextPage,
		cursor: items.pageInfo.endCursor,
	};
}

/** Missing scope is not an empty project list; say what to do on the right machine. */
export function projectsFailure(message: string, on: string | null): Projects {
	const machine = on ?? "this computer";
	return {
		ok: false,
		message: /read:project/.test(message)
			? `Projects require read:project. Run gh auth refresh -h github.com -s read:project on ${machine}.`
			: `Projects unavailable on ${machine}. ${explain(message)}`,
	};
}

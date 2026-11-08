// Read-only GitHub Projects (v2) of an issue or PR; optional metadata, independent of the discussion.

import { explain, type Query } from "../../shared/core/gh.ts";
import { type DetailRef, ownerName } from "./detail.ts";

export interface Project {
	title: string;
	url: string;
}
export type Projects = { ok: true; projects: Project[] } | { ok: false; message: string };

const FIELD = { issue: "issue", pr: "pullRequest" } as const;

/** A page of the item's Projects (`after` null: the first). */
export function projectsQuery(ref: DetailRef, after: string | null): Query {
	const { owner, name } = ownerName(ref.repo);
	return {
		query: `query($owner: String!, $name: String!, $number: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    ${FIELD[ref.kind]}(number: $number) {
      projectItems(first: 100, after: $after, includeArchived: true) {
        pageInfo { hasNextPage endCursor }
        nodes { project { title url } }
      }
    }
  }
}`,
		variables: { owner, name, number: ref.number, after },
	};
}

interface ProjectItems {
	pageInfo: { hasNextPage: boolean; endCursor: string | null };
	nodes: { project: Project }[];
}

export function projectItems(data: unknown, kind: DetailRef["kind"]): ProjectItems | undefined {
	const repository = (data as { repository: Record<string, { projectItems: ProjectItems } | null> | null } | null)
		?.repository;
	return repository?.[FIELD[kind]]?.projectItems;
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

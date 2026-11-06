// Read-only GitHub Projects (v2) associated with an issue; independent of the REST discussion.
import { explain } from "./gh-args.ts";

export interface Project { title: string; url: string }
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

interface ProjectData {
  repository: {
    issue: {
      projectItems: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        nodes: { project: Project }[];
      }
    } | null
  } | null;
}

export function projectPage(data: unknown): { projects: Project[]; more: boolean; cursor: string | null } {
  const items = (data as ProjectData)?.repository?.issue?.projectItems;
  if (!items) throw new Error("GitHub did not return this issue's Projects.");
  return { projects: items.nodes.map(n => ({ title: n.project.title, url: n.project.url })), more: items.pageInfo.hasNextPage, cursor: items.pageInfo.endCursor };
}

/** Missing scope is not an empty project list; say what to do on the right machine. */
export function projectsFailure(message: string, on: string | null): Projects {
  const machine = on ?? "this computer";
  return {
    ok: false, message: /read:project/.test(message)
      ? `Projects require read:project. Run gh auth refresh -h github.com -s read:project on ${machine}.`
      : `Projects unavailable on ${machine}. ${explain(message)}`
  };
}

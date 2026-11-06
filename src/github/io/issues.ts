// Issues from GitHub, through gh on the folder/reader's machine (ADR 0003).
import { groupQuery, groupVariables, parseIssueGroup, type GroupKind, type IssueGroup } from "../core/issues.ts";
import type { RemoteRepo } from "../core/remote.ts";
import { api, graphql } from "./gh.ts";
import { PROJECTS_QUERY, projectPage, projectsFailure, type Project, type Projects } from "../core/projects.ts";
import { parseIssueDetail, type IssueDetail } from "../core/issue-detail.ts";

/**
 * One page of a group in the repository, asked with the gh on `on` (whose account is `login`,
 * for Assigned): the first page when `after` is null, else the page after that cursor.
 */
export async function issuePage(kind: GroupKind, remote: RemoteRepo, login: string, on: string | null, after: string | null): Promise<IssueGroup> {
  return parseIssueGroup(await graphql(groupQuery(kind), groupVariables(kind, remote, login, after), { on }));
}

/**
 * One issue and all timeline pages: the timeline carries both the comments and the label/assignment
 * activity, so one paginated read serves both. The caller supplies the reader tab's machine, never a cwd.
 */
export async function readIssue(repo: string, number: number, on: string | null): Promise<IssueDetail> {
  const path = `repos/${repo}/issues/${number}`;
  const [issue, timeline] = await Promise.all([
    api(path, { on }),
    api(`${path}/timeline?per_page=100`, { on, paginate: true }),
  ]);
  return parseIssueDetail(issue, timeline);
}

/** Optional metadata: lack of Projects access must never hide the issue body or comments. */
export async function readIssueProjects(repo: string, number: number, on: string | null): Promise<Projects> {
  const [owner, name] = repo.split("/");
  const projects: Project[] = [];
  let after: string | null = null;
  try {
    do {
      const page = projectPage(await graphql(PROJECTS_QUERY, { owner: owner!, name: name!, number, after }, { on }));
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

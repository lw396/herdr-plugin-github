// Issues from GitHub, through gh on the folder/reader's machine (ADR 0003).
import { groupQuery, groupVariables, parseIssueGroup } from "../core/issues.js";
import { api, graphql } from "./gh.js";
import { PROJECTS_QUERY, projectPage, projectsFailure } from "../core/projects.js";
import { parseIssueDetail } from "../core/issue-detail.js";
/**
 * One page of a group in the repository, asked with the gh on `on` (whose account is `login`,
 * for Assigned): the first page when `after` is null, else the page after that cursor.
 */
export async function issuePage(kind, remote, login, on, after) {
    return parseIssueGroup(await graphql(groupQuery(kind), groupVariables(kind, remote, login, after), { on }));
}
/** One issue and all comment pages. The caller supplies the reader tab's machine, never a cwd. */
export async function readIssue(repo, number, on) {
    const path = `repos/${repo}/issues/${number}`;
    const [issue, comments] = await Promise.all([
        api(path, { on }),
        api(`${path}/comments?per_page=100`, { on, paginate: true }),
    ]);
    return parseIssueDetail(issue, comments);
}
/** Optional metadata: lack of Projects access must never hide the issue body or comments. */
export async function readIssueProjects(repo, number, on) {
    const [owner, name] = repo.split("/");
    const projects = [];
    let after = null;
    try {
        do {
            const page = projectPage(await graphql(PROJECTS_QUERY, { owner: owner, name: name, number, after }, { on }));
            projects.push(...page.projects);
            if (!page.more)
                return { ok: true, projects };
            if (!page.cursor || page.cursor === after)
                throw new Error("GitHub did not return the next Projects page.");
            after = page.cursor;
        } while (after);
    }
    catch (e) {
        return projectsFailure(e instanceof Error ? e.message : String(e), on);
    }
    return { ok: true, projects };
}

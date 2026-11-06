// Issues from GitHub, through gh on the folder/pane's machine (ADR 0003).
import { groupQuery, groupVariables, parseIssueGroup } from "../core/issues.js";
import { api, graphql } from "./gh.js";
import { parseIssueDetail } from "../core/issue-detail.js";
/**
 * One page of a group in the repository, asked with the gh on `on` (whose account is `login`,
 * for Assigned): the first page when `after` is null, else the page after that cursor.
 */
export async function issuePage(kind, remote, login, on, after) {
    return parseIssueGroup(await graphql(groupQuery(kind), groupVariables(kind, remote, login, after), { on }));
}
/** One issue and all comment pages. The caller supplies the pane's machine, never a cwd. */
export async function readIssue(repo, number, on) {
    const path = `repos/${repo}/issues/${number}`;
    const [issue, comments] = await Promise.all([
        api(path, { on }),
        api(`${path}/comments?per_page=100`, { on, paginate: true }),
    ]);
    return parseIssueDetail(issue, comments);
}

// Issue groups from GitHub, through gh on the folder's machine (ADR 0003).
import { groupQuery, groupVariables, parseIssueGroup } from "../core/issues.js";
import { graphql } from "./gh.js";
/**
 * One page of a group in the repository, asked with the gh on `on` (whose account is `login`,
 * for Assigned): the first page when `after` is null, else the page after that cursor.
 */
export async function issuePage(kind, remote, login, on, after) {
    return parseIssueGroup(await graphql(groupQuery(kind), groupVariables(kind, remote, login, after), { on }));
}

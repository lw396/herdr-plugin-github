// Issue groups from GitHub, through gh on the folder's machine (ADR 0003).
import { ASSIGNED_QUERY, assignedVariables, parseIssueGroup } from "../core/issues.js";
import { graphql } from "./gh.js";
/** The repository's open issues assigned to `login` (the gh account on `on`), first page. */
export async function assignedToMe(remote, login, on) {
    return parseIssueGroup(await graphql(ASSIGNED_QUERY, assignedVariables(remote, login), { on }));
}

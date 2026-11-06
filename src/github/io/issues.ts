// Issue groups from GitHub, through gh on the folder's machine (ADR 0003).
import { groupQuery, groupVariables, parseIssueGroup, type GroupKind, type IssueGroup } from "../core/issues.ts";
import type { RemoteRepo } from "../core/remote.ts";
import { graphql } from "./gh.ts";

/**
 * One page of a group in the repository, asked with the gh on `on` (whose account is `login`,
 * for Assigned): the first page when `after` is null, else the page after that cursor.
 */
export async function issuePage(kind: GroupKind, remote: RemoteRepo, login: string, on: string | null, after: string | null): Promise<IssueGroup> {
  return parseIssueGroup(await graphql(groupQuery(kind), groupVariables(kind, remote, login, after), { on }));
}

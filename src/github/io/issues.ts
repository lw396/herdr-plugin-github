// Issue groups from GitHub, through gh on the folder's machine (ADR 0003).
import { ASSIGNED_QUERY, assignedVariables, parseIssueGroup, type IssueGroup } from "../core/issues.ts";
import type { RemoteRepo } from "../core/remote.ts";
import { graphql } from "./gh.ts";

/** The repository's open issues assigned to `login` (the gh account on `on`), first page. */
export async function assignedToMe(remote: RemoteRepo, login: string, on: string | null): Promise<IssueGroup> {
  return parseIssueGroup(await graphql(ASSIGNED_QUERY, assignedVariables(remote, login), { on }));
}

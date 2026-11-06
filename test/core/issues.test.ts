// Issue groups: the GraphQL query's variables, and its `data` turned into the sidebar's rows.
// Replies are real gh 2.96 output (`gh api graphql`), 2026-11-06.
import { describe, expect, test } from "bun:test";
import { assignedVariables, issuesNotice, parseIssueGroup } from "../../src/github/core/issues.ts";

const MINE = { repository: { hasIssuesEnabled: true, issues: { totalCount: 1, pageInfo: { hasNextPage: false, endCursor: "Y3Vyc29yOnYyOpK0MjAyNi0xMS0wNlQxMzowMToxM1rPAAAAAXPrZ54=" }, nodes: [
  { number: 11, title: "Issues 标签页：\"指派给我的\"一组", updatedAt: "2026-11-06T13:01:13Z", url: "https://github.com/lw396/herdr-plugin-github/issues/11", assignees: { nodes: [{ login: "lw396" }] } },
] } } };

const LINUX = { repository: { hasIssuesEnabled: false, issues: { totalCount: 0, pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] } } };

describe("assignedVariables", () => {
  test("the repository from the remote and the gh account's login", () => {
    expect(assignedVariables({ remote: "origin", host: "github.com", owner: "lw396", repo: "herdr-plugin-github" }, "lw396"))
      .toEqual({ owner: "lw396", name: "herdr-plugin-github", assignee: "lw396" });
  });
});

describe("parseIssueGroup", () => {
  test("rows: number, title, assignees, when updated, link", () => {
    expect(parseIssueGroup(MINE)).toEqual({
      issuesEnabled: true,
      total: 1,
      more: false,
      issues: [{ number: 11, title: "Issues 标签页：\"指派给我的\"一组", assignees: ["lw396"], updatedAt: "2026-11-06T13:01:13Z", url: "https://github.com/lw396/herdr-plugin-github/issues/11" }],
    });
  });

  test("Issues turned off (torvalds/linux): no rows, and says so", () => {
    expect(parseIssueGroup(LINUX)).toEqual({ issuesEnabled: false, total: 0, more: false, issues: [] });
  });

  test("more than a page: more is true", () => {
    const data = { repository: { ...MINE.repository, issues: { ...MINE.repository.issues, totalCount: 31, pageInfo: { hasNextPage: true, endCursor: "x" } } } };
    expect(parseIssueGroup(data)).toMatchObject({ total: 31, more: true });
  });
});

describe("issuesNotice: what the list's place says instead of rows", () => {
  const REMOTE = { remote: "origin", host: "github.com", owner: "lw396", repo: "herdr-plugin-github" };
  const SIGNED_IN = { on: "center", status: { ok: true, user: "lw396" } } as const;
  const GROUP = { issuesEnabled: true, total: 1, more: false, issues: [] };

  test("gh not signed in on the folder's machine: what to run where", () => {
    const account = { on: "center", status: { ok: false, reason: "auth", message: "" } } as const;
    expect(issuesNotice({ account, remote: REMOTE })).toBe("not signed in on center: run gh auth login on center");
  });

  test("no gh on the folder's machine", () => {
    const account = { on: null, status: { ok: false, reason: "missing", message: "cannot run gh: No such file or directory (os error 2)" } } as const;
    expect(issuesNotice({ account, remote: REMOTE })).toBe("gh is not installed on this computer: install it, then run gh auth login");
  });

  test("no GitHub remote", () => {
    expect(issuesNotice({ account: SIGNED_IN, remote: null })).toBe("No GitHub remote in this folder (git remote -v).");
  });

  test("the repository isn't on GitHub, or this account can't see it (404)", () => {
    expect(issuesNotice({ account: SIGNED_IN, remote: REMOTE, failure: { notFound: true, message: "gh: Could not resolve to a Repository with the name 'lw396/herdr-plugin-github'." } }))
      .toBe("lw396/herdr-plugin-github (remote \"origin\") isn't on GitHub, or lw396 can't see it. Check git remote -v.");
  });

  test("other failures: gh's message", () => {
    expect(issuesNotice({ account: SIGNED_IN, remote: REMOTE, failure: { notFound: false, message: "error connecting to api.github.com" } }))
      .toBe("error connecting to api.github.com");
  });

  test("Issues turned off", () => {
    expect(issuesNotice({ account: SIGNED_IN, remote: REMOTE, group: { ...GROUP, issuesEnabled: false } })).toBe("Issues are turned off for lw396/herdr-plugin-github.");
  });

  test("a list to show, or nothing known yet: no notice", () => {
    expect(issuesNotice({ account: SIGNED_IN, remote: REMOTE, group: GROUP })).toBeNull();
    expect(issuesNotice({ account: undefined, remote: undefined })).toBeNull();
  });
});

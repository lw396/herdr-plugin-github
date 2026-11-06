// Issue groups: the GraphQL query's variables, and its `data` turned into the sidebar's rows.
// Replies are real gh 2.96 output (`gh api graphql`), 2026-11-06.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { appendPage, groupQuery, groupVariables, issuesNotice, noRepository, parseIssueGroup } from "../../src/github/core/issues.ts";

/** A real reply saved from gh (test/fixtures), as `data`. */
const fixtureData = (name: string): unknown => JSON.parse(readFileSync(join(import.meta.dir, "../fixtures", name), "utf8")).data;

const MINE = { repository: { hasIssuesEnabled: true, issues: { totalCount: 1, pageInfo: { hasNextPage: false, endCursor: "Y3Vyc29yOnYyOpK0MjAyNi0xMS0wNlQxMzowMToxM1rPAAAAAXPrZ54=" }, nodes: [
  { number: 11, title: "Issues 标签页：\"指派给我的\"一组", updatedAt: "2026-11-06T13:01:13Z", url: "https://github.com/lw396/herdr-plugin-github/issues/11", assignees: { nodes: [{ login: "lw396" }] } },
] } } };

const LINUX = { repository: { hasIssuesEnabled: false, issues: { totalCount: 0, pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] } } };

describe("groupQuery: the page of a group gh asks GitHub for (the replies in test/fixtures answered these)", () => {
  const issuesArgs = (q: string) => /issues\(([^)]*)\)/.exec(q)?.[1];

  test("Assigned: open, filtered by the login", () => {
    const q = groupQuery("assigned");
    expect(q).toContain("$assignee: String!");
    expect(issuesArgs(q)).toBe("first: 30, after: $after, states: OPEN, filterBy: {assignee: $assignee}, orderBy: {field: UPDATED_AT, direction: DESC}");
  });

  test("Open: every open issue", () => {
    const q = groupQuery("open");
    expect(q).not.toContain("$assignee");
    expect(issuesArgs(q)).toBe("first: 30, after: $after, states: OPEN, orderBy: {field: UPDATED_AT, direction: DESC}");
  });

  test("Closed: every closed issue", () => {
    expect(issuesArgs(groupQuery("closed"))).toBe("first: 30, after: $after, states: CLOSED, orderBy: {field: UPDATED_AT, direction: DESC}");
  });

  test("asks whether Issues are on, and the page's cursor", () => {
    expect(groupQuery("open")).toContain("hasIssuesEnabled");
    expect(groupQuery("open")).toContain("pageInfo { hasNextPage endCursor }");
  });
});

describe("groupVariables", () => {
  const REMOTE = { remote: "origin", host: "github.com", owner: "lw396", repo: "herdr-plugin-github" };

  test("Assigned, first page: the repository and the gh account's login", () => {
    expect(groupVariables("assigned", REMOTE, "lw396", null)).toEqual({ owner: "lw396", name: "herdr-plugin-github", after: null, assignee: "lw396" });
  });

  test("Open and Closed don't filter by assignee", () => {
    expect(groupVariables("open", REMOTE, "lw396", null)).toEqual({ owner: "lw396", name: "herdr-plugin-github", after: null });
    expect(groupVariables("closed", REMOTE, "lw396", null)).toEqual({ owner: "lw396", name: "herdr-plugin-github", after: null });
  });

  test("the next page starts after the last one's end cursor", () => {
    expect(groupVariables("open", REMOTE, "lw396", "Y3Vyc29yOnYyOpK0MjAyNi0xMS0wNlQxMzowMToxM1rPAAAAAXPrZ54="))
      .toMatchObject({ after: "Y3Vyc29yOnYyOpK0MjAyNi0xMS0wNlQxMzowMToxM1rPAAAAAXPrZ54=" });
  });
});

describe("parseIssueGroup", () => {
  test("rows: number, title, assignees, when updated, link", () => {
    expect(parseIssueGroup(MINE)).toEqual({
      issuesEnabled: true,
      total: 1,
      more: false,
      cursor: "Y3Vyc29yOnYyOpK0MjAyNi0xMS0wNlQxMzowMToxM1rPAAAAAXPrZ54=",
      issues: [{ number: 11, title: "Issues 标签页：\"指派给我的\"一组", assignees: ["lw396"], updatedAt: "2026-11-06T13:01:13Z", url: "https://github.com/lw396/herdr-plugin-github/issues/11" }],
    });
  });

  test("Issues turned off (torvalds/linux): no rows, and says so", () => {
    expect(parseIssueGroup(LINUX)).toEqual({ issuesEnabled: false, total: 0, more: false, cursor: null, issues: [] });
  });

  test("more than a page: more is true", () => {
    const data = { repository: { ...MINE.repository, issues: { ...MINE.repository.issues, totalCount: 31, pageInfo: { hasNextPage: true, endCursor: "x" } } } };
    expect(parseIssueGroup(data)).toMatchObject({ total: 31, more: true, cursor: "x" });
  });
});

describe("appendPage: Load more", () => {
  const first = parseIssueGroup(fixtureData("open-cli-1.json"));
  const second = parseIssueGroup(fixtureData("open-cli-2.json"));

  test("the next page's rows follow the loaded ones; where the next page starts comes from it", () => {
    const both = appendPage(first, second);
    expect(both.issues).toHaveLength(60);
    expect(both.issues.slice(28, 32).map((i) => i.number)).toEqual([...first.issues.slice(28).map((i) => i.number), 14895, 14856]);
    expect(both).toMatchObject({ total: 1058, more: true, cursor: "Y3Vyc29yOnYyOpK0MjAyNi0xMC0yNVQxNToxNzozNVrPAAAAAS_2QAQ=" });
  });

  test("an issue updated between the two loads, in both pages: shown once, where it was", () => {
    const moved = { ...second, issues: [first.issues[3]!, ...second.issues] };
    const both = appendPage(first, moved);
    expect(both.issues).toHaveLength(60);
    expect(both.issues.filter((i) => i.number === 14615)).toHaveLength(1);
  });
});

describe("issuesNotice: what the list's place says instead of rows", () => {
  const REMOTE = { remote: "origin", host: "github.com", owner: "lw396", repo: "herdr-plugin-github" };
  const SIGNED_IN = { on: "center", status: { ok: true, user: "lw396" } } as const;
  const GROUP = { issuesEnabled: true, total: 1, more: false, cursor: null, issues: [] };

  test("gh not signed in on the folder's machine: what to run where", () => {
    const account = { on: "center", status: { ok: false, reason: "auth", message: "" } } as const;
    expect(issuesNotice({ account, remote: REMOTE })).toBe("not signed in on center: run gh auth login on center");
  });

  test("no gh on the folder's machine", () => {
    const account = { on: null, status: { ok: false, reason: "missing", message: "cannot run gh: No such file or directory (os error 2)" } } as const;
    expect(issuesNotice({ account, remote: REMOTE })).toBe("gh is not installed on this computer: install it, then run gh auth login");
  });

  test("no GitHub remote: not a problem, so no notice (the sidebar shows noRepository instead)", () => {
    expect(issuesNotice({ account: SIGNED_IN, remote: null })).toBeNull();
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

describe("noRepository: what the sidebar says in a folder without a GitHub remote", () => {
  test("names the folder, and how to get a list here", () => {
    expect(noRepository("/Users/apple")).toEqual({
      title: "No GitHub repository",
      detail: "apple has no GitHub remote. Focus a terminal in a repository cloned from GitHub.",
    });
  });

  test("a trailing slash, the root, no folder", () => {
    expect(noRepository("/home/valian/work/").detail).toStartWith("work has no GitHub remote.");
    expect(noRepository("/").detail).toStartWith("/ has no GitHub remote.");
    expect(noRepository(null).detail).toBe("Focus a terminal in a repository cloned from GitHub.");
  });
});

// issues.ts through a fake `exec`. Replies are real gh 2.96 output (`gh api graphql`), 2026-11-06.
import { afterEach, describe, expect, test } from "bun:test";
import { machine, reset } from "../fake-herdr.ts";
import { ASSIGNED_QUERY } from "../../src/github/core/issues.ts";
import { GhError } from "../../src/github/io/gh.ts";
import * as issues from "../../src/github/io/issues.ts";

afterEach(reset);

const remote = (owner: string, repo: string) => ({ remote: "origin", host: "github.com", owner, repo });
const asked = (owner: string, name: string, assignee: string) =>
  `~$ gh api graphql -f query=${ASSIGNED_QUERY} -f owner=${owner} -f name=${name} -f assignee=${assignee}`;

describe("assignedToMe", () => {
  test("asks the folder machine's gh for the repository's open issues assigned to its login", async () => {
    machine("center", { [asked("lw396", "herdr-plugin-github", "lw396")]: {
      stdout: '{"data":{"repository":{"hasIssuesEnabled":true,"issues":{"totalCount":1,"pageInfo":{"hasNextPage":false,"endCursor":"Y3Vyc29yOnYyOpK0MjAyNi0xMS0wNlQxMzowMToxM1rPAAAAAXPrZ54="},"nodes":[{"number":11,"title":"Issues 标签页：\\"指派给我的\\"一组","updatedAt":"2026-11-06T13:01:13Z","url":"https://github.com/lw396/herdr-plugin-github/issues/11","assignees":{"nodes":[{"login":"lw396"}]}}]}}}}',
    } });
    expect(await issues.assignedToMe(remote("lw396", "herdr-plugin-github"), "lw396", "center")).toEqual({
      issuesEnabled: true,
      total: 1,
      more: false,
      issues: [{ number: 11, title: "Issues 标签页：\"指派给我的\"一组", assignees: ["lw396"], updatedAt: "2026-11-06T13:01:13Z", url: "https://github.com/lw396/herdr-plugin-github/issues/11" }],
    });
  });

  test("Issues turned off: an empty group that says so", async () => {
    machine(null, { [asked("torvalds", "linux", "lw396")]: {
      stdout: '{"data":{"repository":{"hasIssuesEnabled":false,"issues":{"totalCount":0,"pageInfo":{"hasNextPage":false,"endCursor":null},"nodes":[]}}}}',
    } });
    expect(await issues.assignedToMe(remote("torvalds", "linux"), "lw396", null)).toMatchObject({ issuesEnabled: false, issues: [] });
  });

  test("no such repository (or not visible to this account): a GhError that is notFound", async () => {
    machine(null, { [asked("lw396", "wechat-wcp", "lw396")]: {
      code: 1,
      stdout: '{"data":{"repository":null},"errors":[{"type":"NOT_FOUND","path":["repository"],"locations":[{"line":1,"column":41}],"message":"Could not resolve to a Repository with the name \'lw396/wechat-wcp\'."}]}',
      stderr: "gh: Could not resolve to a Repository with the name 'lw396/wechat-wcp'.\n",
    } });
    const error = await issues.assignedToMe(remote("lw396", "wechat-wcp"), "lw396", null).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GhError);
    expect(error).toMatchObject({ notFound: true });
  });

  test("not signed in: a GhError with gh's message", async () => {
    machine(null, { [asked("lw396", "herdr-plugin-github", "lw396")]: {
      code: 4,
      stderr: "To get started with GitHub CLI, please run:  gh auth login\nAlternatively, populate the GH_TOKEN environment variable with a GitHub API authentication token.\n",
    } });
    expect(await issues.assignedToMe(remote("lw396", "herdr-plugin-github"), "lw396", null).catch((e: unknown) => e))
      .toMatchObject({ code: 4, notFound: false });
  });

  test("no gh on the folder's machine: rejects as Herdr does", async () => {
    machine("center", {});
    expect(await issues.assignedToMe(remote("lw396", "herdr-plugin-github"), "lw396", "center").catch((e: unknown) => e))
      .toMatchObject({ message: "cannot start gh: No such file or directory (os error 2)" });
  });
});

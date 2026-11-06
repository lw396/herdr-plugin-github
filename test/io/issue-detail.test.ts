// Captured REST replies from gh api, 2026-11-06; no cwd, on the pane's machine.
import { afterEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { machine, reset } from "../fake-herdr.ts";
import { readIssue } from "../../src/github/io/issues.ts";

afterEach(reset);
const fixture = (name: string) => readFileSync(new URL("../fixtures/" + name, import.meta.url), "utf8");

test("read an issue and its complete discussion using the pane machine's gh", async () => {
  machine("center", {
    "~$ gh api repos/cli/cli/issues/9789": { stdout: fixture("issue-cli-9789.json") },
    "~$ gh api repos/cli/cli/issues/9789/comments?per_page=100 --paginate": { stdout: fixture("comments-cli-9789.json") },
  });
  const issue = await readIssue("cli/cli", 9789, "center");
  expect(issue).toMatchObject({
    number: 9789, title: "`gh auth login --with-token` hangs", state: "open",
    author: "jtmcg", assignees: [], milestone: null,
    labels: ["bug", "priority-3", "help wanted", "gh-auth"],
    url: "https://github.com/cli/cli/issues/9789",
  });
  expect(issue.body).toContain("gh auth login --with-token");
  expect(issue.comments.map(c => [c.id, c.author, c.createdAt])).toEqual([
    [2426092653, "williammartin", "2024-10-21T09:17:22Z"],
    [5993632414, "babakks", "2026-10-05T11:35:56Z"],
    [6679707396, "mithilesh-iitm", "2026-11-06T07:32:15Z"],
  ]);
  expect(issue.comments[0]?.reactions).toEqual([{ emoji: "👍", count: 1 }, { emoji: "❤️", count: 1 }]);
  expect(issue.comments[1]?.reactions).toEqual([]);
});

test("all gh pagination output becomes one chronologically ordered discussion", async () => {
  // Real pages captured with per_page=2 to exercise gh's concatenated JSON arrays.
  machine(null, {
    "~$ gh api repos/cli/cli/issues/9789": { stdout: fixture("issue-cli-9789.json") },
    "~$ gh api repos/cli/cli/issues/9789/comments?per_page=100 --paginate": {
      stdout: fixture("comments-cli-9789-page1.json") + fixture("comments-cli-9789-page2.json"),
    },
  });
  const issue = await readIssue("cli/cli", 9789, null);
  expect(issue.comments.map(c => c.id)).toEqual([2426092653, 5993632414, 6679707396]);
});

test("the assigned issue includes its assignees even with no discussion", async () => {
  machine(null, {
    "~$ gh api repos/lw396/herdr-plugin-github/issues/13": { stdout: fixture("issue-plugin-13.json") },
    "~$ gh api repos/lw396/herdr-plugin-github/issues/13/comments?per_page=100 --paginate": { stdout: "[]" },
  });
  expect(await readIssue("lw396/herdr-plugin-github", 13, null)).toMatchObject({
    author: "lw396", assignees: ["lw396"], milestone: null, comments: [],
  });
});

test("a discussion read failure rejects rather than showing an incomplete issue", async () => {
  machine("center", {
    "~$ gh api repos/cli/cli/issues/9789": { stdout: fixture("issue-cli-9789.json") },
    "~$ gh api repos/cli/cli/issues/9789/comments?per_page=100 --paginate": {
      code: 1, stderr: "gh: Not Found (HTTP 404)\n",
    },
  });
  expect(await readIssue("cli/cli", 9789, "center").catch(e => e)).toMatchObject({ notFound: true });
});

test("a missing remote gh never falls back to this computer", async () => {
  machine("center", {});
  machine(null, {
    "~$ gh api repos/cli/cli/issues/9789": { stdout: fixture("issue-cli-9789.json") },
    "~$ gh api repos/cli/cli/issues/9789/comments?per_page=100 --paginate": { stdout: "[]" },
  });
  expect(await readIssue("cli/cli", 9789, "center").catch(e => e)).toMatchObject({
    message: "cannot start gh: No such file or directory (os error 2)",
  });
});
